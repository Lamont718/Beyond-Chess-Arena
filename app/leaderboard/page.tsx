import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const players = await prisma.user.findMany({ orderBy: [{ rating: 'desc' }, { wins: 'desc' }] });

  return (
    <>
      <NavBar me={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">🏆 Leaderboard</h1>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">W</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">L</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">D</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr
                  key={p.id}
                  className={cn('border-t border-border', p.id === me.id && 'bg-primary/10')}
                >
                  <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/players/${p.username}`} className="flex items-center gap-2 hover:underline">
                      <span className="text-lg">{p.emoji}</span>
                      <span className="font-medium text-foreground">{p.displayName}</span>
                      {p.role === 'COACH' && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                          COACH
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{p.rating}</td>
                  <td className="hidden px-4 py-3 text-right text-emerald-400 sm:table-cell">{p.wins}</td>
                  <td className="hidden px-4 py-3 text-right text-rose-400 sm:table-cell">{p.losses}</td>
                  <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">{p.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
