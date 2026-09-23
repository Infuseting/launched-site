import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionPhysicalPath, ensureSessionDirectories } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

// In-memory cache for MD5 hashes keyed by filepath + mtime + size
const md5Cache = new Map<string, string>();

interface SyncFileEntry {
  name: string;
  size: string;
  md5: string;
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
  let items: string[];
  try {
    items = await fs.readdir(dir);
  } catch {
    return;
  }

  for (const item of items) {
    if (item === "index.php" || item === ".htaccess") {
      continue;
    }
    const fullPath = path.join(dir, item);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    try {
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        const dirName = relPath.endsWith("/") ? relPath : `${relPath}/`;
        const dirMd5 = crypto.createHash("md5").update(dirName).digest("hex");
        entries.push({
          name: dirName,
          size: "0",
          md5: dirMd5,
        });

        await scanDirectory(fullPath, baseDir, entries);
      } else if (stats.isFile()) {
        const md5 = await computeFileMd5(fullPath, stats);
        entries.push({
          name: relPath,
          size: stats.size.toString(),
          md5,
        });
      }
    } catch (err) {
      console.warn(`[Sync Scanner] Failed to process ${fullPath}:`, err);
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const session = await prisma.session.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!session || !session.isActive) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await ensureSessionDirectories(session.id);
    const syncRootDir = path.join(getSessionPhysicalPath(session.id), "sync");

    const entries: SyncFileEntry[] = [];
    await scanDirectory(syncRootDir, syncRootDir, entries);

    return NextResponse.json(entries, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
      },
    });
  } catch (err) {
    console.error(`[Sync Manifest] Error generating manifest for ${slug}:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
