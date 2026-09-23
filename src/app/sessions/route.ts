import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const reqOrigin = new URL(request.url).origin;
    const origin = (reqOrigin.includes("localhost") || reqOrigin.includes("127.0.0.1"))
      ? reqOrigin
      : (process.env.NEXT_PUBLIC_APP_URL || reqOrigin);

    const sessions = await prisma.session.findMany({
      where: { showInLauncher: true },
      include: {
        links: true,
      },
      orderBy: { name: "asc" },
    });

    const formattedSessions = sessions.map((s) => ({
      name: s.name,
      minecraft: s.minecraft,
      forge: s.forge || undefined,
      fabric: s.fabric || undefined,
      neoforge: s.neoforge || undefined,
      quilt: s.quilt || undefined,
      syncDir: s.syncDir,
      syncUrl: `${origin}/api/sessions/${s.slug}/sync`,
      assetsPath: `${origin}/api/sessions/${s.slug}/assets.json`,
      welcome: s.welcome,
      jvmArg: s.jvmArg,
      credits: s.credits,
      hostname: s.hostname || undefined,
      isDefault: false,
      crack: s.crack,
      links: s.links.length > 0
        ? s.links.map((l) => ({
            name: l.name,
            url: l.url,
            icon: l.icon.startsWith("http")
              ? l.icon
              : `${origin}${l.icon.startsWith("/") ? "" : "/"}${l.icon}`,
          }))
        : undefined,
    }));

    return NextResponse.json(formattedSessions, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    console.error("[API Sessions] Failed to retrieve sessions:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
