import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withAuth, handleApiError } from "@/lib/api/middleware";
import { createSessionSchema } from "@/lib/validations/session.schema";
import { parsePresenceUpdate } from "@/lib/discord-presence";
import { sessionLoaderUpdate } from "@/lib/session-loaders";
import { parseAccessUpdate } from "@/lib/launcher-protocol";
import { accessEntries } from "@/lib/launcher-auth";
import { syncSftpUser, ensureSessionDirectories } from "@/lib/sftpgo";

export async function POST(request: Request) {
  return withAuth(request, async (initialUser) => {
    let user = initialUser;

    // Auto-provision SFTP credentials if missing
    if (!user.sftpUsername || !user.sftpPassword || user.sftpPassword === "dummy-encrypted-password") {
      const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const sftpUsername = user.sftpUsername || `u_${cleanUsername || "creator"}_${user.discordId.slice(-4)}`;
      const sftpPassword = (user.sftpPassword && user.sftpPassword !== "dummy-encrypted-password")
        ? user.sftpPassword
        : crypto.randomBytes(8).toString("hex");

      user = await prisma.user.update({
        where: { id: user.id },
        data: { sftpUsername, sftpPassword },
        include: {
          sessionMembers: {
            include: { session: true },
          },
        },
      });
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

    const rawBody = await request.json();
    const validated = createSessionSchema.parse(rawBody);

    const loaders = sessionLoaderUpdate(rawBody);
    const access = parseAccessUpdate(rawBody);
    const presence = parsePresenceUpdate(rawBody.discordPresence);

    // Generate unique slug
    let baseSlug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!baseSlug) baseSlug = "session";

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.session.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const rawLinks = Array.isArray(validated.links) ? validated.links : [];
    const sessionLinks = rawLinks.slice(0, 3).map((l: { name: string; url: string; icon?: string }) => {
      const isDiscord = l.url.toLowerCase().includes("discord") || l.name.toLowerCase().includes("discord");
      const defaultIcon = isDiscord
        ? `${appOrigin}/assets/icons/discord.svg`
        : `${appOrigin}/assets/icons/website.svg`;
      return {
        name: l.name,
        url: l.url,
        icon: l.icon && l.icon.trim() ? l.icon.trim() : defaultIcon,
      };
    });

    const session = await prisma.session.create({
      data: {
        slug,
        name: validated.name,
        minecraft: validated.minecraft,
        ...loaders,
        discordPresence: presence === null ? Prisma.DbNull : presence,
        publicAccess: access.publicAccess ?? true,
        access: { create: await accessEntries(access.identifiers ?? []) },
        syncDir: validated.syncDir,
        welcome: validated.welcome,
        jvmArg: validated.jvmArg,
        credits: validated.credits ?? `Created by ${user.username}`,
        hostname: validated.hostname || null,
        crack: validated.crack,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        links: {
          create: sessionLinks,
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
  });
}
