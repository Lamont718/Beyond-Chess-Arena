'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RosterUser {
  id: string;
  username: string;
  displayName: string;
  emoji: string;
  role: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

const EMOJIS = ['♟️', '🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐙', '🐝', '🚀', '⚡', '🔥', '🌟', '🐉', '🦅'];

export default function RosterClient({ roster }: { roster: RosterUser[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  function suggestUsername(name: string) {
    setDisplayName(name);
    if (!username || username === slug(displayName)) setUsername(slug(name));
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/coach/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, username, password, emoji }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || 'Could not add player.');
        return;
      }
      toast.success(`Added ${displayName} (@${d.username})`);
      setDisplayName('');
      setUsername('');
      setPassword('');
      setEmoji(EMOJIS[0]);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(u: RosterUser) {
    const pw = prompt(`New password for ${u.displayName} (@${u.username}):`);
    if (!pw) return;
    const res = await fetch('/api/coach/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, password: pw }),
    });
    if (res.ok) toast.success(`Password updated for ${u.displayName}`);
    else toast.error((await res.json()).error || 'Could not reset password.');
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Shield className="h-6 w-6 text-emerald-400" /> Coach — Roster
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add each kid an account. Only people you add here can log in. Share their username + password with them.
      </p>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        {/* Add player */}
        <form onSubmit={addPlayer} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <UserPlus className="h-4 w-4 text-primary" /> Add a player
          </h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={displayName}
              onChange={(e) => suggestUsername(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Jordan B."
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(slug(e.target.value))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="jordanb"
              autoCapitalize="none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="at least 4 characters"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Avatar</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all',
                    emoji === e ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Adding…' : 'Add player'}
          </Button>
        </form>

        {/* Roster list */}
        <div>
          <h2 className="mb-3 font-bold">Roster ({roster.length})</h2>
          <div className="space-y-2">
            {roster.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
                <span className="text-2xl">{u.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-foreground">
                    {u.displayName}
                    {u.role === 'COACH' && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                        COACH
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{u.username} · {u.rating} · {u.wins}W/{u.losses}L/{u.draws}D
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => resetPassword(u)}>
                  <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 20);
}
