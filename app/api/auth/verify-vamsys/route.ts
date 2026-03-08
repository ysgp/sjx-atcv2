import { NextRequest, NextResponse } from 'next/server';

const VAMSYS_CLIENT_ID = process.env.VAMSYS_CLIENT_ID || '';
const VAMSYS_CLIENT_SECRET = process.env.VAMSYS_CLIENT_SECRET || '';
const VAMSYS_AUTH_BASE = 'https://vamsys.io';
const VAMSYS_API_BASE = 'https://vamsys.io/api/v3/operations';

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

// 在 vAMSYS 飛行員列表中尋找匹配 Callsign 和名稱的飛行員
async function findPilotByCallsignAndName(
  token: string, 
  callsign: string, 
  name: string
): Promise<{ callsign: string; name: string; discord_id: string | null; debug?: any } | null> {
  try {
    let nextCursor: string | null = null;
    let pageCount = 0;
    const normalizedCallsign = callsign.toUpperCase().trim();
    const normalizedName = name.toLowerCase().trim();

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
      for (const p of data.data || []) {
        const pilotCallsign = (p.username || '').toUpperCase().trim();
        // vAMSYS 使用 name 欄位 (不是 first_name)
        const pilotName = (p.name || '').toLowerCase().trim();
        
        // 精確匹配 callsign 和 name
        if (pilotCallsign === normalizedCallsign && pilotName === normalizedName) {
          return {
            callsign: p.username,
            name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            discord_id: p.discord_id || null,
          };
        }
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
  const callsign = searchParams.get('callsign');
  const name = searchParams.get('name');
  const debug = searchParams.get('debug');

  // Debug mode: 列出所有飛行員（僅用於測試）
  if (debug === 'true' && callsign) {
    const token = await getVamsysToken();
    if (!token) {
      return NextResponse.json({ error: 'vAMSYS token failed' }, { status: 503 });
    }

    // 搜尋包含此 callsign 的飛行員
    let nextCursor: string | null = null;
    let pageCount = 0;
    const searchCallsign = callsign.toUpperCase().trim();
    const foundPilots: any[] = [];

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

      if (!response.ok) break;
      const data = await response.json();
      
      for (const p of data.data || []) {
        const pilotCallsign = (p.username || '').toUpperCase().trim();
        if (pilotCallsign.includes(searchCallsign) || searchCallsign.includes(pilotCallsign)) {
          foundPilots.push({
            username: p.username,
            first_name: p.first_name,
            last_name: p.last_name,
            name: p.name,
            email: p.email,
            discord_id: p.discord_id,
          });
        }
      }
      
      nextCursor = data.meta?.next_cursor || null;
      if (pageCount >= 20) break;
    } while (nextCursor);

    return NextResponse.json({
      debug: true,
      searchCallsign,
      foundPilots,
      pagesSearched: pageCount,
    });
  }

  if (!callsign || !name) {
    return NextResponse.json(
      { error: '請提供 Callsign 和顯示名稱', verified: false },
      { status: 400 }
    );
  }

  // 獲取 vAMSYS token
  const token = await getVamsysToken();
  if (!token) {
    return NextResponse.json(
      { error: 'vAMSYS 服務暫時無法使用', verified: false },
      { status: 503 }
    );
  }

  // 尋找匹配的飛行員
  const pilot = await findPilotByCallsignAndName(token, callsign, name);

  if (!pilot) {
    return NextResponse.json(
      { error: '找不到符合的飛行員資料，請確認您的 Callsign 和顯示名稱是否正確', verified: false },
      { status: 404 }
    );
  }

  return NextResponse.json({
    verified: true,
    pilot: {
      callsign: pilot.callsign,
      name: pilot.name,
      discord_id: pilot.discord_id,
    },
  });
}
