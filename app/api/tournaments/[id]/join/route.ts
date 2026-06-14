import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/tournaments/[id]/join — join (or, with {leave:true}, leave) an
// upcoming tournament. Once started, the roster is locked.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const t = await prisma.tournament.findUnique({ where: { id: params.id } });
  if (!t) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
  if (t.status !== 'upcoming') {
    return NextResponse.json({ error: 'This tournament has already started.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.leave) {
    await prisma.tournamentPlayer.deleteMany({ where: { tournamentId: t.id, userId: me.id } });
    return NextResponse.json({ ok: true, joined: false });
  }

  // Idempotent join (unique constraint guards duplicates).
  await prisma.tournamentPlayer.upsert({
    where: { tournamentId_userId: { tournamentId: t.id, userId: me.id } },
    create: { tournamentId: t.id, userId: me.id },
    update: {},
  });
  return NextResponse.json({ ok: true, joined: true });
}
