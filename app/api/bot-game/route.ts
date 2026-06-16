import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { createGame, assignColors } from '@/lib/game-logic';
import { botByLevel } from '@/lib/bots';

export const dynamic = 'force-dynamic';

const schema = z.object({
  level: z.enum(['rookie', 'easy', 'medium', 'hard']),
  seconds: z.number().int().min(0).max(7200),
  increment: z.number().int().min(0).max(60),
});

// Start a RANKED game against a bot. Bot games always count toward the kid's
// Elo + record (the bot's rating is a fixed anchor — see lib/bots.ts).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { level, seconds, increment } = parsed.data;

  const profile = botByLevel(level);
  if (!profile) return NextResponse.json({ error: 'Unknown bot' }, { status: 400 });

  const bot = await prisma.user.findUnique({ where: { username: profile.username } });
  if (!bot) return NextResponse.json({ error: 'Bots are not set up yet.' }, { status: 503 });

  const { whiteId, blackId } = assignColors(me.id, bot.id);
  const game = await createGame(whiteId, blackId, seconds, increment, { rated: true });
  return NextResponse.json({ gameId: game.id });
}
