import { NextResponse } from "next/server";
import fs from "fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser, getSessionPhysicalPath } from "@/lib/sftpgo";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if member (owner or collaborator)
  const membership = await prisma.sessionMember.findUnique({
    where: {
      userId_sessionId: {
        userId: user.id,
        sessionId: id,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    minecraft,
    forge,
    fabric,
    neoforge,
    quilt,
    syncDir,
    welcome,
    jvmArg,
    credits,
    hostname,
    crack,
    isActive,
    links,
  } = body;

  try {
    const updated = await prisma.session.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(minecraft ? { minecraft: minecraft.trim() } : {}),
        forge: forge !== undefined ? (forge ? forge.trim() : null) : undefined,
        fabric: fabric !== undefined ? (fabric ? fabric.trim() : null) : undefined,
        neoforge: neoforge !== undefined ? (neoforge ? neoforge.trim() : null) : undefined,
        quilt: quilt !== undefined ? (quilt ? quilt.trim() : null) : undefined,
        ...(syncDir !== undefined ? { syncDir: syncDir.trim() } : {}),
        ...(welcome !== undefined ? { welcome: welcome.trim() } : {}),
        ...(jvmArg !== undefined ? { jvmArg: jvmArg.trim() } : {}),
        ...(credits !== undefined ? { credits: credits.trim() } : {}),
        hostname: hostname !== undefined ? (hostname ? hostname.trim() : null) : undefined,
        ...(crack !== undefined ? { crack: Boolean(crack) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    // Update links if provided (max 3)
    if (Array.isArray(links)) {
      const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const validLinks = links.slice(0, 3).filter((l: any) => l.name && l.url);

      await prisma.sessionLink.deleteMany({ where: { sessionId: id } });
      if (validLinks.length > 0) {
        await prisma.sessionLink.createMany({
          data: validLinks.map((l: { name: string; url: string; icon?: string }) => {
            const isDiscord = l.url.toLowerCase().includes("discord") || l.name.toLowerCase().includes("discord");
            const defaultIcon = isDiscord
              ? `${appOrigin}/assets/icons/discord.svg`
              : `${appOrigin}/assets/icons/website.svg`;
            return {
              sessionId: id,
              name: l.name.trim(),
              url: l.url.trim(),
              icon: l.icon && l.icon.trim() ? l.icon.trim() : defaultIcon,
            };
          }),
        });
      }
    }

    return NextResponse.json({ success: true, session: updated });
  } catch (err) {
    console.error("[Update Session] Error:", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be OWNER to delete
  const membership = await prisma.sessionMember.findUnique({
    where: {
      userId_sessionId: {
        userId: user.id,
        sessionId: id,
      },
    },
  });

  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Seul le propriétaire peut supprimer la session" }, { status: 403 });
  }

  try {
    // Get all members before deleting to resync their SFTP
    const members = await prisma.sessionMember.findMany({
      where: { sessionId: id },
      include: { user: true },
    });

    // Delete session from DB
    await prisma.session.delete({ where: { id } });

    // Clean up physical directory
    const sessionDir = getSessionPhysicalPath(id);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[Delete Session] Failed to remove folder ${sessionDir}:`, err);
    }

    // Resync SFTP for each impacted member
    for (const m of members) {
      if (m.user.sftpUsername) {
        const remaining = await prisma.sessionMember.findMany({
          where: { userId: m.user.id },
          include: { session: true },
        });

        await syncSftpUser({
          username: m.user.sftpUsername,
          password: m.user.sftpPassword || undefined,
          diskQuotaBytes: m.user.diskQuotaBytes,
          sessions: remaining.map((rem) => ({
            sessionId: rem.session.id,
            slug: rem.session.slug,
            sessionName: rem.session.name,
          })),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Delete Session] Error:", err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
