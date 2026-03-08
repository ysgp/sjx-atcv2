import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INSTRUCTOR_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];

// Pages that don't require authentication
const publicPaths = ['/login', '/api/auth'];

// Pages that require instructor role
const instructorPaths = ['/sjx-admin-panel'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static files and api routes (except protected ones)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/admin'))
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('discord_session');
  
  if (!sessionCookie) {
    // Not logged in, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const session = JSON.parse(sessionCookie.value);

    // Check session expiry (7 days)
    const sessionAge = Date.now() - session.timestamp;
    if (sessionAge > 7 * 24 * 60 * 60 * 1000) {
      // Session expired
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('discord_session');
      return response;
    }

    // Check instructor access
    if (instructorPaths.some(path => pathname.startsWith(path))) {
      const hasInstructorRole = session.roles?.some((roleId: string) =>
        INSTRUCTOR_ROLE_IDS.includes(roleId)
      );

      if (!hasInstructorRole) {
        // No permission, redirect to home with error
        return NextResponse.redirect(new URL('/?error=no_permission', request.url));
      }
    }

    return NextResponse.next();
  } catch (e) {
    // Invalid session, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('discord_session');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
