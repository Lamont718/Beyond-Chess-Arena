import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BOTS } from '../lib/bots';

const prisma = new PrismaClient();

// Create the ranked-bot User rows. Bots have role "BOT", a FIXED rating, and an
// unusable password (no one can log in as a bot). Idempotent via upsert.
async function main() {
  for (const b of BOTS) {
    // Random unguessable hash → login attempts as a bot always fail.
    const passwordHash = await bcrypt.hash(`bot-${b.username}-${Math.random()}`, 10);
    await prisma.user.upsert({
      where: { username: b.username },
      // Keep rating pinned to config on every run (bots never drift).
      update: { displayName: b.displayName, role: 'BOT', emoji: b.emoji, rating: b.rating },
      create: { username: b.username, displayName: b.displayName, passwordHash, role: 'BOT', emoji: b.emoji, rating: b.rating },
    });
    console.log(`  ✓ ${b.emoji} ${b.displayName} (${b.rating}, ${b.level})`);
  }
  console.log(`Seeded ${BOTS.length} ranked bots.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
