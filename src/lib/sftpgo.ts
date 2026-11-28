import crypto from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { isDefaultBackground } from './session-background';
import { ensureSyncDirectories } from './session-sync.mjs';

const SFTPGO_API_URL = process.env.SFTPGO_API_URL || 'http://127.0.0.1:8080/api/v2';
const SFTPGO_API_KEY = process.env.SFTPGO_API_KEY || '';
const SFTPGO_ADMIN_USER = process.env.SFTPGO_ADMIN_USER || 'admin';
const SFTPGO_ADMIN_PASSWORD = process.env.SFTPGO_ADMIN_PASSWORD || '';
const STORAGE_BASE_DIR = process.env.STORAGE_BASE_DIR || '/srv/sftpgo/sessions';

export function isSftpConfigured(): boolean {
  return Boolean(SFTPGO_API_KEY || SFTPGO_ADMIN_PASSWORD);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (SFTPGO_API_KEY) {
    headers['x-api-key'] = SFTPGO_API_KEY;
    headers['Authorization'] = `Bearer ${SFTPGO_API_KEY}`;
    return headers;
  }

  if (SFTPGO_ADMIN_PASSWORD) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      headers['Authorization'] = `Bearer ${cachedToken.token}`;
      return headers;
    }

    try {
      const basicAuth = Buffer.from(`${SFTPGO_ADMIN_USER}:${SFTPGO_ADMIN_PASSWORD}`).toString(
        'base64',
      );
      const tokenRes = await fetch(`${SFTPGO_API_URL}/token`, {
        headers: { Authorization: `Basic ${basicAuth}` },
      });
      if (tokenRes.ok) {
        const data = await tokenRes.json();
        if (data.access_token) {
          cachedToken = {
            token: data.access_token,
            expiresAt: Date.now() + 15 * 60 * 1000,
          };
          headers['Authorization'] = `Bearer ${data.access_token}`;
          return headers;
        }
      }
    } catch (err) {
      console.warn('[SFTPGo] Failed to obtain JWT token via basic auth:', err);
    }
  }

  return headers;
}

/**
 * Returns physical path for a session on the filesystem.
 */
export function getSessionPhysicalPath(sessionId: string): string {
  const base = path.isAbsolute(STORAGE_BASE_DIR)
    ? STORAGE_BASE_DIR
    : // Session payloads are mounted at runtime, never bundled with application source.
      path.resolve(/* turbopackIgnore: true */ process.cwd(), STORAGE_BASE_DIR);
  return path.join(base, sessionId);
}

export { SYNC_INDEX_PHP_CONTENT } from './session-sync.mjs';

/**
 * Ensures physical directories exist for a session (/sync and /assets)
 * and provisions the read-only index.php sync scanner in /sync.
 */
export async function ensureSessionDirectories(sessionId: string): Promise<void> {
  const sessionDir = getSessionPhysicalPath(sessionId);
  await ensureSyncDirectories(sessionDir);
  const assetsDir = path.join(sessionDir, 'assets');

  // Provision default background image in assets/ only if no background is present (png, jpg, jpeg, webp)
  const defaultBgSource = path.join(process.cwd(), 'public', 'default-bg.jpg');
  const destBg = path.join(assetsDir, 'background.jpg');
  try {
    const existingFiles: string[] = await fs.readdir(assetsDir).catch(() => [] as string[]);
    const hasCustomBg = existingFiles.some(
      (f: string) => /^background/i.test(f) && /\.(png|jpg|jpeg|webp)$/i.test(f),
    );
    if (!hasCustomBg) {
      await fs.copyFile(defaultBgSource, destBg);
      await fs.chmod(destBg, 0o666).catch(() => {});
      await fs.chown(destBg, 1000, 1000).catch(() => {});
    } else if (existingFiles.includes('background.jpg')) {
      // If a custom background (e.g. background.png) is present and background.jpg matches default-bg, clean up stale default
      if (await isDefaultBackground(destBg)) {
        const otherBgs = existingFiles.filter(
          (f: string) =>
            f !== 'background.jpg' && /^background/i.test(f) && /\.(png|jpg|jpeg|webp)$/i.test(f),
        );
        if (otherBgs.length > 0) {
          await fs.unlink(destBg).catch(() => {});
        }
      }
    }
  } catch {
    // Non-fatal if public asset is not available
  }
}

