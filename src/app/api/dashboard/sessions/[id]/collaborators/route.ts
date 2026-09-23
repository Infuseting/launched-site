import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser } from "@/lib/sftpgo";

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
  const membership = await prisma.sessionMember.findUnique({
    where: {
      userId_sessionId: {
        userId: user.id,
        sessionId: id,
      },
    },
    include: { session: true },
  });

  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Seul le propriétaire peut ajouter des collaborateurs" }, { status: 403 });
  }

  const { username } = await request.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Nom d'utilisateur Discord requis" }, { status: 400 });
  }

  // Find target user
  const targetUser = await prisma.user.findFirst({
    where: {
      username: {
        equals: username.trim(),
        mode: "insensitive",
      },
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: `Aucun utilisateur trouvé avec le pseudo "${username}" (l'utilisateur doit s'être connecté au moins une fois au site)` }, { status: 404 });
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
    return NextResponse.json({ error: "Cet utilisateur a déjà accès à cette session" }, { status: 400 });
  }

  try {
    await prisma.sessionMember.create({
      data: {
        userId: targetUser.id,
        sessionId: id,
        role: "COLLABORATOR",
      },
    });

    // Mount virtual folder in target user's SFTP account
    if (targetUser.sftpUsername) {
      const targetSessions = await prisma.sessionMember.findMany({
        where: { userId: targetUser.id },
        include: { session: true },
      });

      await syncSftpUser({
        username: targetUser.sftpUsername,
        password: targetUser.sftpPassword || undefined,
        diskQuotaBytes: targetUser.diskQuotaBytes,
        sessions: targetSessions.map((m) => ({
          sessionId: m.session.id,
          slug: m.session.slug,
          sessionName: m.session.name,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      collaborator: {
        id: targetUser.id,
        username: targetUser.username,
        avatar: targetUser.avatar,
        role: "COLLABORATOR",
      },
    });
  } catch (err) {
    console.error("[Add Collaborator] Error:", err);
    return NextResponse.json({ error: "Failed to add collaborator" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Caller must be OWNER
  const membership = await prisma.sessionMember.findUnique({
    where: {
      userId_sessionId: {
        userId: user.id,
        sessionId: id,
      },
    },
  });

  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Seul le propriétaire peut retirer des collaborateurs" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");

  if (!targetUserId) {
    return NextResponse.json({ error: "Identifiant utilisateur requis" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Le propriétaire ne peut pas se retirer lui-même (utilisez le transfert de propriété)" }, { status: 400 });
  }

  try {
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
    if (targetUser && targetUser.sftpUsername) {
      const remainingSessions = await prisma.sessionMember.findMany({
        where: { userId: targetUser.id },
        include: { session: true },
      });

      await syncSftpUser({
        username: targetUser.sftpUsername,
        password: targetUser.sftpPassword || undefined,
        diskQuotaBytes: targetUser.diskQuotaBytes,
        sessions: remainingSessions.map((m) => ({
          sessionId: m.session.id,
          slug: m.session.slug,
          sessionName: m.session.name,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Remove Collaborator] Error:", err);
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
  }
}
