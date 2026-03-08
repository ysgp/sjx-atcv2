import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('discord_session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    
    // Get full student data if studentId exists
    let studentData = null;
    if (session.studentId) {
      const { data, error } = await supabaseAdmin
        .from('sjx_students')
        .select('*')
        .eq('id', session.studentId)
        .single();
      
      if (!error && data) {
        studentData = data;
      }
    }

    // Try to find student by discord_id if not found by studentId
    if (!studentData && session.userId) {
      const { data, error } = await supabaseAdmin
        .from('sjx_students')
        .select('*')
        .eq('discord_id', session.userId)
        .single();
      
      if (!error && data) {
        studentData = data;
      }
    }

    return NextResponse.json({
      discord: {
        userId: session.userId,
        username: session.username,
        discriminator: session.discriminator,
        avatar: session.avatar,
        linkedAt: session.timestamp,
      },
      student: studentData,
      isInstructor: session.isInstructor || false,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
