import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/tournaments/[id]/finish — coach only. Ends an active tournament
// early; any unplayed games are aborted (no rating change) and final standings
// stand as they are.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'COACH') return NextResponse.json({ error: 'Only a coach can end a tournament.' }, { status: 403 });

  const t = await prisma.tournament.findUnique({ where: { id: params.id } });
  if (!t) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
  if (t.status !== 'active') return NextResponse.json({ error: 'Tournament is not active.' }, { status: 400 });

  await prisma.$transaction([
    prisma.game.updateMany({
      where: { tournamentId: t.id, status: 'active' },
      data: { status: 'aborted', endedAt: new Date() },
    }),
    prisma.tournament.update({
      where: { id: t.id },
      data: { status: 'completed', endedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
