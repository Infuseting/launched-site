import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionPresenceForLauncher } from "@/lib/discord-presence";
import { getLauncherUser, visibleSessions, privateHeaders } from '@/lib/launcher-auth';

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

export async function GET(request: Request) {
  try {
    const user = await getLauncherUser(request);
    if (!user && request.headers.has('authorization')) {
      return NextResponse.json({ error: 'Connexion Discord expirée ou invalide' }, { status: 401, headers: privateHeaders });
    }
    const origin = getAppOrigin(request);

    const sessions = await prisma.session.findMany({
      where: visibleSessions(user),
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
      discordPresence: sessionPresenceForLauncher(s.discordPresence),
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
        ...privateHeaders,
      },
    });
  } catch (err) {
    console.error("[API Sessions] Failed to retrieve sessions:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: privateHeaders });
  }
}
