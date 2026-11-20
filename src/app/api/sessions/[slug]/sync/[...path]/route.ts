import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { authorizeSession, privateHeaders } from "@/lib/launcher-auth";
import { getSessionPhysicalPath } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path: pathParts } = await params;

  try {
    const authorization = await authorizeSession(request, slug);
    if (authorization.response) return authorization.response;
    const session = authorization.session;

    const syncRootDir = path.resolve(/*turbopackIgnore: true*/ getSessionPhysicalPath(session.id), "sync");
    let requestedPath = path.resolve(/*turbopackIgnore: true*/ syncRootDir, ...pathParts);

    // 1. Lexical Path Traversal Check
    const lexicalRelative = path.relative(syncRootDir, requestedPath);
    if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const fileName = path.basename(requestedPath);
    if (fileName === "index.php" || fileName === ".htaccess") {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (!fs.existsSync(requestedPath)) {
      // v1 manifests expose destination paths without the mandatory/ prefix.
      // Existing exact paths take precedence; otherwise resolve the mandatory
      // source, including legitimate nested folders named mandatory or optional.
      const mandatoryPath = path.resolve(/*turbopackIgnore: true*/ syncRootDir, "mandatory", lexicalRelative);
      if (!fs.existsSync(mandatoryPath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      requestedPath = mandatoryPath;
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
        "X-Content-Type-Options": "nosniff",
        ...privateHeaders,
      },
    });
  } catch (err) {
    console.error(`[File Stream] Error serving file for ${slug}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
