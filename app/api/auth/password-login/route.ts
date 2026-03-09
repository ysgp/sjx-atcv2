import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VAMSYS_CLIENT_ID = process.env.VAMSYS_CLIENT_ID || '';
const VAMSYS_CLIENT_SECRET = process.env.VAMSYS_CLIENT_SECRET || '';
const VAMSYS_AUTH_BASE = 'https://vamsys.io';
const VAMSYS_API_BASE = 'https://vamsys.io/api/v3/operations';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const INSTRUCTOR_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];

// 預設密碼
const DEFAULT_PASSWORD = 'SJX12345';

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

// 在 vAMSYS 飛行員列表中尋找匹配 Callsign 的飛行員
async function findPilotByCallsign(token: string, callsign: string): Promise<{ callsign: string; name: string; discord_id: string | null } | null> {
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
      
      // 搜尋匹配的飛行員 (callsign 在 vAMSYS 是 username)
      const matchingPilot = data.data?.find((p: any) => 
        p.username?.toUpperCase() === callsign.toUpperCase()
      );
      if (matchingPilot) {
        return {
          callsign: matchingPilot.username,
          name: matchingPilot.name || `${matchingPilot.first_name || ''} ${matchingPilot.last_name || ''}`.trim(),
          discord_id: matchingPilot.discord_id || null,
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

// 獲取 Discord 成員資料（角色、頭像等）
async function getDiscordMemberInfo(discordId: string): Promise<{
  username: string;
  avatar: string | null;
  roles: string[];
  isInstructor: boolean;
} | null> {
  if (!discordId || !GUILD_ID || !process.env.DISCORD_BOT_TOKEN) return null;
  
  try {
    const memberResponse = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!memberResponse.ok) return null;
    
    const memberData = await memberResponse.json();
    const roles = memberData.roles || [];
    const isInstructor = roles.some((roleId: string) => INSTRUCTOR_ROLE_IDS.includes(roleId));
    
    // 獲取用戶頭像（需要另外調用 user endpoint）
    let avatar = null;
    let username = memberData.user?.username || '';
    
    if (memberData.user) {
      avatar = memberData.user.avatar;
      username = memberData.user.username;
    }
    
    return { username, avatar, roles, isInstructor };
  } catch (e) {
    console.error('Discord member fetch error:', e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callsign, password } = body;

    if (!callsign || !password) {
      return NextResponse.json({ error: 'Callsign 和密碼為必填' }, { status: 400 });
    }

    // 查找學員
    const { data: student, error: findError } = await supabaseAdmin
      .from('sjx_students')
      .select('*')
      .ilike('callsign', callsign.trim())
      .single();

    if (findError || !student) {
      return NextResponse.json({ error: '找不到該 Callsign 的學員' }, { status: 404 });
    }

    // 檢查密碼
    let isValidPassword = false;
    
    if (student.password_hash) {
      // 已有設定密碼，驗證 bcrypt hash
      isValidPassword = await bcrypt.compare(password, student.password_hash);
    } else {
      // 尚未設定密碼，使用預設密碼
      isValidPassword = password === DEFAULT_PASSWORD;
      
      // 如果是預設密碼且正確，設定 hash
      if (isValidPassword) {
        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        await supabaseAdmin
          .from('sjx_students')
          .update({ password_hash: hash, password_changed: false })
          .eq('id', student.id);
      }
    }

    if (!isValidPassword) {
      return NextResponse.json({ error: '密碼錯誤' }, { status: 401 });
    }

    // 嘗試透過 vAMSYS 自動綁定 Discord
    let discordLinked = !!student.discord_id;
    if (!student.discord_id) {
      try {
        const vamsysToken = await getVamsysToken();
        if (vamsysToken) {
          const pilot = await findPilotByCallsign(vamsysToken, student.callsign);
          if (pilot && pilot.discord_id) {
            // 在 vAMSYS 找到且有 Discord ID，自動綁定
            await supabaseAdmin
              .from('sjx_students')
              .update({
                discord_id: pilot.discord_id,
                discord_linked_at: new Date().toISOString(),
              })
              .eq('id', student.id);
            discordLinked = true;
            console.log(`Auto-linked Discord for ${student.callsign}: ${pilot.discord_id}`);
          }
        }
      } catch (e) {
        console.error('vAMSYS auto-link error:', e);
      }
    }

    // 更新最後登入時間
    await supabaseAdmin
      .from('sjx_students')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', student.id);

    // 如果有 Discord ID，獲取 Discord 成員資料
    let discordInfo: {
      username: string;
      avatar: string | null;
      roles: string[];
      isInstructor: boolean;
    } | null = null;
    
    // 重新查詢學員資料以獲取最新的 discord_id
    const { data: updatedStudent } = await supabaseAdmin
      .from('sjx_students')
      .select('*')
      .eq('id', student.id)
      .single();
    
    const currentDiscordId = updatedStudent?.discord_id || student.discord_id;
    
    if (currentDiscordId) {
      discordInfo = await getDiscordMemberInfo(currentDiscordId);
      
      // 更新 Discord 資訊到資料庫
      if (discordInfo) {
        await supabaseAdmin
          .from('sjx_students')
          .update({
            discord_username: discordInfo.username,
            discord_avatar: discordInfo.avatar,
          })
          .eq('id', student.id);
      }
    }

    // 建立 session
    const response = NextResponse.json({
      success: true,
      requirePasswordChange: !student.password_changed,
      discordLinked,
      isInstructor: discordInfo?.isInstructor || false,
    });

    // 設定 session cookie
    response.cookies.set('discord_session', JSON.stringify({
      userId: currentDiscordId || `password_${student.id}`,
      username: discordInfo?.username || student.callsign,
      discriminator: null,
      avatar: discordInfo?.avatar || null,
      roles: discordInfo?.roles || [],
      isInstructor: discordInfo?.isInstructor || false,
      studentId: student.id,
      callsign: student.callsign,
      loginMethod: 'password',
      timestamp: Date.now(),
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Password login error:', error);
    return NextResponse.json({ error: '登入失敗，請稍後再試' }, { status: 500 });
  }
}
