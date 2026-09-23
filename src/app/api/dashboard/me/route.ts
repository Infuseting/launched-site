import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log("[dashboard/me] Host:", request.headers.get("host"), "Cookies:", allCookies.map((c) => c.name));
  let user = await getCurrentUser(request);
  console.log("[dashboard/me] user found:", user ? user.username : "null");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-provision SFTP credentials if missing or placeholder
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

  // Count owned sessions
  const ownedCount = await prisma.sessionMember.count({
    where: {
      userId: user.id,
      role: "OWNER",
    },
  });

  // Fetch all sessions the user has access to
  const members = await prisma.sessionMember.findMany({
    where: { userId: user.id },
    include: {
      session: {
        include: {
          links: true,
          members: {
            include: {
              user: {
                select: { id: true, username: true, avatar: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sessions = members.map((m) => ({
    ...m.session,
    myRole: m.role,
  }));

  // Sync SFTPGo only if the user has at least one session (instance)
  // No session = no SFTPGo account created/updated
  if (user.sftpUsername && members.length > 0) {
    try {
      await syncSftpUser({
        username: user.sftpUsername,
        password: user.sftpPassword || undefined,
        diskQuotaBytes: user.diskQuotaBytes,
        sessions: members.map((m) => ({
          sessionId: m.session.id,
          slug: m.session.slug,
          sessionName: m.session.name,
        })),
      });
    } catch (err) {
      console.warn("[dashboard/me] SFTP sync warning:", err);
    }
  }

  // Only expose SFTP credentials if the user actually has sessions
  const hasSessions = members.length > 0;

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      sessionLimit: user.sessionLimit,
      ownedSessionsCount: ownedCount,
      diskQuotaBytes: Number(user.diskQuotaBytes),
      sftp: hasSessions
        ? {
            host: process.env.SFTPGO_SFTP_HOST || "localhost",
            port: process.env.SFTPGO_SFTP_PORT || "2022",
            username: user.sftpUsername,
            password: user.sftpPassword,
          }
        : null,
    },
    sessions,
  });
}
