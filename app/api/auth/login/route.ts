import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a username and password.' }, { status: 400 });
  }
  const username = parsed.data.username.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }

  await createSession({ userId: user.id, username: user.username, role: user.role });
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

  return NextResponse.json({ ok: true, role: user.role });
}
