import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(
  username: string,
  displayName: string,
  password: string,
  role: 'COACH' | 'KID',
  emoji: string
) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { username },
    update: { displayName, role, emoji },
    create: { username, displayName, passwordHash, role, emoji },
  });
}

async function main() {
  await upsertUser('coach', 'Coach Lamont', 'coach123', 'COACH', '🦁');

  // A few demo players so the lobby isn't empty on first run.
  await upsertUser('maya', 'Maya', 'chess123', 'KID', '🦄');
  await upsertUser('leo', 'Leo', 'chess123', 'KID', '🦊');
  await upsertUser('zoe', 'Zoe', 'chess123', 'KID', '🐼');
  await upsertUser('kai', 'Kai', 'chess123', 'KID', '🚀');

  console.log('Seeded. Coach login: coach / coach123  ·  Demo kids: maya|leo|zoe|kai / chess123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
