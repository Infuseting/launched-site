import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionPhysicalPath } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; file: string[] }> }
) {
  const { slug, file: fileParts } = await params;

  try {
    const session = await prisma.session.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!session || !session.isActive) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const assetsRootDir = path.resolve(getSessionPhysicalPath(session.id), "assets");
    const requestedPath = path.resolve(assetsRootDir, ...fileParts);

    // 1. Lexical Path Traversal Check
    const lexicalRelative = path.relative(assetsRootDir, requestedPath);
    if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (!fs.existsSync(requestedPath)) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // 2. Reject Symbolic Links (prevent symlink escape)
    const lstat = fs.lstatSync(requestedPath);
    if (lstat.isSymbolicLink()) {
      return NextResponse.json({ error: "Access Denied: Symlinks not allowed" }, { status: 403 });
    }

    // 3. Physical Realpath Jail Verification
    const realAssetsRoot = fs.realpathSync(assetsRootDir);
    const realRequestedPath = fs.realpathSync(requestedPath);
    const realRelative = path.relative(realAssetsRoot, realRequestedPath);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const stat = fs.statSync(realRequestedPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const ext = path.extname(realRequestedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const nodeStream = fs.createReadStream(realRequestedPath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Length": stat.size.toString(),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error(`[Asset Stream] Error serving asset for ${slug}:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
