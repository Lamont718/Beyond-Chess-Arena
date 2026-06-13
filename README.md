# BeyondChess Arena ♞

A closed, kid-safe chess arena for the BeyondChess program. Kids log in (accounts
created by the coach), find or challenge each other, and play real games with
ticking clocks, Elo ratings, a class leaderboard, profiles, and live spectating.

Reuses the polished BeyondChess board (drag/click moves, legal-move dots, check
glow, promotion picker, board themes, wood-clack sounds).

## Stack
Next.js 14 (App Router) · Prisma · chess.js · react-chessboard · Tailwind ·
cookie sessions (jose). Live sync via ~1s polling — no extra realtime infra.

## Run it locally (Windows / anywhere)

```bash
npm install
npm run db:push      # creates the SQLite dev.db from the schema
npm run db:seed      # creates the coach + 4 demo players
npm run dev          # http://localhost:3000
```

**Logins after seeding**
- Coach: `coach` / `coach123`  → can add players at **/coach**
- Demo kids: `maya`, `leo`, `zoe`, `kai` — all `chess123`

To see two kids play, open one in a normal window and another in an incognito
window, log in as different kids, and challenge each other (or both hit Quick Play
on the same time control).

## Features
- **Quick Play matchmaking** — pick a time control, "Find an opponent" pairs you
  with anyone else seeking the same one.
- **Challenge by name** — challenge any teammate from the Players list.
- **Live clocks** — real ticking blitz/rapid clocks with increment; flagging on
  time ends the game.
- **Rematch · draw offers · resign.**
- **Elo ratings + leaderboard** (K=32) and **W/L/D records**.
- **Profiles** with recent games, and **live spectating** of any game in progress.
- **Coach roster** — create accounts, pick avatars, reset passwords. No public
  signup, so the space stays closed to the program.

## Deploying to production (Vercel + Neon)

SQLite is for local dev only (Vercel's filesystem is ephemeral). For real
classroom use:

1. Create a free Postgres database at **neon.tech** and copy its connection string.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`.
3. Set Vercel env vars: `DATABASE_URL` (the Neon string) and `SESSION_SECRET`
   (a long random string).
4. Deploy. Then run `npx prisma db push` against the Neon URL and
   `npm run db:seed` once to create the coach account.

## Safety notes (it's a kids' space)
- Accounts are **coach-created only** — there is no open sign-up.
- **No free-text chat.** Kids interact only through play, challenges, and the
  leaderboard.
- Sessions are httpOnly signed cookies; passwords are bcrypt-hashed.
