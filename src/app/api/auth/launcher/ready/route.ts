import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { privateHeaders } from '@/lib/launcher-auth';

export async function GET() {
  if (!process.env.DISCORD_CLIENT_ID?.trim() || !process.env.DISCORD_CLIENT_SECRET?.trim()) {
    return NextResponse.json({ error: 'La connexion Discord est indisponible sur le site. Réessayez plus tard.' }, { status: 503, headers: privateHeaders });
  }
  try {
    await prisma.launcherCode.findFirst({ select: { codeHash: true } });
    return NextResponse.json({ ready: true }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: 'Le service de connexion est temporairement indisponible. Réessayez dans un instant.' }, { status: 503, headers: privateHeaders });
  }
}
