import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api/middleware';
import { ensureUserSftpCredentials } from '@/lib/sftp-credentials';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withAuth(request, async (initialUser) => {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('summary') === '1') {
      return NextResponse.json({
        user: {
          id: initialUser.id,
          username: initialUser.username,
          avatar: initialUser.avatar,
          role: initialUser.role,
        },
      });
    }

    const { user, plainPassword } = await ensureUserSftpCredentials(initialUser);

    const [ownedCount, members] = await Promise.all([
      prisma.sessionMember.count({
        where: { userId: user.id, role: 'OWNER' },
      }),
      prisma.sessionMember.findMany({
        where: { userId: user.id },
        include: {
          session: {
            include: {
              links: true,
              access: true,
              members: {
                include: {
                  user: {
                    select: { id: true, username: true, avatar: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const discordIds = [
      ...new Set(
        members.flatMap((m) =>
          m.session.access.flatMap((entry) => (entry.discordId ? [entry.discordId] : [])),
        ),
      ),
    ];
    const players = discordIds.length
      ? await prisma.user.findMany({
          where: { discordId: { in: discordIds } },
          select: { discordId: true, username: true, avatar: true },
        })
      : [];
    const playersById = new Map(players.map((player) => [player.discordId, player]));
    const sessions = members.map((m) => ({
      ...m.session,
      access: m.session.access.map((entry) => ({
        ...entry,
        user: entry.discordId ? (playersById.get(entry.discordId) ?? null) : null,
      })),
      myRole: m.role,
    }));

    const hasSessions = members.length > 0;

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        sessionLimit: user.sessionLimit,
        ownedSessionsCount: ownedCount,
        diskQuotaBytes: Number(user.diskQuotaBytes),
        sftp: hasSessions
          ? {
              host: process.env.SFTPGO_SFTP_HOST || 'localhost',
              port: process.env.SFTPGO_SFTP_PORT || '2022',
              username: user.sftpUsername,
              password: plainPassword,
            }
          : null,
      },
      sessions,
    });
  });
}
