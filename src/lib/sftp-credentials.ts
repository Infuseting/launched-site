import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from '@/lib/auth';
import { syncSftpUser } from '@/lib/sftpgo';

interface UserWithSftp {
  id: string;
  username: string;
  discordId: string;
  sftpUsername: string | null;
  sftpPassword: string | null;
  diskQuotaBytes: bigint;
}

const PLACEHOLDER_SFTP_PASSWORD = 'dummy-encrypted-password';

function resolveStoredSftpPassword(raw: string | null): string | undefined {
  if (!raw || raw === PLACEHOLDER_SFTP_PASSWORD) return undefined;
  return decryptSecret(raw);
}

export function buildSftpUsername(username: string, discordId: string): string {
  const clean = username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  return `u_${clean || 'creator'}_${discordId.slice(-4)}`;
}

export async function ensureUserSftpCredentials<T extends UserWithSftp>(
  user: T,
): Promise<{ user: T; plainPassword: string }> {
  const existingPassword = resolveStoredSftpPassword(user.sftpPassword);
  if (user.sftpUsername && existingPassword) {
    return { user, plainPassword: existingPassword };
  }

  const sftpUsername = user.sftpUsername || buildSftpUsername(user.username, user.discordId);
  const plainPassword = existingPassword ?? crypto.randomBytes(8).toString('hex');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      sftpUsername,
      sftpPassword: encryptSecret(plainPassword),
    },
  });

  return { user: { ...user, ...updated }, plainPassword };
}

export async function resyncUserSftp(user: {
  id: string;
  sftpUsername: string | null;
  sftpPassword: string | null;
  diskQuotaBytes: bigint;
}): Promise<boolean> {
  if (!user.sftpUsername) return true;
  const members = await prisma.sessionMember.findMany({
    where: { userId: user.id },
    include: { session: true },
  });

  return syncSftpUser({
    username: user.sftpUsername,
    password: resolveStoredSftpPassword(user.sftpPassword),
    diskQuotaBytes: user.diskQuotaBytes,
    sessions: members.map((m) => ({
      sessionId: m.session.id,
      slug: m.session.slug,
      sessionName: m.session.name,
    })),
  });
}
