'use client'

import { useEffect } from 'react'
import { Trophy, HeartCrack, Minus, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Confetti from '@/components/Confetti'
import { cn } from '@/lib/utils'

export type GameResult = 'win' | 'loss' | 'draw'
export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'resignation'
  | 'timeout'
  | 'draw-agreement'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-move-rule'

interface GameEndModalProps {
  open: boolean
  result: GameResult
  reason?: GameEndReason
  subtitle?: string
  moveCount?: number
  ratingChange?: number | null
  onPlayAgain?: () => void
  playAgainLabel?: string
  onClose: () => void
  onReview?: () => void
}

const REASON_COPY: Record<GameEndReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  resignation: 'Resignation',
  timeout: 'Time Expired',
  'draw-agreement': 'Draw Agreed',
  'insufficient-material': 'Insufficient Material',
  'threefold-repetition': 'Threefold Repetition',
  'fifty-move-rule': 'Fifty-Move Rule',
}

export default function GameEndModal({
  open,
  result,
  reason,
  subtitle,
  moveCount,
  ratingChange,
  onPlayAgain,
  playAgainLabel = 'Rematch',
  onClose,
  onReview,
}: GameEndModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const isWin = result === 'win'
  const isDraw = result === 'draw'
  const headline = isWin ? 'You Won!' : isDraw ? 'Draw' : 'You Lost'
  const Icon = isWin ? Trophy : isDraw ? Minus : HeartCrack

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      {isWin && <Confetti />}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl bg-card text-card-foreground shadow-2xl ring-1 ring-black/10',
          'animate-zoom-in-95'
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-end-title"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className={cn(
            'flex flex-col items-center gap-3 rounded-t-2xl px-8 py-8',
            isWin && 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
            isDraw && 'bg-gradient-to-br from-slate-400 to-slate-600 text-white',
            !isWin && !isDraw && 'bg-gradient-to-br from-rose-400 to-rose-600 text-white'
          )}
        >
          <div className={cn('rounded-full bg-white/20 p-4 backdrop-blur-sm')}>
            <Icon className="h-10 w-10" />
          </div>
          <h2 id="game-end-title" className="text-3xl font-bold tracking-tight">
            {headline}
          </h2>
          {reason && (
            <p className="text-sm font-medium uppercase tracking-wider text-white/90">by {REASON_COPY[reason]}</p>
          )}
        </div>

        <div className="space-y-4 p-6">
          {subtitle && <p className="text-center text-sm text-muted-foreground">{subtitle}</p>}
          <div className="flex items-center justify-center gap-8 text-sm">
            {typeof moveCount === 'number' && moveCount > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{moveCount}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Moves</p>
              </div>
            )}
            {typeof ratingChange === 'number' && (
              <div className="text-center">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    ratingChange > 0 ? 'text-emerald-500' : ratingChange < 0 ? 'text-rose-500' : 'text-foreground'
                  )}
                >
                  {ratingChange > 0 ? '+' : ''}
                  {ratingChange}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rating</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {onPlayAgain && (
              <Button onClick={onPlayAgain} className="flex-1">
                <RotateCcw className="mr-2 h-4 w-4" />
                {playAgainLabel}
              </Button>
            )}
            {onReview && (
              <Button variant="outline" onClick={onReview} className="flex-1">
                Back to Lobby
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
