import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };

export async function GET(request: Request) {
  if (!await getCurrentUser(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().replace(/^@/, '');
  if (query.length < 3) return NextResponse.json({ users: [], hasMore: false }, { headers });
  if (query.length > 100) {
    return NextResponse.json({ error: 'Recherche trop longue.' }, { status: 400, headers });
  }

  try {
    const users = await prisma.user.findMany({
      where: /^\d{17,20}$/.test(query)
        ? { discordId: query }
        : { username: { contains: query, mode: 'insensitive' } },
      select: { discordId: true, username: true, avatar: true },
      orderBy: [{ username: 'asc' }, { discordId: 'asc' }],
      take: 21,
    });
    return NextResponse.json({ users: users.slice(0, 20), hasMore: users.length > 20 }, { headers });
  } catch {
    return NextResponse.json({ error: 'La recherche est indisponible. Réessayez dans un instant.' }, { status: 503, headers });
  }
}
