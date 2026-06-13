'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Crown, Trophy, Eye, Users, LogOut, Shield, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import InstallButton from '@/components/InstallButton';

interface NavBarProps {
  me: { displayName: string; username: string; emoji: string; rating: number; role: string };
}

const LINKS = [
  { href: '/', label: 'Play', icon: Crown },
  { href: '/computer', label: 'Computer', icon: Bot },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/watch', label: 'Watch', icon: Eye },
  { href: '/players', label: 'Players', icon: Users },
];

export default function NavBar({ me }: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-2 flex items-center gap-2">
          <span className="text-xl">♞</span>
          <span className="hidden font-bold tracking-tight text-foreground sm:inline">
            BeyondChess <span className="text-primary">Arena</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          {me.role === 'COACH' && (
            <Link
              href="/coach"
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith('/coach')
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Coach</span>
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <InstallButton />
          <Link href={`/players/${me.username}`} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
            <span className="text-lg">{me.emoji}</span>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold text-foreground">{me.displayName}</div>
              <div className="text-xs text-muted-foreground">{me.rating}</div>
            </div>
          </Link>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
