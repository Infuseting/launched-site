import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser } from "@/lib/sftpgo";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.sftpUsername) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let newPassword: string;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.password && typeof body.password === "string" && body.password.length >= 6) {
      newPassword = body.password;
    } else {
      newPassword = crypto.randomBytes(8).toString("hex");
    }
  } catch {
    newPassword = crypto.randomBytes(8).toString("hex");
  }

  // Update in DB
  await prisma.user.update({
    where: { id: user.id },
    data: { sftpPassword: newPassword },
  });

  // Fetch user's active sessions for SFTPGo mapping
  const members = await prisma.sessionMember.findMany({
    where: { userId: user.id },
    include: { session: true },
  });

  const sessionMappings = members.map((m) => ({
    sessionId: m.session.id,
    slug: m.session.slug,
    sessionName: m.session.name,
  }));

  // Update in SFTPGo
  await syncSftpUser({
    username: user.sftpUsername,
    password: newPassword,
    diskQuotaBytes: user.diskQuotaBytes,
    sessions: sessionMappings,
  });

  return NextResponse.json({
    success: true,
    sftpPassword: newPassword,
  });
}
