import { NextResponse } from 'next/server';
import { decryptSecret, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncSftpUser } from '@/lib/sftpgo';

export const dynamic = 'force-dynamic';

const VALID_ROLES = new Set(['ADMIN', 'CREATOR', 'PLAYER']);

async function requireAdmin(request: Request) {
  let user;
  try {
    user = await getCurrentUser(request);
  } catch (err) {
    console.error('[Admin Auth] Storage error:', err);
    return {
      errorResponse: NextResponse.json(
        { error: 'Service temporairement indisponible' },
        { status: 503 },
      ),
    };
  }
  if (!user) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.role !== 'ADMIN') {
    return {
      errorResponse: NextResponse.json({ error: 'Forbidden: Admin required' }, { status: 403 }),
    };
  }
  return { user };
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const users = await prisma.user.findMany({
    include: {
      sessionMembers: {
        include: {
          session: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    discordId: u.discordId,
    username: u.username,
    avatar: u.avatar,
    role: u.role,
    sessionLimit: u.sessionLimit,
    ownedSessionsCount: u.sessionMembers.filter((m) => m.role === 'OWNER').length,
    diskQuotaBytes: Number(u.diskQuotaBytes),
    sftpUsername: u.sftpUsername,
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ currentUserId: user.id, users: formattedUsers });
}

export async function PUT(request: Request) {
  const { user: admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { userId, sessionLimit, diskQuotaBytes, role } = body;

  if (typeof userId !== 'string' || !userId.trim()) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  if (
    sessionLimit !== undefined &&
    (typeof sessionLimit !== 'number' ||
      !Number.isInteger(sessionLimit) ||
      sessionLimit < 0 ||
      sessionLimit > 999)
  ) {
    return NextResponse.json({ error: 'Limite de sessions invalide (0 à 999)' }, { status: 400 });
  }
  if (
    diskQuotaBytes !== undefined &&
    (typeof diskQuotaBytes !== 'number' || !Number.isInteger(diskQuotaBytes) || diskQuotaBytes < 0)
  ) {
    return NextResponse.json({ error: 'Quota disque invalide' }, { status: 400 });
  }
  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.has(role))) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
  }

  if (userId === admin.id && role && role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas révoquer vos propres droits administrateur' },
      { status: 400 },
    );
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessionMembers: {
          include: { session: true },
        },
      },
    });

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(sessionLimit !== undefined ? { sessionLimit } : {}),
        ...(diskQuotaBytes !== undefined ? { diskQuotaBytes: BigInt(diskQuotaBytes) } : {}),
        ...(role === 'ADMIN' || role === 'CREATOR' ? { role } : {}),
      },
      include: {
        sessionMembers: {
          include: { session: true },
        },
      },
    });

    if (updated.sftpUsername) {
      await syncSftpUser({
        username: updated.sftpUsername,
        password: updated.sftpPassword ? decryptSecret(updated.sftpPassword) : undefined,
        diskQuotaBytes: updated.diskQuotaBytes,
        sessions: updated.sessionMembers.map((m) => ({
          sessionId: m.session.id,
          slug: m.session.slug,
          sessionName: m.session.name,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        sessionLimit: updated.sessionLimit,
        diskQuotaBytes: Number(updated.diskQuotaBytes),
        role: updated.role,
      },
    });
  } catch (err) {
    console.error('[Admin Update User] Error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
