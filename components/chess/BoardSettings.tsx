'use client'

import { useEffect, useState } from 'react'
import { FlipVertical2, Settings, Volume2, VolumeX } from 'lucide-react'
import { BOARD_THEMES, BoardTheme } from '@/lib/chess-theme'
import { BoardPreferences, DEFAULT_BOARD_PREFS, loadBoardPrefs, saveBoardPrefs } from '@/lib/chess-preferences'
import { cn } from '@/lib/utils'

interface BoardSettingsProps {
  onFlip?: () => void
  onPrefsChange?: (prefs: BoardPreferences) => void
  className?: string
  orientation?: 'white' | 'black'
}

export default function BoardSettings({ onFlip, onPrefsChange, orientation = 'white', className }: BoardSettingsProps) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<BoardPreferences>(DEFAULT_BOARD_PREFS)

  useEffect(() => {
    setPrefs(loadBoardPrefs())
  }, [])

  function update<K extends keyof BoardPreferences>(key: K, value: BoardPreferences[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    saveBoardPrefs(next)
    onPrefsChange?.(next)
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {onFlip && (
        <button
          type="button"
          onClick={onFlip}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          aria-label="Flip board"
          title={`Flip board (currently ${orientation === 'white' ? 'white' : 'black'} side down)`}
        >
          <FlipVertical2 className="h-4 w-4" />
          <span className="hidden sm:inline">Flip</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => update('sounds', !prefs.sounds)}
        className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
        aria-label={prefs.sounds ? 'Mute board sounds' : 'Enable board sounds'}
        title={prefs.sounds ? 'Mute board sounds' : 'Enable board sounds'}
      >
        {prefs.sounds ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted',
            open && 'bg-muted'
          )}
          aria-label="Board settings"
          aria-expanded={open}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-border bg-popover p-4 shadow-xl">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => update('theme', theme)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all',
                          prefs.theme === theme
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border hover:border-primary/40'
                        )}
                        aria-label={`${theme} theme`}
                      >
                        <div className="grid h-8 w-8 grid-cols-2 overflow-hidden rounded-md ring-1 ring-black/10">
                          <div style={{ backgroundColor: BOARD_THEMES[theme].light }} />
                          <div style={{ backgroundColor: BOARD_THEMES[theme].dark }} />
                          <div style={{ backgroundColor: BOARD_THEMES[theme].dark }} />
                          <div style={{ backgroundColor: BOARD_THEMES[theme].light }} />
                        </div>
                        <span className="text-[10px] font-medium capitalize text-foreground">{theme}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Promotion</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['q', 'r', 'b', 'n', 'ask'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update('autoPromoteTo', opt)}
                        className={cn(
                          'rounded-md border py-1 text-xs font-medium transition-colors',
                          prefs.autoPromoteTo === opt
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        )}
                      >
                        {opt === 'ask' ? 'Ask' : opt === 'q' ? '♕ Q' : opt === 'r' ? '♖ R' : opt === 'b' ? '♗ B' : '♘ N'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {prefs.autoPromoteTo === 'ask' ? 'Pick each promotion.' : 'Auto-promote pawns to this piece.'}
                  </p>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-foreground">
                  <span>Coordinates</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={prefs.showCoordinates}
                    onChange={(e) => update('showCoordinates', e.target.checked)}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-foreground">
                  <span>Right-click arrows</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={prefs.allowArrowDrawing}
                    onChange={(e) => update('allowArrowDrawing', e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
