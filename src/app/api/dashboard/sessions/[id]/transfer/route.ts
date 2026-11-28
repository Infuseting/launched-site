import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSessionOwner } from '@/lib/api/middleware';
import { v } from '@/lib/validations/validator';

const transferOwnerSchema = v.object({
  newOwnerId: v.string().min(1, 'Identifiant du nouveau propriétaire requis').trim(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withSessionOwner(request, id, async ({ user }) => {
    const { newOwnerId } = transferOwnerSchema.parse(await request.json());

    if (newOwnerId === user.id) {
      return NextResponse.json(
        { error: 'Vous êtes déjà propriétaire de cette session' },
        { status: 400 },
      );
    }

    // Verify recipient is currently a member
    const recipientMember = await prisma.sessionMember.findUnique({
      where: {
        userId_sessionId: {
          userId: newOwnerId,
          sessionId: id,
        },
      },
      include: { user: true },
    });

    if (!recipientMember) {
      return NextResponse.json(
        { error: "Le destinataire doit d'abord être invité comme collaborateur" },
        { status: 400 },
      );
    }

    // Verify recipient has free session quota
    const recipientOwnedCount = await prisma.sessionMember.count({
      where: {
        userId: newOwnerId,
        role: 'OWNER',
      },
    });

    if (recipientOwnedCount >= recipientMember.user.sessionLimit) {
      return NextResponse.json(
        {
          error: `Le destinataire a atteint son quota (${recipientOwnedCount}/${recipientMember.user.sessionLimit} sessions). Il ne peut pas recevoir la session.`,
        },
        { status: 400 },
      );
    }

    // Atomic transfer: promote recipient to OWNER, demote caller to COLLABORATOR
    await prisma.$transaction([
      prisma.sessionMember.update({
        where: {
          userId_sessionId: {
            userId: newOwnerId,
            sessionId: id,
          },
        },
        data: { role: 'OWNER' },
      }),
      prisma.sessionMember.update({
        where: {
          userId_sessionId: {
            userId: user.id,
            sessionId: id,
          },
        },
        data: { role: 'COLLABORATOR' },
      }),
    ]);

    return NextResponse.json({ success: true });
  });
}
