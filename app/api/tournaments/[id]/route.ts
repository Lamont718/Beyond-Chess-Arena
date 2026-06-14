import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// DELETE /api/tournaments/[id] — coach only. Allowed when the tournament is
// upcoming (cancel) or completed (clean up). Active tournaments can't be
// deleted — end them first.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'COACH') return NextResponse.json({ error: 'Only a coach can delete tournaments.' }, { status: 403 });

  const t = await prisma.tournament.findUnique({ where: { id: params.id } });
  if (!t) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
  if (t.status === 'active') {
    return NextResponse.json({ error: 'End the tournament before deleting it.' }, { status: 400 });
  }

  // Players cascade-delete; tournament games keep their (now dangling) tag, which
  // is harmless since nothing reads it once the tournament is gone.
  await prisma.tournament.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
}
