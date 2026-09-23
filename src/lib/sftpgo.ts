import fs from "fs/promises";
import path from "path";

const SFTPGO_API_URL = process.env.SFTPGO_API_URL || "http://127.0.0.1:8080/api/v2";
const SFTPGO_API_KEY = process.env.SFTPGO_API_KEY || "";
const SFTPGO_ADMIN_USER = process.env.SFTPGO_ADMIN_USER || "admin";
const SFTPGO_ADMIN_PASSWORD = process.env.SFTPGO_ADMIN_PASSWORD || "";
const STORAGE_BASE_DIR = process.env.STORAGE_BASE_DIR || "/srv/sftpgo/sessions";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (SFTPGO_API_KEY) {
    headers["x-api-key"] = SFTPGO_API_KEY;
    headers["Authorization"] = `Bearer ${SFTPGO_API_KEY}`;
    return headers;
  }

  if (SFTPGO_ADMIN_PASSWORD) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      headers["Authorization"] = `Bearer ${cachedToken.token}`;
      return headers;
    }

    try {
      const basicAuth = Buffer.from(`${SFTPGO_ADMIN_USER}:${SFTPGO_ADMIN_PASSWORD}`).toString("base64");
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
          headers["Authorization"] = `Bearer ${data.access_token}`;
          return headers;
        }
      }
    } catch (err) {
      console.warn("[SFTPGo] Failed to obtain JWT token via basic auth:", err);
    }
  }

  return headers;
}

/**
 * Returns physical path for a session on the filesystem.
 */
export function getSessionPhysicalPath(sessionId: string): string {
  return path.join(STORAGE_BASE_DIR, sessionId);
}

export const SYNC_INDEX_PHP_CONTENT = `<?php
ini_set('display_errors', '0');

ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');
function ScanDirectory($Directory, $tableau=false){
    $slash = '';
        $MyDirectory = opendir($Directory) or die('Erreur');
        while($Entry = @readdir($MyDirectory)){
                if($Entry != '.' && $Entry != '..' && $Entry != 'index.php' && $Entry != ".htaccess"){
                        if(is_dir($Directory.'/'.$Entry)&& $Entry != '.' && $Entry != '..'){
                                $slash = '/';
                        }
            else
            {
                $slash = '';
            }
                        $tableau[] = substr($Directory.'/'.$Entry, strlen(strstr($Directory.'/'.$Entry, '/', true))+1).$slash;
                }
                if(is_dir($Directory.'/'.$Entry)&& $Entry != '.' && $Entry != '..'){
                        $tableau = ScanDirectory($Directory.'/'.$Entry, $tableau);
                }
        }
        closedir($MyDirectory);
        return $tableau;
}

header('Content-type: text/javascript');
echo '['."\\n";
$index = 0;
foreach(ScanDirectory('.') as $key => $value)
{
        $stat = stat($value);
        if($index != 0)
        {
                echo ", "."\\n";
        }
        echo '    {'."\\n";
        echo '        "name":"'.htmlentities($value).'",'."\\n";
        if(is_dir($value)){
                echo '        "md5":"'.md5($value).'",'."\\n";
                echo '        "size":"0"'."\\n";
        }else{
                echo '        "md5":"'.md5_file($value).'",'."\\n";
                echo '        "size":"'.$stat['size'].'"'."\\n";
        }
        echo '    }';
        $index++;
}
echo "\\n".']';

?>
`;

/**
 * Ensures physical directories exist for a session (/sync and /assets)
 * and provisions the read-only index.php sync scanner in /sync.
 */
export async function ensureSessionDirectories(sessionId: string): Promise<void> {
  const sessionDir = getSessionPhysicalPath(sessionId);
  const syncDir = path.join(sessionDir, "sync");
  const assetsDir = path.join(sessionDir, "assets");

  await fs.mkdir(syncDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });

  const indexPhpPath = path.join(syncDir, "index.php");
  try {
    await fs.writeFile(indexPhpPath, SYNC_INDEX_PHP_CONTENT, { encoding: "utf8", mode: 0o444 });
  } catch (err: any) {
    if (err.code === "EACCES") {
      await fs.chmod(indexPhpPath, 0o644).catch(() => {});
      await fs.writeFile(indexPhpPath, SYNC_INDEX_PHP_CONTENT, "utf8");
      await fs.chmod(indexPhpPath, 0o444).catch(() => {});
    }
  }
}

/**
 * Checks if a user exists in SFTPGo.
 */
export async function sftpUserExists(username: string): Promise<boolean> {
  if (!SFTPGO_API_KEY && !SFTPGO_ADMIN_PASSWORD) return false;
  try {
    const res = await fetch(`${SFTPGO_API_URL}/users/${encodeURIComponent(username)}`, {
      method: "GET",
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

  try {
    // Check if folder exists
    const checkRes = await fetch(`${SFTPGO_API_URL}/folders/${encodeURIComponent(folderName)}`, {
      method: "GET",
      headers: await getHeaders(),
    });

    const folderPayload = {
      name: folderName,
      mapped_path: mappedPath,
      description: `Launched Session: ${sessionName}`,
    };

    if (checkRes.status === 200) {
      await fetch(`${SFTPGO_API_URL}/folders/${encodeURIComponent(folderName)}`, {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(folderPayload),
      });
    } else {
      await fetch(`${SFTPGO_API_URL}/folders`, {
        method: "POST",
        headers: await getHeaders(),
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
      quota_files: -1,
    });
  }

  const userPayload: Record<string, unknown> = {
    username,
    status: 1,
    permissions: {
      "/": ["*"],
    },
    filters: {
      file_patterns: [
        {
          path: "/",
          allowed_patterns: [],
          denied_patterns: ["index.php", ".htaccess"],
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

  try {
    const exists = await sftpUserExists(username);
    if (exists) {
      const res = await fetch(`${SFTPGO_API_URL}/users/${encodeURIComponent(username)}`, {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(userPayload),
      });
      if (!res.ok) {
        console.error(`[SFTPGo] Failed to update user ${username} (HTTP ${res.status}):`, await res.text());
        return false;
      }
      return true;
    } else {
      // Must have a password to create
      if (!password) {
        userPayload.password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-8);
      }
      const res = await fetch(`${SFTPGO_API_URL}/users`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(userPayload),
      });
      if (!res.ok) {
        console.error(`[SFTPGo] Failed to create user ${username} (HTTP ${res.status}):`, await res.text());
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error(`[SFTPGo] Failed to sync user ${username}:`, err);
    return false;
  }
}
