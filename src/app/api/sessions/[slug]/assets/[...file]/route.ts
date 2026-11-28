import { NextResponse } from 'next/server';
import path from 'path';
import { authorizeSession, serveJailedSessionFile } from '@/lib/launcher-auth';
import { getSessionPhysicalPath } from '@/lib/sftpgo';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; file: string[] }> },
) {
  const { slug, file: fileParts } = await params;

  try {
    const authorization = await authorizeSession(request, slug);
    if (authorization.response) return authorization.response;

    const assetsRootDir = path.join(getSessionPhysicalPath(authorization.session.id), 'assets');
    return serveJailedSessionFile(assetsRootDir, fileParts, {
      mimeByExtension: MIME_TYPES,
      notFoundMessage: 'Asset not found',
      extraHeaders: {
        'Content-Security-Policy':
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    console.error(`[Asset Stream] Error serving asset for ${slug}:`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
