'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not log in.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">♞</div>
          <h1 className="text-2xl font-bold tracking-tight">
            BeyondChess <span className="text-primary">Arena</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Log in to play your teammates.</p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Username</label>
            <input
              autoFocus
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="your username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </Button>
          <p className="pt-1 text-center text-xs text-muted-foreground">
            Forgot your login? Ask Coach to reset it.
          </p>
        </form>
      </div>
    </main>
  );
}
