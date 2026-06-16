'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Smile, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AVATAR_DEFS } from '@/lib/avatars';
import { cn } from '@/lib/utils';

export default function SettingsClient({
  displayName,
  username,
  emoji,
  level,
}: {
  displayName: string;
  username: string;
  emoji: string;
  level: number;
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(emoji);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function pickAvatar(e: string, unlockLevel: number) {
    if (level < unlockLevel) {
      toast.info(`That avatar unlocks at Level ${unlockLevel}. Keep playing!`);
      return;
    }
    const prev = avatar;
    setAvatar(e);
    const res = await fetch('/api/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: e }),
    });
    if (res.ok) {
      toast.success('Avatar updated!');
      router.refresh();
    } else {
      setAvatar(prev);
      toast.error('Could not update avatar.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (next.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || 'Could not change password.');
        return;
      }
      toast.success('Password changed!');
      setCurrent('');
      setNext('');
      setConfirm('');
    } finally {
      setSaving(false);
    }
  }

  const input =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring';

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-4xl">{avatar}</span>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            {displayName} · @{username}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Smile className="h-4 w-4 text-primary" /> Your avatar
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_DEFS.map(({ emoji: e, unlockLevel }) => {
            const locked = level < unlockLevel;
            return (
              <button
                key={e}
                type="button"
                onClick={() => pickAvatar(e, unlockLevel)}
                title={locked ? `Unlocks at Level ${unlockLevel}` : undefined}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-all',
                  avatar === e ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40',
                  locked && 'opacity-40'
                )}
                aria-label={locked ? `${e}, locked until level ${unlockLevel}` : `Choose ${e}`}
              >
                {e}
                {locked && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground ring-1 ring-border">
                    <Lock className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Unlock more avatars by leveling up. You&apos;re Level {level}.</p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <KeyRound className="h-4 w-4 text-primary" /> Change password
        </h2>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Current password</label>
          <input type="password" autoComplete="current-password" className={input} value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">New password</label>
          <input type="password" autoComplete="new-password" className={input} value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Confirm new password</label>
          <input type="password" autoComplete="new-password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </main>
  );
}
