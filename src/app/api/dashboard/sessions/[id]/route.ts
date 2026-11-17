import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withSessionMember, withSessionOwner } from "@/lib/api/middleware";
import { updateSessionSchema } from "@/lib/validations/session.schema";
import { parsePresenceUpdate } from "@/lib/discord-presence";
import { sessionLoaderUpdate } from "@/lib/session-loaders";
import { parseAccessUpdate } from "@/lib/launcher-protocol";
import { accessEntries } from "@/lib/launcher-auth";
import { syncSftpUser, getSessionPhysicalPath } from "@/lib/sftpgo";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withSessionMember(request, id, async () => {
    const rawBody = await request.json();
    const validated = updateSessionSchema.parse(rawBody);

    const loaders = sessionLoaderUpdate(rawBody);
    const access = parseAccessUpdate(rawBody);
    const presence = parsePresenceUpdate(rawBody.discordPresence);

    const updated = await prisma.session.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(validated.minecraft ? { minecraft: validated.minecraft } : {}),
        ...loaders,
        discordPresence: presence === null ? Prisma.DbNull : presence,
        publicAccess: access.publicAccess,
        ...(access.identifiers
          ? {
              access: {
                deleteMany: { identifier: { notIn: access.identifiers } },
                upsert: (await accessEntries(access.identifiers)).map((entry) => ({
                  where: { sessionId_identifier: { sessionId: id, identifier: entry.identifier } },
                  create: entry,
                  update: {},
                })),
              },
            }
          : {}),
        ...(validated.syncDir !== undefined ? { syncDir: validated.syncDir } : {}),
        ...(validated.welcome !== undefined ? { welcome: validated.welcome } : {}),
        ...(validated.jvmArg !== undefined ? { jvmArg: validated.jvmArg } : {}),
        ...(validated.credits !== undefined ? { credits: validated.credits } : {}),
        hostname: validated.hostname !== undefined ? (validated.hostname ? validated.hostname.trim() : null) : undefined,
        ...(validated.crack !== undefined ? { crack: Boolean(validated.crack) } : {}),
      },
    });

    if (Array.isArray(validated.links)) {
      const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const validLinks = validated.links.slice(0, 3).filter((l) => l.name && l.url);

      await prisma.sessionLink.deleteMany({ where: { sessionId: id } });
      if (validLinks.length > 0) {
        await prisma.sessionLink.createMany({
          data: validLinks.map((l) => {
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
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withSessionOwner(request, id, async () => {
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
  });
}
