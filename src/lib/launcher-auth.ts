import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { hashCredential, LAUNCHER_LIFETIME_MS } from './launcher-protocol';
import type { Prisma } from '@prisma/client';

export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function getLauncherUser(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (ln_[A-Za-z0-9_-]{43})$/i)?.[1];
  if (!token) return null;
  const session = await prisma.launcherToken.findUnique({
    where: { tokenHash: hashCredential(token) }, include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  // Sliding expiry: regular use does not ask the player to sign in again.
  if (session.expiresAt.getTime() < Date.now() + LAUNCHER_LIFETIME_MS - 24 * 3600 * 1000) {
    const renewed = await prisma.launcherToken.updateMany({
      where: { id: session.id, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(Date.now() + LAUNCHER_LIFETIME_MS) },
    });
    if (!renewed.count) return null;
  }
  return session.user;
}

export function visibleSessions(user: { id: string; discordId: string } | null): Prisma.SessionWhereInput {
  if (!user) return { publicAccess: true };
  return {
    OR: [
      { publicAccess: true },
      { access: { some: { discordId: user.discordId } } },
      { members: { some: { userId: user.id } } },
    ],
  };
}

export async function authorizeSession(request: Request, slug: string) {
  const user = await getLauncherUser(request);
  if (!user && request.headers.has('authorization')) {
    return { response: NextResponse.json({ error: 'Connexion Discord expirée ou invalide' }, { status: 401, headers: privateHeaders }) };
  }
  const session = await prisma.session.findFirst({ where: { slug, ...visibleSessions(user) }, include: { links: true } });
  if (!session) return { response: NextResponse.json({ error: 'Session introuvable ou accès refusé' }, { status: 404, headers: privateHeaders }) };
  return { session };
}

export async function createLauncherCode(userId: string, challenge: string) {
  await Promise.all([
    prisma.launcherCode.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.launcherToken.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
  ]);
  const code = crypto.randomBytes(32).toString('base64url');
  await prisma.launcherCode.create({ data: {
    codeHash: hashCredential(code), userId, challenge, expiresAt: new Date(Date.now() + 60_000),
  } });
  return code;
}

export function launcherProfile(user: { discordId: string; username: string; avatar: string | null }) {
  return { discordId: user.discordId, username: user.username, avatar: user.avatar };
}

export async function accessEntries(identifiers: string[]) {
  const users = await prisma.user.findMany({
    where: { OR: [{ discordId: { in: identifiers } }, { username: { in: identifiers, mode: 'insensitive' } }] },
    select: { username: true, discordId: true },
  });
  return identifiers.map(identifier => ({
    identifier,
    discordId: /^\d{17,20}$/.test(identifier) ? identifier : users.find(u => u.username.toLowerCase() === identifier)?.discordId ?? null,
  }));
}
