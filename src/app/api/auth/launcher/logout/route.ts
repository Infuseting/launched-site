import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashCredential } from '@/lib/launcher-protocol';
import { privateHeaders } from '@/lib/launcher-auth';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (ln_[A-Za-z0-9_-]{43})$/i)?.[1];
  if (token) await prisma.launcherToken.deleteMany({ where: { tokenHash: hashCredential(token) } });
  return NextResponse.json({ success: true }, { headers: privateHeaders });
}
