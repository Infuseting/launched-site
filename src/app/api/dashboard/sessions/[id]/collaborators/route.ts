import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSessionOwner } from '@/lib/api/middleware';
import { addCollaboratorSchema } from '@/lib/validations/collaborator.schema';
import { resyncUserSftp } from '@/lib/sftp-credentials';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withSessionOwner(request, id, async () => {
    const rawBody = await request.json();
    const validated = addCollaboratorSchema.parse(rawBody);

    // Find target user
    const targetUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: validated.username,
          mode: 'insensitive',
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          error: `Aucun utilisateur trouvé avec le pseudo "${validated.username}" (l'utilisateur doit s'être connecté au moins une fois au site)`,
        },
        { status: 404 },
      );
    }

    // Check if already a member
    const existingMember = await prisma.sessionMember.findUnique({
      where: {
        userId_sessionId: {
          userId: targetUser.id,
          sessionId: id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'Cet utilisateur a déjà accès à cette session' },
        { status: 400 },
      );
    }

    await prisma.sessionMember.create({
      data: {
        userId: targetUser.id,
        sessionId: id,
        role: 'COLLABORATOR',
      },
    });

    // Mount virtual folder in target user's SFTP account
    await resyncUserSftp(targetUser);

    return NextResponse.json({
      success: true,
      collaborator: {
        id: targetUser.id,
        username: targetUser.username,
        avatar: targetUser.avatar,
        role: 'COLLABORATOR',
      },
    });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withSessionOwner(request, id, async ({ user }) => {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'Identifiant utilisateur requis' }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        {
          error:
            'Le propriétaire ne peut pas se retirer lui-même (utilisez le transfert de propriété)',
        },
        { status: 400 },
      );
    }

    await prisma.sessionMember.delete({
      where: {
        userId_sessionId: {
          userId: targetUserId,
          sessionId: id,
        },
      },
    });

    // Unmount virtual folder in target user's SFTP account
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (targetUser) {
      await resyncUserSftp(targetUser);
    }

    return NextResponse.json({ success: true });
  });
}
