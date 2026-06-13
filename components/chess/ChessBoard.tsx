'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Arrow, PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard'
import { BOARD_THEMES, BoardTheme, DEFAULT_BOARD_THEME } from '@/lib/chess-theme'
import { chessSounds } from '@/lib/chess-sounds'
import { loadBoardPrefs } from '@/lib/chess-preferences'

export interface HighlightedSquare {
  square: string
  color?: string
}

export interface BoardArrow {
  from: string
  to: string
  color?: string
}

export interface ChessBoardProps {
  fen: string
  orientation?: 'white' | 'black'
  disabled?: boolean
  onPieceDrop?: (from: string, to: string, promotion?: string) => boolean
  onSquareClick?: (square: string) => void
  highlightedSquares?: HighlightedSquare[]
  arrows?: BoardArrow[]
  showCoordinates?: boolean
  showLegalMoves?: boolean
  showLastMove?: boolean
  showCheckHighlight?: boolean
  allowArrowDrawing?: boolean
  enableSounds?: boolean
  autoPromoteTo?: 'q' | 'r' | 'b' | 'n' | 'ask'
  boardTheme?: BoardTheme
  maxWidth?: number
  id?: string
}

const PROMOTION_CHOICES = [
  { piece: 'q', label: 'Queen', glyph: { w: '♕', b: '♛' } },
  { piece: 'r', label: 'Rook', glyph: { w: '♖', b: '♜' } },
  { piece: 'b', label: 'Bishop', glyph: { w: '♗', b: '♝' } },
  { piece: 'n', label: 'Knight', glyph: { w: '♘', b: '♞' } },
] as const

