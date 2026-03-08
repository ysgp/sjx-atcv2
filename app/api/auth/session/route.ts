import { NextRequest, NextResponse } from 'next/server';

const INSTRUCTOR_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];

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

    // Check if user has instructor role
    const isInstructor = session.roles?.some((roleId: string) =>
      INSTRUCTOR_ROLE_IDS.includes(roleId)
    ) || session.isInstructor;

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: session.userId,
        username: session.username,
        discriminator: session.discriminator,
        avatar: session.avatar,
        roles: session.roles,
        isInstructor,
        studentId: session.studentId,
        callsign: session.callsign,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false, error: 'invalid_session' }, { status: 401 });
  }
}
