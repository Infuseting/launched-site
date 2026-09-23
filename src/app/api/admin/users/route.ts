import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin required" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      sessionMembers: {
        include: {
          session: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedUsers = users.map((u) => {
    const ownedCount = u.sessionMembers.filter((m) => m.role === "OWNER").length;
    return {
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      avatar: u.avatar,
      role: u.role,
      sessionLimit: u.sessionLimit,
      ownedSessionsCount: ownedCount,
      diskQuotaBytes: Number(u.diskQuotaBytes),
      sftpUsername: u.sftpUsername,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ users: formattedUsers });
}

export async function PUT(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin required" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, sessionLimit, diskQuotaBytes, role } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessionMembers: {
          include: { session: true },
        },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(sessionLimit !== undefined ? { sessionLimit: Number(sessionLimit) } : {}),
        ...(diskQuotaBytes !== undefined ? { diskQuotaBytes: BigInt(diskQuotaBytes) } : {}),
        ...(role && (role === "ADMIN" || role === "CREATOR") ? { role } : {}),
      },
      include: {
        sessionMembers: {
          include: { session: true },
        },
      },
    });

    // If target has sftp username, resync their quota in SFTPGo
    if (updated.sftpUsername) {
      await syncSftpUser({
        username: updated.sftpUsername,
        password: updated.sftpPassword || undefined,
        diskQuotaBytes: updated.diskQuotaBytes,
        sessions: updated.sessionMembers.map((m) => ({
          sessionId: m.session.id,
          slug: m.session.slug,
          sessionName: m.session.name,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        sessionLimit: updated.sessionLimit,
        diskQuotaBytes: Number(updated.diskQuotaBytes),
        role: updated.role,
      },
    });
  } catch (err) {
    console.error("[Admin Update User] Error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
