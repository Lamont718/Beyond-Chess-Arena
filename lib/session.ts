import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

const COOKIE_NAME = 'bca_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
}

export function destroySession() {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

/** Returns the decoded session payload, or null if not logged in / invalid. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      username: String(payload.username),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

/** Full user record for the logged-in session, or null. Also bumps lastSeenAt. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  // Heartbeat: keep "online" status fresh, but avoid a write on every single call.
  const sinceSeen = Date.now() - new Date(user.lastSeenAt).getTime();
  if (sinceSeen > 20_000) {
    prisma.user
      .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  return user;
}
