import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Search for students by callsign (for manual linking)
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('discord_session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const { searchParams } = new URL(request.url);
    const callsign = searchParams.get('callsign');

    if (!callsign || callsign.length < 3) {
      return NextResponse.json({ error: 'Callsign must be at least 3 characters' }, { status: 400 });
    }

    // Search for students by callsign (case insensitive, partial match)
    const { data: students, error } = await supabaseAdmin
      .from('sjx_students')
      .select('id, callsign, student_name, batch, discord_id')
      .ilike('callsign', `%${callsign}%`)
      .limit(10);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Return students with masked info (don't expose full details)
    const results = students?.map(s => ({
      id: s.id,
      callsign: s.callsign,
      name: s.student_name ? `${s.student_name[0]}${'*'.repeat(s.student_name.length - 1)}` : null,
      batch: s.batch,
      isLinked: !!s.discord_id,
    })) || [];

    return NextResponse.json({ students: results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

// Link Discord account to student
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('discord_session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Check if this student is already linked to another Discord account
    const { data: existingStudent, error: checkError } = await supabaseAdmin
      .from('sjx_students')
      .select('id, callsign, discord_id')
      .eq('id', studentId)
      .single();

    if (checkError || !existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (existingStudent.discord_id && existingStudent.discord_id !== session.userId) {
      return NextResponse.json({ error: 'This student is already linked to another Discord account' }, { status: 400 });
    }

    // Check if this Discord ID is already linked to another student
    const { data: existingLink } = await supabaseAdmin
      .from('sjx_students')
      .select('id, callsign')
      .eq('discord_id', session.userId)
      .neq('id', studentId)
      .single();

    if (existingLink) {
      return NextResponse.json({ 
        error: `Your Discord is already linked to ${existingLink.callsign}` 
      }, { status: 400 });
    }

    // Link the account
    const { data: updatedStudent, error: updateError } = await supabaseAdmin
      .from('sjx_students')
      .update({
        discord_id: session.userId,
        discord_username: session.username,
        discord_avatar: session.avatar,
        discord_linked_at: new Date().toISOString(),
      })
      .eq('id', studentId)
      .select()
      .single();

    if (updateError) {
      console.error('Link error:', updateError);
      return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      student: {
        id: updatedStudent.id,
        callsign: updatedStudent.callsign,
        student_name: updatedStudent.student_name,
      }
    });
  } catch (error) {
    console.error('Link error:', error);
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
  }
}
