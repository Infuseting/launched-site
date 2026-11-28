import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/validations/validator';
import type { Session, SessionMember } from '@prisma/client';

export type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: 'Le corps JSON de la requête est invalide' },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.name === 'AuthenticationStorageError') {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  console.error('[API Error]', error);
  return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
}

/** Only deliberate input errors may be returned to clients; database failures stay private. */
export function validateInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof Error) throw new ValidationError(error.message);
    throw error;
  }
}

/**
 * Ensures the incoming request is authenticated.
 */
export async function withAuth(
  request: Request,
  handler: (user: AuthenticatedUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return await handler(user);
  } catch (error) {
    return handleApiError(error);
  }
}

async function withSessionRole(
  request: Request,
  sessionId: string,
  requiredRole: 'OWNER' | null,
  handler: (context: {
    user: AuthenticatedUser;
    member: SessionMember;
    session: Session;
  }) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withAuth(request, async (user) => {
    const member = await prisma.sessionMember.findUnique({
      where: {
        userId_sessionId: {
          userId: user.id,
          sessionId,
        },
      },
      include: { session: true },
    });

    if (!member) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
    }

    if (requiredRole && member.role !== requiredRole) {
      return NextResponse.json(
        { error: 'Seul le propriétaire de la session est autorisé' },
        { status: 403 },
      );
    }

    return await handler({
      user,
      member,
      session: member.session,
    });
  });
}

/**
 * Ensures the caller is a member (OWNER or COLLABORATOR) of the requested session.
 */
export function withSessionMember(
  request: Request,
  sessionId: string,
  handler: (context: {
    user: AuthenticatedUser;
    member: SessionMember;
    session: Session;
  }) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withSessionRole(request, sessionId, null, handler);
}

/**
 * Ensures the caller is strictly the OWNER of the requested session.
 */
export function withSessionOwner(
  request: Request,
  sessionId: string,
  handler: (context: {
    user: AuthenticatedUser;
    member: SessionMember;
    session: Session;
  }) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withSessionRole(request, sessionId, 'OWNER', handler);
}