/**
 * Checks if a user exists in SFTPGo.
 */
export async function sftpUserExists(username: string): Promise<boolean> {
  if (!SFTPGO_API_KEY && !SFTPGO_ADMIN_PASSWORD) return false;
  try {
    const res = await fetch(`${SFTPGO_API_URL}/users/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: await getHeaders(),
    });
    return res.status === 200;
  } catch (err) {
    console.warn(`[SFTPGo] Failed to check user ${username}:`, err);
    return false;
  }
}

/**
 * Creates or updates an SFTPGo virtual folder representing a session.
 */
export async function ensureSftpFolder(sessionId: string, sessionName: string): Promise<string> {
  const folderName = `session_${sessionId}`;
  const mappedPath = getSessionPhysicalPath(sessionId);

  await ensureSessionDirectories(sessionId);

  if (!SFTPGO_API_KEY && !SFTPGO_ADMIN_PASSWORD) return folderName;

  const headers = await getHeaders();
  const checkRes = await fetch(`${SFTPGO_API_URL}/folders/${encodeURIComponent(folderName)}`, {
    method: 'GET',
    headers,
  });

  const folderPayload = {
    name: folderName,
    mapped_path: mappedPath,
    description: `Launched Session: ${sessionName}`,
  };

  const upsertRes =
    checkRes.status === 200
      ? await fetch(`${SFTPGO_API_URL}/folders/${encodeURIComponent(folderName)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(folderPayload),
        })
      : await fetch(`${SFTPGO_API_URL}/folders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(folderPayload),
        });

  if (!upsertRes.ok) {
    throw new Error(
      `[SFTPGo] Failed to upsert virtual folder ${folderName} (HTTP ${upsertRes.status})`,
    );
  }

  return folderName;
}

export interface UserSessionMapping {
  sessionId: string;
  slug: string;
  sessionName: string;
}

/**
 * Synchronizes an SFTP user's credentials and virtual folders in SFTPGo.
 * Mounts /<session_slug> as a virtual folder pointing to the session's physical directory.
 */
export async function syncSftpUser(params: {
  username: string;
  password?: string;
  diskQuotaBytes: bigint | number;
  sessions: UserSessionMapping[];
}): Promise<boolean> {
  if (!SFTPGO_API_KEY && !SFTPGO_ADMIN_PASSWORD) {
    console.warn(
      '[SFTPGo] No SFTPGO_API_KEY or SFTPGO_ADMIN_PASSWORD configured. Skipping SFTPGo sync.',
    );
    return false;
  }

  const { username, password, diskQuotaBytes, sessions } = params;

  try {
    const virtualFolders = await Promise.all(
      sessions.map(async (s) => ({
        name: await ensureSftpFolder(s.sessionId, s.sessionName),
        virtual_path: `/${s.slug}`,
        quota_size: -1,
        quota_files: -1,
      })),
    );

    const userPayload: Record<string, unknown> = {
      username,
      status: 1,
      permissions: {
        '/': ['*'],
      },
      filters: {
        file_patterns: [
          {
            path: '/',
            allowed_patterns: [],
            denied_patterns: ['index.php', '.htaccess'],
            deny_policy: 1, // 1 = Hide: completely removed from directory listings and denied
          },
        ],
      },
      quota_size: Number(diskQuotaBytes),
      virtual_folders: virtualFolders,
    };

    if (password) {
      userPayload.password = password;
    }

    const [exists, headers] = await Promise.all([sftpUserExists(username), getHeaders()]);
    if (exists) {
      const res = await fetch(`${SFTPGO_API_URL}/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(userPayload),
      });
      if (!res.ok) {
        console.error(
          `[SFTPGo] Failed to update user ${username} (HTTP ${res.status}):`,
          await res.text(),
        );
        return false;
      }
      return true;
    } else {
      if (!password) {
        userPayload.password = crypto.randomBytes(12).toString('hex');
      }
      const res = await fetch(`${SFTPGO_API_URL}/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(userPayload),
      });
      if (!res.ok) {
        console.error(
          `[SFTPGo] Failed to create user ${username} (HTTP ${res.status}):`,
          await res.text(),
        );
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error(`[SFTPGo] Failed to sync user ${username}:`, err);
    return false;
  }
}
