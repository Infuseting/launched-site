import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionPhysicalPath } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path: pathParts } = await params;

  try {
    const session = await prisma.session.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!session || !session.isActive) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const syncRootDir = path.resolve(getSessionPhysicalPath(session.id), "sync");
    const requestedPath = path.resolve(syncRootDir, ...pathParts);

    // 1. Lexical Path Traversal Check
    const lexicalRelative = path.relative(syncRootDir, requestedPath);
    if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (!fs.existsSync(requestedPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 2. Reject Symbolic Links (prevent symlink escape to /etc/passwd or /root)
    const lstat = fs.lstatSync(requestedPath);
    if (lstat.isSymbolicLink()) {
      return NextResponse.json({ error: "Access Denied: Symlinks not allowed" }, { status: 403 });
    }

    // 3. Physical Realpath Jail Verification
    const realSyncRoot = fs.realpathSync(syncRootDir);
    const realRequestedPath = fs.realpathSync(requestedPath);
    const realRelative = path.relative(realSyncRoot, realRequestedPath);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const stat = fs.statSync(realRequestedPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const nodeStream = fs.createReadStream(realRequestedPath);
    // Convert Node.js readable stream to Web ReadableStream
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
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(`[File Stream] Error serving file for ${slug}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
