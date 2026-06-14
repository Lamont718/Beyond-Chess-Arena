import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { cleanText } from '@/lib/profanity';

export const dynamic = 'force-dynamic';

// GET /api/tournaments → all tournaments, newest first, with player counts.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: { players: { select: { userId: true } } },
  });

  return NextResponse.json({
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      timeControlSec: t.timeControlSec,
      incrementSec: t.incrementSec,
      playerCount: t.players.length,
      joined: t.players.some((p) => p.userId === me.id),
      createdAt: t.createdAt,
    })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  timeControlSec: z.number().int().min(0).max(3600),
  incrementSec: z.number().int().min(0).max(60),
});

// POST /api/tournaments  { name, timeControlSec, incrementSec } — coach only.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'COACH') return NextResponse.json({ error: 'Only a coach can create tournaments.' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a name and time control.' }, { status: 400 });

  const name = cleanText(parsed.data.name).trim();
  if (!name) return NextResponse.json({ error: 'Please choose a different name.' }, { status: 400 });

  const t = await prisma.tournament.create({
    data: {
      name,
      timeControlSec: parsed.data.timeControlSec,
      incrementSec: parsed.data.incrementSec,
      createdById: me.id,
    },
  });

  return NextResponse.json({ ok: true, id: t.id });
}
