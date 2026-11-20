import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { authorizeSession, privateHeaders } from "@/lib/launcher-auth";
import { getSessionPhysicalPath, ensureSessionDirectories } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

// In-memory cache for MD5 hashes keyed by filepath + mtime + size
const md5Cache = new Map<string, string>();

interface SyncFileEntry {
  name: string;
  size: string;
  md5: string;
  type: "mandatory" | "optional";
}

async function computeFileMd5(filePath: string, stats: import("fs").Stats): Promise<string> {
  const cacheKey = `${filePath}:${stats.mtimeMs}:${stats.size}`;
  const cached = md5Cache.get(cacheKey);
  if (cached) return cached;

  const content = await fs.readFile(filePath);
  const hash = crypto.createHash("md5").update(content).digest("hex");
  md5Cache.set(cacheKey, hash);
  return hash;
}

async function scanDirectory(
  dir: string,
  baseDir: string,
  entries: SyncFileEntry[]
): Promise<void> {
  // An incomplete manifest can make the launcher delete valid local files.
  // Propagate storage errors so the request fails instead of returning partial data.
  const items = await fs.readdir(dir);

  for (const item of items) {
    if (item === "index.php" || item === ".htaccess") {
      continue;
    }
    const fullPath = path.join(dir, item);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    const stats = await fs.lstat(fullPath);
    const isOptional = relPath === "optional" || relPath.startsWith("optional/");
    const fileType = isOptional ? "optional" : "mandatory";

    if (stats.isDirectory()) {
      const dirName = relPath.endsWith("/") ? relPath : `${relPath}/`;
      const dirMd5 = crypto.createHash("md5").update(dirName).digest("hex");
      entries.push({
        name: dirName,
        size: "0",
        md5: dirMd5,
        type: fileType,
      });

      await scanDirectory(fullPath, baseDir, entries);
    } else if (stats.isFile()) {
      const md5 = await computeFileMd5(fullPath, stats);
      entries.push({
        name: relPath,
        size: stats.size.toString(),
        md5,
        type: fileType,
      });
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const authorization = await authorizeSession(request, slug);
    if (authorization.response) return authorization.response;
    const session = authorization.session;

    await ensureSessionDirectories(session.id);
    const syncRootDir = path.join(getSessionPhysicalPath(session.id), "sync");

    const entries: SyncFileEntry[] = [];
    await scanDirectory(syncRootDir, syncRootDir, entries);

    const { searchParams } = new URL(request.url);
    const isV1 = searchParams.get("v1") === "true" || searchParams.get("v1") === "1";

    const responsePayload = isV1
      ? entries
          .filter((e) => e.type !== "optional")
          .map(({ name, size, md5 }) => {
            const destination = name.startsWith("mandatory/") ? name.slice("mandatory/".length) : name;
            return {
              name: destination,
              size,
              md5: destination.endsWith("/")
                ? crypto.createHash("md5").update(destination).digest("hex")
                : md5,
            };
          })
          .filter((entry) => entry.name !== "")
      : entries;

    return NextResponse.json(responsePayload, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...privateHeaders,
      },
    });
  } catch (err) {
    console.error(`[Sync Manifest] Error generating manifest for ${slug}:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
