import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withAuth, validateInput } from '@/lib/api/middleware';
import { createSessionSchema } from '@/lib/validations/session.schema';
import { parsePresenceUpdate } from '@/lib/discord-presence';
import { sessionLoaderUpdate } from '@/lib/session-loaders';
import { parseAccessUpdate } from '@/lib/launcher-protocol';
import { accessEntries } from '@/lib/launcher-auth';
import { ensureSessionDirectories } from '@/lib/sftpgo';
import { ensureUserSftpCredentials, resyncUserSftp } from '@/lib/sftp-credentials';

export async function POST(request: Request) {
  return withAuth(request, async (initialUser) => {
    const { user } = await ensureUserSftpCredentials(initialUser);

    // Verify session quota
    const ownedCount = await prisma.sessionMember.count({
      where: {
        userId: user.id,
        role: 'OWNER',
      },
    });

    if (ownedCount >= user.sessionLimit) {
      return NextResponse.json(
        {
          error: `Limite atteinte (${ownedCount}/${user.sessionLimit} sessions). Contactez un administrateur.`,
        },
        { status: 403 },
      );
    }

    const rawBody = await request.json();
    const validated = createSessionSchema.parse(rawBody);

    const loaders = validateInput(() => sessionLoaderUpdate(rawBody));
    const access = validateInput(() => parseAccessUpdate(rawBody));
    const presence = validateInput(() => parsePresenceUpdate(rawBody.discordPresence));

    // Generate unique slug
    let baseSlug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!baseSlug) baseSlug = 'session';

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.session.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const rawLinks = Array.isArray(validated.links) ? validated.links : [];
    const sessionLinks = rawLinks
      .slice(0, 3)
      .map((l: { name: string; url: string; icon?: string }) => {
        const isDiscord =
          l.url.toLowerCase().includes('discord') || l.name.toLowerCase().includes('discord');
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
            role: 'OWNER',
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
    await resyncUserSftp(user);

    return NextResponse.json({ success: true, session });
  });
}
