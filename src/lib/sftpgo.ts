import fs from "fs/promises";
import path from "path";

const SFTPGO_API_URL = process.env.SFTPGO_API_URL || "http://127.0.0.1:8080/api/v2";
const SFTPGO_API_KEY = process.env.SFTPGO_API_KEY || "";
const SFTPGO_ADMIN_USER = process.env.SFTPGO_ADMIN_USER || "admin";
const SFTPGO_ADMIN_PASSWORD = process.env.SFTPGO_ADMIN_PASSWORD || "";
const STORAGE_BASE_DIR = process.env.STORAGE_BASE_DIR || "/srv/sftpgo/sessions";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (SFTPGO_API_KEY) {
    headers["x-api-key"] = SFTPGO_API_KEY;
    headers["Authorization"] = `Bearer ${SFTPGO_API_KEY}`;
  } else if (SFTPGO_ADMIN_PASSWORD) {
    const basicAuth = Buffer.from(`${SFTPGO_ADMIN_USER}:${SFTPGO_ADMIN_PASSWORD}`).toString("base64");
    headers["Authorization"] = `Basic ${basicAuth}`;
  }

  return headers;
}

/**
 * Returns physical path for a session on the filesystem.
 */
export function getSessionPhysicalPath(sessionId: string): string {
  return path.join(STORAGE_BASE_DIR, sessionId);
}

/**
 * Ensures physical directories exist for a session (/sync and /assets).
 */
export async function ensureSessionDirectories(sessionId: string): Promise<void> {
  const sessionDir = getSessionPhysicalPath(sessionId);
  const syncDir = path.join(sessionDir, "sync");
  const assetsDir = path.join(sessionDir, "assets");

  await fs.mkdir(syncDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
}

/**
 * Checks if a user exists in SFTPGo.
 */
export async function sftpUserExists(username: string): Promise<boolean> {
  if (!SFTPGO_API_KEY && !SFTPGO_ADMIN_PASSWORD) return false;
  try {
    const res = await fetch(`${SFTPGO_API_URL}/users/${encodeURIComponent(username)}`, {
      method: "GET",
      headers: getHeaders(),
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

  try {
    // Check if folder exists
    const checkRes = await fetch(`${SFTPGO_API_URL}/folders/${encodeURIComponent(folderName)}`, {
      method: "GET",
      headers: getHeaders(),
    });

    const folderPayload = {
      name: folderName,
      mapped_path: mappedPath,
      description: `Launched Session: ${sessionName}`,
    };

    if (checkRes.status === 200) {
      await fetch(`${SFTPGO_API_URL}/folders/${encodeURIComponent(folderName)}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(folderPayload),
      });
    } else {
      await fetch(`${SFTPGO_API_URL}/folders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(folderPayload),
      });
    }
  } catch (err) {
    console.warn(`[SFTPGo] Error managing virtual folder ${folderName}:`, err);
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
    console.warn("[SFTPGo] No SFTPGO_API_KEY or SFTPGO_ADMIN_PASSWORD configured. Skipping SFTPGo sync.");
    return false;
  }

  const { username, password, diskQuotaBytes, sessions } = params;

  // Prepare virtual folders list
  const virtualFolders = [];
  for (const s of sessions) {
    const folderName = await ensureSftpFolder(s.sessionId, s.sessionName);
    virtualFolders.push({
      name: folderName,
      virtual_path: `/${s.slug}`,
      quota_size: -1,
    });
  }

  const userPayload: Record<string, unknown> = {
    username,
    status: 1,
    permissions: {
      "/": ["*"],
    },
    quota_size: Number(diskQuotaBytes),
    virtual_folders: virtualFolders,
  };

  if (password) {
    userPayload.password = password;
  }

  try {
    const exists = await sftpUserExists(username);
    if (exists) {
      const res = await fetch(`${SFTPGO_API_URL}/users/${encodeURIComponent(username)}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(userPayload),
      });
      return res.ok;
    } else {
      // Must have a password to create
      if (!password) {
        userPayload.password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-8);
      }
      const res = await fetch(`${SFTPGO_API_URL}/users`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(userPayload),
      });
      return res.ok;
    }
  } catch (err) {
    console.error(`[SFTPGo] Failed to sync user ${username}:`, err);
    return false;
  }
}
