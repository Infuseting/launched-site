import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log("[dashboard/me] Host:", request.headers.get("host"), "Cookies:", allCookies.map((c) => c.name));
  const user = await getCurrentUser();
  console.log("[dashboard/me] user found:", user ? user.username : "null");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      sessionLimit: user.sessionLimit,
      ownedSessionsCount: ownedCount,
      diskQuotaBytes: Number(user.diskQuotaBytes),
      sftp: {
        host: process.env.SFTPGO_SFTP_HOST || "launched.infuseting.fr",
        port: process.env.SFTPGO_SFTP_PORT || "2022",
        username: user.sftpUsername,
        password: user.sftpPassword,
      },
    },
    sessions,
  });
}
