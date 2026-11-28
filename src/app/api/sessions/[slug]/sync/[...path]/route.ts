import { NextResponse } from 'next/server';
import path from 'path';
import { authorizeSession, serveJailedSessionFile } from '@/lib/launcher-auth';
import { getSessionPhysicalPath } from '@/lib/sftpgo';

export const dynamic = 'force-dynamic';

const FORBIDDEN_SYNC_FILES = new Set(['index.php', '.htaccess']);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path: pathParts } = await params;

  try {
    const authorization = await authorizeSession(request, slug);
    if (authorization.response) return authorization.response;

    const syncRootDir = path.join(getSessionPhysicalPath(authorization.session.id), 'sync');
    return serveJailedSessionFile(syncRootDir, pathParts, {
      fallbackSubdir: 'mandatory',
      forbiddenNames: FORBIDDEN_SYNC_FILES,
    });
  } catch (err) {
    console.error(`[File Stream] Error serving file for ${slug}:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
