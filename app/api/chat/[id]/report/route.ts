import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// A child (or anyone) can report a message for a coach to review. Flags the row
// for the coach moderation view; never auto-hides (avoids weaponized reporting).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const limit = rateLimit(`report:${me.id}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: 'Please wait before reporting again.' }, { status: 429 });
  }

  const msg = await prisma.chatMessage.findUnique({ where: { id: params.id } });
  if (!msg) return NextResponse.json({ ok: true });

  // Don't let a user inflate reports on their own message; otherwise allow.
  if (msg.userId === me.id) return NextResponse.json({ ok: true });

  await prisma.chatMessage.update({
    where: { id: params.id },
    data: { reportCount: { increment: 1 }, reportedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
