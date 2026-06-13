'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsClient({
  displayName,
  username,
  emoji,
}: {
  displayName: string;
  username: string;
  emoji: string;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (next.length < 4) {
      toast.error('New password must be at least 4 characters.');
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
        <span className="text-4xl">{emoji}</span>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            {displayName} · @{username}
          </p>
        </div>
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
