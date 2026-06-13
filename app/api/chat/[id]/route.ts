import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Coaches can delete any message (moderation). Authors can delete their own.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const msg = await prisma.chatMessage.findUnique({ where: { id: params.id } });
  if (!msg) return NextResponse.json({ ok: true }); // already gone

  if (me.role !== 'COACH' && msg.userId !== me.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await prisma.chatMessage.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
