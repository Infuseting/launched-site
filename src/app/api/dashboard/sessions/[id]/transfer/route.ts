import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Caller must be OWNER
  const callerMember = await prisma.sessionMember.findUnique({
    where: {
      userId_sessionId: {
        userId: user.id,
        sessionId: id,
      },
    },
  });

  if (!callerMember || callerMember.role !== "OWNER") {
    return NextResponse.json({ error: "Seul le propriétaire actuel peut transférer la session" }, { status: 403 });
  }

  const { newOwnerId } = await request.json();
  if (!newOwnerId || typeof newOwnerId !== "string") {
    return NextResponse.json({ error: "Identifiant du nouveau propriétaire requis" }, { status: 400 });
  }

  if (newOwnerId === user.id) {
    return NextResponse.json({ error: "Vous êtes déjà propriétaire de cette session" }, { status: 400 });
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
    return NextResponse.json({ error: "Le destinataire doit d'abord être invité comme collaborateur" }, { status: 400 });
  }

  // Verify recipient has free session quota
  const recipientOwnedCount = await prisma.sessionMember.count({
    where: {
      userId: newOwnerId,
      role: "OWNER",
    },
  });

  if (recipientOwnedCount >= recipientMember.user.sessionLimit) {
    return NextResponse.json({
      error: `Le destinataire a atteint son quota (${recipientOwnedCount}/${recipientMember.user.sessionLimit} sessions). Il ne peut pas recevoir la session.`
    }, { status: 400 });
  }

  try {
    // Atomic transfer: promote recipient to OWNER, demote caller to COLLABORATOR
    await prisma.$transaction([
      prisma.sessionMember.update({
        where: {
          userId_sessionId: {
            userId: newOwnerId,
            sessionId: id,
          },
        },
        data: { role: "OWNER" },
      }),
      prisma.sessionMember.update({
        where: {
          userId_sessionId: {
            userId: user.id,
            sessionId: id,
          },
        },
        data: { role: "COLLABORATOR" },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Transfer Ownership] Error:", err);
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 });
  }
}
