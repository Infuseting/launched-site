import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionPhysicalPath } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const reqOrigin = new URL(request.url).origin;
  const origin = (reqOrigin.includes("localhost") || reqOrigin.includes("127.0.0.1"))
    ? reqOrigin
    : (process.env.NEXT_PUBLIC_APP_URL || reqOrigin);

  try {
    const session = await prisma.session.findUnique({
      where: { slug },
      include: { links: true },
    });

    if (!session || !session.showInLauncher) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const assetsDir = path.join(getSessionPhysicalPath(session.id), "assets");

    try {
      await fs.access(assetsDir);
    } catch {
      await fs.mkdir(assetsDir, { recursive: true });
    }

    let files: string[] = [];
    try {
      files = await fs.readdir(assetsDir);
    } catch {
      files = [];
    }

    // Detect backgrounds (supports multiple for auto-rotation)
    const backgroundFiles = files.filter((f) =>
      /^background|^bg/i.test(f) && /\.(png|jpg|jpeg|webp)$/i.test(f)
    );

    let background: string | string[];
    if (backgroundFiles.length > 1) {
      background = backgroundFiles.map(
        (f) => `${origin}/api/sessions/${slug}/assets/${encodeURIComponent(f)}`
      );
    } else if (backgroundFiles.length === 1) {
      background = `${origin}/api/sessions/${slug}/assets/${encodeURIComponent(backgroundFiles[0])}`;
    } else {
      // Fallback default placeholder
      background = `${origin}/hero.png`;
    }

    // Detect logo
    const logoFile = files.find((f) =>
      /^logo\./i.test(f) && /\.(png|svg|webp|jpg)$/i.test(f)
    );
    const logo = logoFile
      ? `${origin}/api/sessions/${slug}/assets/${encodeURIComponent(logoFile)}`
      : undefined;

    // Detect icon
    const iconFile = files.find((f) =>
      /^icon\./i.test(f) && /\.(png|svg|ico|webp)$/i.test(f)
    );
    const icon = iconFile
      ? `${origin}/api/sessions/${slug}/assets/${encodeURIComponent(iconFile)}`
      : undefined;

    const metadata = {
      background,
      logo,
      icon,
      links: session.links.map((l) => ({
        name: l.name,
        url: l.url,
        icon: l.icon.startsWith("http")
          ? l.icon
          : `${origin}${l.icon.startsWith("/") ? "" : "/"}${l.icon}`,
      })),
    };

    return NextResponse.json(metadata, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    console.error(`[Assets Metadata] Error for session ${slug}:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
