import { NextResponse } from 'next/server';
import { getLauncherUser, launcherProfile, privateHeaders } from '@/lib/launcher-auth';

export async function GET(request: Request) {
  const user = await getLauncherUser(request);
  return user
    ? NextResponse.json(launcherProfile(user), { headers: privateHeaders })
    : NextResponse.json({ error: 'Connexion Discord requise' }, { status: 401, headers: privateHeaders });
}
