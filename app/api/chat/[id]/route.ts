import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Coaches can hide any message (moderation). Authors can hide their own.
// We SOFT-delete (set hiddenAt) rather than destroy the row, so coaches retain
// an audit trail of what was said — important for spotting bullying/grooming.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const msg = await prisma.chatMessage.findUnique({ where: { id: params.id } });
  if (!msg) return NextResponse.json({ ok: true }); // already gone

  if (me.role !== 'COACH' && msg.userId !== me.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!msg.hiddenAt) {
    await prisma.chatMessage.update({
      where: { id: params.id },
      data: { hiddenAt: new Date(), deletedById: me.id },
    });
  }
  return NextResponse.json({ ok: true });
}
