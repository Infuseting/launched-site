import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { launcherProfile, privateHeaders } from '@/lib/launcher-auth';
import { hashCredential, pkceChallenge, LAUNCHER_LIFETIME_MS } from '@/lib/launcher-protocol';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.code) ||
      typeof body.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier)) {
    return NextResponse.json({ error: 'Échange invalide' }, { status: 400, headers: privateHeaders });
  }
  const codeHash = hashCredential(body.code);
  const token = `ln_${crypto.randomBytes(32).toString('base64url')}`;
  const user = await prisma.$transaction(async tx => {
    const code = await tx.launcherCode.findUnique({ where: { codeHash }, include: { user: true } });
    if (!code || code.expiresAt <= new Date() || code.challenge !== pkceChallenge(body.verifier)) return null;
    // Conditional deletion makes redemption single-use even across concurrent requests.
    const consumed = await tx.launcherCode.deleteMany({ where: { codeHash, expiresAt: { gt: new Date() } } });
    if (!consumed.count) return null;
    await tx.launcherToken.create({ data: { tokenHash: hashCredential(token), userId: code.userId, expiresAt: new Date(Date.now() + LAUNCHER_LIFETIME_MS) } });
    return code.user;
  });
  if (!user) return NextResponse.json({ error: 'Code expiré ou invalide' }, { status: 401, headers: privateHeaders });
  return NextResponse.json({ token, user: launcherProfile(user) }, { headers: privateHeaders });
}
