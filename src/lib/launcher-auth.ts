import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { hashCredential, LAUNCHER_LIFETIME_MS } from './launcher-protocol';
import type { Prisma } from '@prisma/client';

export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

const SAFE_HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

export function getAppOrigin(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  const forwardedHost =
    process.env.TRUST_PROXY_HEADERS === 'true' ? request.headers.get('x-forwarded-host') : null;
  const rawHost = forwardedHost || request.headers.get('host');
  const host = rawHost?.split(',')[0]?.trim();
  const protoHeader =
    process.env.TRUST_PROXY_HEADERS === 'true' ? request.headers.get('x-forwarded-proto') : null;
  const proto =
    protoHeader === 'http' || protoHeader === 'https'
      ? protoHeader
      : request.url.startsWith('https')
        ? 'https'
        : 'http';
  if (
    host &&
    SAFE_HOST_RE.test(host) &&
    !host.includes('localhost') &&
    !host.includes('127.0.0.1') &&
    !host.includes('web') &&
    !host.includes('launched_web')
  ) {
    return `${proto}://${host}`;
  }

  return envUrl || new URL(request.url).origin;
}

export function serveJailedSessionFile(
  rootDir: string,
  parts: string[],
  options: {
    fallbackSubdir?: string;
    forbiddenNames?: ReadonlySet<string>;
    mimeByExtension?: Record<string, string>;
    extraHeaders?: Record<string, string>;
    notFoundMessage?: string;
  } = {},
): NextResponse {
  const resolvedRoot = path.resolve(/*turbopackIgnore: true*/ rootDir);
  let requestedPath = path.resolve(/*turbopackIgnore: true*/ resolvedRoot, ...parts);

  // 1. Lexical path traversal check
  const lexicalRelative = path.relative(resolvedRoot, requestedPath);
  if (lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
  }

  if (options.forbiddenNames?.has(path.basename(requestedPath))) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
  }

  if (!fs.existsSync(requestedPath) && options.fallbackSubdir) {
    const fallbackPath = path.resolve(
      /*turbopackIgnore: true*/ resolvedRoot,
      options.fallbackSubdir,
      lexicalRelative,
    );
    if (!fs.existsSync(fallbackPath)) {
      return NextResponse.json(
        { error: options.notFoundMessage ?? 'File not found' },
        { status: 404 },
      );
    }
    requestedPath = fallbackPath;
  } else if (!fs.existsSync(requestedPath)) {
    return NextResponse.json(
      { error: options.notFoundMessage ?? 'File not found' },
      { status: 404 },
    );
  }

  // 2. Reject symlinks
  if (fs.lstatSync(requestedPath).isSymbolicLink()) {
    return NextResponse.json({ error: 'Access Denied: Symlinks not allowed' }, { status: 403 });
  }

  // 3. Physical realpath jail verification
  const realRoot = fs.realpathSync(resolvedRoot);
  const realRequestedPath = fs.realpathSync(requestedPath);
  const realRelative = path.relative(realRoot, realRequestedPath);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
  }

  const stat = fs.statSync(realRequestedPath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: 'Not a file' }, { status: 400 });
  }

  const ext = path.extname(realRequestedPath).toLowerCase();
  const contentType = options.mimeByExtension?.[ext] ?? 'application/octet-stream';

  const nodeStream = fs.createReadStream(realRequestedPath);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Length': stat.size.toString(),
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      ...options.extraHeaders,
      ...privateHeaders,
    },
  });
}

export async function getLauncherUser(request: Request) {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer (ln_[A-Za-z0-9_-]{43})$/i)?.[1];
  if (!token) return null;
  const session = await prisma.launcherToken.findUnique({
    where: { tokenHash: hashCredential(token) },
    include: { user: true },
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

export function visibleSessions(
  user: { id: string; discordId: string } | null,
): Prisma.SessionWhereInput {
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
    return {
      response: NextResponse.json(
        { error: 'Connexion Discord expirée ou invalide' },
        { status: 401, headers: privateHeaders },
      ),
    };
  }
  const session = await prisma.session.findFirst({
    where: { slug, ...visibleSessions(user) },
    include: { links: true },
  });
  if (!session)
    return {
      response: NextResponse.json(
        { error: 'Session introuvable ou accès refusé' },
        { status: 404, headers: privateHeaders },
      ),
    };
  return { session };
}

export async function createLauncherCode(userId: string, challenge: string) {
  await Promise.all([
    prisma.launcherCode.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.launcherToken.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
  ]);
  const code = crypto.randomBytes(32).toString('base64url');
  await prisma.launcherCode.create({
    data: {
      codeHash: hashCredential(code),
      userId,
      challenge,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return code;
}

export function launcherProfile(user: {
  discordId: string;
  username: string;
  avatar: string | null;
}) {
  return { discordId: user.discordId, username: user.username, avatar: user.avatar };
}

export async function accessEntries(identifiers: string[]) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { discordId: { in: identifiers } },
        { username: { in: identifiers, mode: 'insensitive' } },
      ],
    },
    select: { username: true, discordId: true },
  });
  return identifiers.map((identifier) => ({
    identifier,
    discordId: /^\d{17,20}$/.test(identifier)
      ? identifier
      : (users.find((u) => u.username.toLowerCase() === identifier)?.discordId ?? null),
  }));
}
