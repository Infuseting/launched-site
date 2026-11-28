import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/auth';
import { withAuth } from '@/lib/api/middleware';
import { updatePasswordSchema } from '@/lib/validations/sftp.schema';
import { syncSftpUser } from '@/lib/sftpgo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withAuth(request, async (user) => {
    if (!user.sftpUsername) {
      return NextResponse.json({ error: 'Compte SFTP introuvable' }, { status: 400 });
    }

    const rawBody = await request.json();
    const validated = updatePasswordSchema.parse(rawBody);
    const newPassword = validated.password || crypto.randomBytes(8).toString('hex');

    const members = await prisma.sessionMember.findMany({
      where: { userId: user.id },
      include: { session: true },
    });

    const sftpOk = await syncSftpUser({
      username: user.sftpUsername,
      password: newPassword,
      diskQuotaBytes: user.diskQuotaBytes,
      sessions: members.map((m) => ({
        sessionId: m.session.id,
        slug: m.session.slug,
        sessionName: m.session.name,
      })),
    });

    if (!sftpOk) {
      return NextResponse.json(
        { error: 'Échec de la mise à jour sur le serveur SFTP' },
        { status: 502 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { sftpPassword: encryptSecret(newPassword) },
    });

    return NextResponse.json({
      success: true,
      password: newPassword,
    });
  });
}
