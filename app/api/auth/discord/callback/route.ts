import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const INSTRUCTOR_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const VAMSYS_CLIENT_ID = process.env.VAMSYS_CLIENT_ID || '';
const VAMSYS_CLIENT_SECRET = process.env.VAMSYS_CLIENT_SECRET || '';
const VAMSYS_AUTH_BASE = 'https://vamsys.io';
const VAMSYS_API_BASE = 'https://vamsys.io/api/v3/operations';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 獲取 vAMSYS OAuth Token
async function getVamsysToken(): Promise<string | null> {
  if (!VAMSYS_CLIENT_ID || !VAMSYS_CLIENT_SECRET) return null;
  
  try {
    const response = await fetch(`${VAMSYS_AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: VAMSYS_CLIENT_ID,
        client_secret: VAMSYS_CLIENT_SECRET,
        scope: '*',
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

// 在 vAMSYS 飛行員列表中尋找匹配 Discord ID 的飛行員
async function findPilotByDiscordId(token: string, discordId: string): Promise<{ callsign: string; name: string; discord_id: string } | null> {
  try {
    let nextCursor: string | null = null;
    let pageCount = 0;
    
    do {
      pageCount++;
      const url: string = nextCursor 
        ? `${VAMSYS_API_BASE}/pilots?page[size]=100&page[cursor]=${encodeURIComponent(nextCursor)}`
        : `${VAMSYS_API_BASE}/pilots?page[size]=100`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) return null;
      const data = await response.json();
      
      // 搜尋匹配的飛行員
      const matchingPilot = data.data?.find((p: any) => p.discord_id === discordId);
      if (matchingPilot) {
        return {
          callsign: matchingPilot.username,
          name: matchingPilot.name || `${matchingPilot.first_name || ''} ${matchingPilot.last_name || ''}`.trim(),
          discord_id: matchingPilot.discord_id,
        };
      }
      
      nextCursor = data.meta?.next_cursor || null;
      if (pageCount >= 20) break; // 安全限制
    } while (nextCursor);
    
    return null;
  } catch (e) {
    console.error('vAMSYS pilot search error:', e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // 'student' for student login

  const isStudentLogin = state === 'student';
  const errorRedirect = isStudentLogin ? '/login' : '/sjx-admin-panel';
  const successRedirect = isStudentLogin ? '/' : '/sjx-admin-panel';

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}${errorRedirect}?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/discord/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to fetch token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Fetch user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user');
    }

    const userData = await userResponse.json();

    // Fetch user's guild member data (including roles)
    let userRoles: string[] = [];
    try {
      const memberResponse = await fetch(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`,
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        userRoles = memberData.roles || [];
      } else if (!isStudentLogin) {
        // Admin login requires guild membership
        console.error('Failed to fetch member data:', await memberResponse.text());
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL}${errorRedirect}?error=not_member`
        );
      }
    } catch (e) {
      console.error('Failed to fetch guild member:', e);
      if (!isStudentLogin) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL}${errorRedirect}?error=not_member`
        );
      }
    }

    // Check if user has instructor role
    const isInstructor = userRoles.some((roleId: string) =>
      INSTRUCTOR_ROLE_IDS.includes(roleId)
    );

    // For admin login, require instructor role
    if (!isStudentLogin && !isInstructor) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}${errorRedirect}?error=no_permission`
      );
    }

    // Try to link/fetch Discord to student record (for both student and admin login)
    let studentData = null;
    
    // Check if user already exists in sjx_students by discord_id
    const { data: existingStudent } = await supabaseAdmin
      .from('sjx_students')
      .select('*')
      .eq('discord_id', userData.id)
      .single();

    studentData = existingStudent;

    // If no existing link, try to find via vAMSYS API
    if (!existingStudent) {
      try {
        // 使用 vAMSYS v3 API 搜尋飛行員
        const vamsysToken = await getVamsysToken();
        if (vamsysToken) {
          const pilot = await findPilotByDiscordId(vamsysToken, userData.id);
          
          if (pilot) {
            console.log('Found vAMSYS pilot:', pilot.callsign, 'for Discord ID:', userData.id);
            
            // Find the student in database by callsign
            const { data: studentByCallsign } = await supabaseAdmin
              .from('sjx_students')
              .select('*')
              .ilike('callsign', pilot.callsign)
              .single();

            if (studentByCallsign) {
              // Link the discord account to this student
              const { data: updatedStudent } = await supabaseAdmin
                .from('sjx_students')
                .update({
                  discord_id: userData.id,
                  discord_username: userData.username,
                  discord_avatar: userData.avatar,
                  discord_linked_at: new Date().toISOString(),
                })
                .eq('id', studentByCallsign.id)
                .select()
                .single();

              studentData = updatedStudent;
              console.log('Successfully linked Discord to student:', studentByCallsign.callsign);
            } else {
              console.log('vAMSYS pilot found but no matching student in database:', pilot.callsign);
            }
          } else {
            console.log('No vAMSYS pilot found for Discord ID:', userData.id);
          }
        }
      } catch (e) {
        console.error('vAMSYS API error:', e);
      }
    } else {
      // Update discord info if student exists
      await supabaseAdmin
        .from('sjx_students')
        .update({
          discord_username: userData.username,
          discord_avatar: userData.avatar,
        })
        .eq('id', existingStudent.id);
    }

    // For student login, require student record to exist
    if (isStudentLogin && !studentData) {
      console.log('Student login failed: No student record found for Discord ID:', userData.id);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/login?error=not_student`
      );
    }

    // Create session cookie
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}${successRedirect}?success=true`
    );

    // Set a secure cookie with user session
    response.cookies.set('discord_session', JSON.stringify({
      userId: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      roles: userRoles,
      isInstructor,
      studentId: studentData?.id || null,
      callsign: studentData?.callsign || null,
      timestamp: Date.now(),
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Discord OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}${errorRedirect}?error=auth_failed`
    );
  }
}
