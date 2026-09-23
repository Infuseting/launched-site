import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser, ensureSessionDirectories } from "@/lib/sftpgo";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify session quota
  const ownedCount = await prisma.sessionMember.count({
    where: {
      userId: user.id,
      role: "OWNER",
    },
  });

  if (ownedCount >= user.sessionLimit) {
    return NextResponse.json(
      { error: `Limite atteinte (${ownedCount}/${user.sessionLimit} sessions). Contactez un administrateur.` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    name,
    minecraft,
    forge,
    fabric,
    neoforge,
    quilt,
    syncDir = "mods,resourcepacks,shaderpacks",
    welcome = "",
    jvmArg = "-Xmx4G",
    credits = `Created by ${user.username}`,
    hostname,
    crack = false,
    isActive = true,
    links = [],
  } = body;

  if (!name || typeof name !== "string" || !minecraft) {
    return NextResponse.json({ error: "Nom et version Minecraft requis" }, { status: 400 });
  }

  // Generate unique slug
  let baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!baseSlug) baseSlug = "session";

  let slug = baseSlug;
  let counter = 1;
  while (await prisma.session.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  try {
    const session = await prisma.session.create({
      data: {
        slug,
        name: name.trim(),
        minecraft: minecraft.trim(),
        forge: forge ? forge.trim() : null,
        fabric: fabric ? fabric.trim() : null,
        neoforge: neoforge ? neoforge.trim() : null,
        quilt: quilt ? quilt.trim() : null,
        syncDir: syncDir.trim(),
        welcome: welcome.trim(),
        jvmArg: jvmArg.trim(),
        credits: credits.trim(),
        hostname: hostname ? hostname.trim() : null,
        crack: Boolean(crack),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        links: {
          create: Array.isArray(links)
            ? links.slice(0, 3).filter((l: any) => l.name && l.url).map((l: { name: string; url: string; icon?: string }) => {
                const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
                const isDiscord = l.url.toLowerCase().includes("discord") || l.name.toLowerCase().includes("discord");
                const defaultIcon = isDiscord
                  ? `${appOrigin}/assets/icons/discord.svg`
                  : `${appOrigin}/assets/icons/website.svg`;
                return {
                  name: l.name.trim(),
                  url: l.url.trim(),
                  icon: l.icon && l.icon.trim() ? l.icon.trim() : defaultIcon,
                };
              })
            : [],
        },
      },
      include: {
        links: true,
      },
    });

    // Ensure physical directories exist (/sync and /assets)
    await ensureSessionDirectories(session.id);

    // Resync user's SFTP folders
    if (user.sftpUsername) {
      const allMembers = await prisma.sessionMember.findMany({
        where: { userId: user.id },
        include: { session: true },
      });

      await syncSftpUser({
        username: user.sftpUsername,
        password: user.sftpPassword || undefined,
        diskQuotaBytes: user.diskQuotaBytes,
        sessions: allMembers.map((m) => ({
          sessionId: m.session.id,
          slug: m.session.slug,
          sessionName: m.session.name,
        })),
      });
    }

    return NextResponse.json({ success: true, session });
  } catch (err) {
    console.error("[Create Session] Error:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
