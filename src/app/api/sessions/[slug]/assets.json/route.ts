import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authorizeSession, privateHeaders } from "@/lib/launcher-auth";
import { getSessionPhysicalPath } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

function getAppOrigin(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1") && !host.includes("web") && !host.includes("launched_web")) {
    return `${proto}://${host}`;
  }

  return envUrl || new URL(request.url).origin;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const origin = getAppOrigin(request);

  try {
    const authorization = await authorizeSession(request, slug);
    if (authorization.response) return authorization.response;
    const session = authorization.session;

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
        ...privateHeaders,
      },
    });
  } catch (err) {
    console.error(`[Assets Metadata] Error for session ${slug}:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