export default function ChessBoard({
  fen,
  orientation = 'white',
  disabled = false,
  onPieceDrop,
  onSquareClick,
  highlightedSquares = [],
  arrows: externalArrows = [],
  showCoordinates,
  showLegalMoves,
  showLastMove = true,
  showCheckHighlight = true,
  allowArrowDrawing,
  enableSounds,
  autoPromoteTo,
  boardTheme,
  maxWidth = 640,
  id,
}: ChessBoardProps) {
  const prefs = useMemo(() => loadBoardPrefs(), [])
  const effectiveTheme = boardTheme ?? prefs.theme ?? DEFAULT_BOARD_THEME
  const effectiveSounds = enableSounds ?? prefs.sounds
  const effectiveArrowDrawing = allowArrowDrawing ?? prefs.allowArrowDrawing
  const effectiveAutoPromote = autoPromoteTo ?? prefs.autoPromoteTo
  const effectiveShowCoordinates = showCoordinates ?? prefs.showCoordinates
  const interactive = !disabled && !!onPieceDrop
  const legalMovesVisible = showLegalMoves ?? interactive

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null)
  const prevFenRef = useRef<string>(fen)

  const game = useMemo(() => {
    try {
      return new Chess(fen)
    } catch {
      return null
    }
  }, [fen])

  useEffect(() => {
    if (prevFenRef.current !== fen) {
      try {
        const prev = new Chess(prevFenRef.current)
        const next = new Chess(fen)
        const diff = diffLastMove(prev, next)
        if (diff) {
          setLastMove(diff)
          playMoveSound(diff, prev, next, effectiveSounds)
        }
      } catch {
        // ignore
      }
      prevFenRef.current = fen
      setSelectedSquare(null)
    }
  }, [fen, effectiveSounds])

  const checkSquare = useMemo<string | null>(() => {
    if (!game || !showCheckHighlight || !game.inCheck()) return null
    const turn = game.turn()
    for (const row of game.board()) {
      for (const piece of row) {
        if (piece && piece.type === 'k' && piece.color === turn) return piece.square
      }
    }
    return null
  }, [game, showCheckHighlight])

  const legalMoveTargets = useMemo<Set<string>>(() => {
    if (!legalMovesVisible || !game || !selectedSquare) return new Set()
    try {
      const moves = game.moves({ square: selectedSquare as Square, verbose: true })
      return new Set(moves.map((m) => m.to))
    } catch {
      return new Set()
    }
  }, [game, selectedSquare, legalMovesVisible])

  const palette = BOARD_THEMES[effectiveTheme]

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {}
    if (showLastMove && lastMove) {
      styles[lastMove.from] = { ...(styles[lastMove.from] || {}), background: squareBgForLastMove(lastMove.from, palette) }
      styles[lastMove.to] = { ...(styles[lastMove.to] || {}), background: squareBgForLastMove(lastMove.to, palette) }
    }
    if (selectedSquare) {
      styles[selectedSquare] = { ...(styles[selectedSquare] || {}), background: squareBgForSelected(selectedSquare, palette) }
    }
    if (legalMovesVisible && game) {
      legalMoveTargets.forEach((target) => {
        const piece = game.get(target as Square)
        styles[target] = {
          ...(styles[target] || {}),
          background: piece
            ? 'radial-gradient(circle, transparent 52%, rgba(0,0,0,0.25) 53%, rgba(0,0,0,0.25) 62%, transparent 63%)'
            : 'radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 23%)',
        }
      })
    }
    highlightedSquares.forEach(({ square, color }) => {
      styles[square] = {
        ...(styles[square] || {}),
        boxShadow: `inset 0 0 0 4px ${color || 'rgba(255, 209, 59, 0.8)'}`,
      }
    })
    if (checkSquare) {
      styles[checkSquare] = {
        ...(styles[checkSquare] || {}),
        background: palette.checkGlow,
      }
    }
    return styles
  }, [lastMove, selectedSquare, legalMoveTargets, highlightedSquares, checkSquare, legalMovesVisible, showLastMove, palette, game])

  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      if (!interactive || !game || !onPieceDrop) return false

      const piece = game.get(from as Square)
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))

      if (isPromotion) {
        const legal = game.moves({ square: from as Square, verbose: true }).some((m) => m.to === to)
        if (!legal) {
          if (effectiveSounds) chessSounds.illegal()
          return false
        }
        if (effectiveAutoPromote === 'ask') {
          setPendingPromotion({ from, to, color: piece!.color })
          return false
        }
        const accepted = onPieceDrop(from, to, effectiveAutoPromote)
        if (!accepted && effectiveSounds) chessSounds.illegal()
        if (accepted) {
          setLastMove({ from, to })
          setSelectedSquare(null)
        }
        return accepted
      }

      const legal = game.moves({ square: from as Square, verbose: true }).some((m) => m.to === to)
      if (!legal) {
        if (effectiveSounds) chessSounds.illegal()
        return false
      }

      const accepted = onPieceDrop(from, to)
      if (!accepted && effectiveSounds) chessSounds.illegal()
      if (accepted) {
        setLastMove({ from, to })
        setSelectedSquare(null)
      }
      return accepted
    },
    [interactive, game, onPieceDrop, effectiveSounds, effectiveAutoPromote]
  )

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false
      return attemptMove(sourceSquare, targetSquare)
    },
    [attemptMove]
  )

  const handleSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (onSquareClick) onSquareClick(square)
      if (!interactive) return
      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null)
          return
        }
        const moved = attemptMove(selectedSquare, square)
        if (moved) return
      }
      if (!game) return
      const piece = game.get(square as Square)
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square)
      } else {
        setSelectedSquare(null)
      }
    },
    [onSquareClick, interactive, selectedSquare, attemptMove, game]
  )

  const handlePromotionChoice = useCallback(
    (choice: string) => {
      if (!pendingPromotion || !onPieceDrop) {
        setPendingPromotion(null)
        return
      }
      const accepted = onPieceDrop(pendingPromotion.from, pendingPromotion.to, choice)
      if (accepted) {
        setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to })
        setSelectedSquare(null)
      } else if (effectiveSounds) {
        chessSounds.illegal()
      }
      setPendingPromotion(null)
    },
    [pendingPromotion, onPieceDrop, effectiveSounds]
  )

  const arrows = useMemo<Arrow[]>(() => {
    return externalArrows.map((a) => ({
      startSquare: a.from,
      endSquare: a.to,
      color: a.color || 'rgba(21, 128, 61, 0.75)',
    }))
  }, [externalArrows])

  return (
    <div className="relative w-full select-none" style={{ maxWidth, margin: '0 auto' }}>
      <Chessboard
        options={{
          id: id || 'beyondchess-board',
          position: fen,
          boardOrientation: orientation,
          showNotation: effectiveShowCoordinates,
          animationDurationInMs: 200,
          allowDragging: interactive,
          allowDrawingArrows: effectiveArrowDrawing,
          arrows,
          lightSquareStyle: { backgroundColor: palette.light },
          darkSquareStyle: { backgroundColor: palette.dark },
          squareStyles,
          boardStyle: {
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.35)',
          },
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
        }}
      />

      {pendingPromotion && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-10">
          <div className="bg-white rounded-xl shadow-2xl p-6 text-center max-w-xs">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Promote pawn to:</h3>
            <div className="flex gap-3 justify-center">
              {PROMOTION_CHOICES.map(({ piece, label, glyph }) => (
                <button
                  key={piece}
                  onClick={() => handlePromotionChoice(piece)}
                  className="w-16 h-16 rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-500/10 flex items-center justify-center text-4xl transition-all hover:scale-110"
                  title={label}
                  aria-label={`Promote to ${label}`}
                >
                  {glyph[pendingPromotion.color]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- helpers -----------------------------------------------------------------

function isLightSquare(square: string): boolean {
  const file = square.charCodeAt(0) - 97
  const rank = parseInt(square[1], 10) - 1
  return (file + rank) % 2 === 1
}

function squareBgForLastMove(square: string, palette: { lightLastMove: string; darkLastMove: string }) {
  return isLightSquare(square) ? palette.lightLastMove : palette.darkLastMove
}

function squareBgForSelected(square: string, palette: { lightSelected: string; darkSelected: string }) {
  return isLightSquare(square) ? palette.lightSelected : palette.darkSelected
}

function diffLastMove(prev: Chess, next: Chess): { from: string; to: string } | null {
  const disappeared: { sq: string; piece: string }[] = []
  const appeared: { sq: string; piece: string }[] = []
  const prevBoard = prev.board()
  const nextBoard = next.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const before = prevBoard[r][f]
      const after = nextBoard[r][f]
      const sq = String.fromCharCode(97 + f) + (8 - r)
      const beforeKey = before ? before.color + before.type : null
      const afterKey = after ? after.color + after.type : null
      if (beforeKey === afterKey) continue
      if (beforeKey) disappeared.push({ sq, piece: beforeKey })
      if (afterKey) appeared.push({ sq, piece: afterKey })
    }
  }
  if (!disappeared.length || !appeared.length) return null
  for (const d of disappeared) {
    const m = appeared.find((a) => a.piece === d.piece)
    if (m) return { from: d.sq, to: m.sq }
  }
  for (const d of disappeared) {
    const m = appeared.find((a) => a.piece[0] === d.piece[0])
    if (m) return { from: d.sq, to: m.sq }
  }
  return { from: disappeared[0].sq, to: appeared[0].sq }
}

function playMoveSound(move: { from: string; to: string }, prev: Chess, next: Chess, enabled: boolean) {
  if (!enabled) return
  try {
    if (next.isCheckmate() || next.isStalemate() || next.isDraw()) {
      chessSounds.gameEnd()
      return
    }
    if (next.inCheck()) {
      chessSounds.check()
      return
    }
    const targetBefore = prev.get(move.to as Square)
    if (targetBefore) {
      chessSounds.capture()
      return
    }
    const fromFile = move.from.charCodeAt(0)
    const toFile = move.to.charCodeAt(0)
    const movedPiece = next.get(move.to as Square)
    if (movedPiece?.type === 'k' && Math.abs(toFile - fromFile) === 2) {
      chessSounds.castle()
      return
    }
    chessSounds.move()
  } catch {
    chessSounds.move()
  }
}
