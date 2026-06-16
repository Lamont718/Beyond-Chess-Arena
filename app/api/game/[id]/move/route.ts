import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { serializeGame } from '@/lib/serialize';
import { applyMove } from '@/lib/game-logic';
import { maybeBotReply } from '@/lib/bot-move';

export const dynamic = 'force-dynamic';

const schema = z.object({
  from: z.string().min(2).max(2),
  to: z.string().min(2).max(2),
  promotion: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status !== 'active')
    return NextResponse.json({ error: 'Game is over' }, { status: 409 });

  const myColor = game.whiteId === me.id ? 'w' : game.blackId === me.id ? 'b' : null;
  if (!myColor) return NextResponse.json({ error: 'You are not a player in this game' }, { status: 403 });
  if (game.turn !== myColor) return NextResponse.json({ error: 'Not your turn' }, { status: 409 });

  const result = await applyMove(game, myColor, me.id, parsed.data);
  if (result.status === 'illegal') return NextResponse.json({ error: 'Illegal move' }, { status: 400 });
  if (result.status === 'conflict')
    return NextResponse.json({ error: 'Position changed — please retry.' }, { status: 409 });

  // If the opponent is a bot and the game is still going, play its reply now so
  // the move response already carries the bot's answer (snappy, no extra poll).
  if (result.status === 'ok') await maybeBotReply(game.id);

  const after = await prisma.game.findUnique({
    where: { id: game.id },
    include: { white: true, black: true },
  });
  return NextResponse.json({ game: serializeGame(after, me.id) });
}
