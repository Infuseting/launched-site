import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSftpUser } from "@/lib/sftpgo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || !user.sftpUsername) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let newPassword: string;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 6) {
        return NextResponse.json(
          { error: "Le mot de passe doit comporter au moins 6 caractères" },
          { status: 400 }
        );
      }
      newPassword = body.password;
    } else {
      newPassword = crypto.randomBytes(8).toString("hex");
    }
  } catch {
    newPassword = crypto.randomBytes(8).toString("hex");
  }

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

  // Update in SFTPGo first to ensure validation passes
  const sftpOk = await syncSftpUser({
    username: user.sftpUsername,
    password: newPassword,
    diskQuotaBytes: user.diskQuotaBytes,
    sessions: sessionMappings,
  });

  if (!sftpOk) {
    console.error("[Dashboard] Failed to sync SFTP user password to SFTPGo for user:", user.username);
    return NextResponse.json(
      { error: "Impossible de mettre à jour le mot de passe sur le serveur SFTP" },
      { status: 500 }
    );
  }

  // Update in DB
  await prisma.user.update({
    where: { id: user.id },
    data: { sftpPassword: newPassword },
  });

  return NextResponse.json({
    success: true,
    sftpPassword: newPassword,
  });
}
