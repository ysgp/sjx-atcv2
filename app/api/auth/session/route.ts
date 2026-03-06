import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('discord_session');
    
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    
    // Check if session is still valid (not expired)
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = 60 * 60 * 24 * 7 * 1000; // 7 days in milliseconds
    
    if (sessionAge > maxAge) {
      return NextResponse.json({ authenticated: false, error: 'session_expired' }, { status: 401 });
    }

    // Verify user still has required roles
    const hasPermission = session.roles.some((roleId: string) =>
      ALLOWED_ROLE_IDS.includes(roleId)
    );

    if (!hasPermission) {
      return NextResponse.json({ authenticated: false, error: 'no_permission' }, { status: 403 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        discriminator: session.discriminator,
        avatar: session.avatar,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false, error: 'invalid_session' }, { status: 401 });
  }
}
