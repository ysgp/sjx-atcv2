import { NextResponse } from 'next/server';

const VAMSYS_CLIENT_ID = process.env.VAMSYS_CLIENT_ID || '';
const VAMSYS_CLIENT_SECRET = process.env.VAMSYS_CLIENT_SECRET || '';
const VAMSYS_AUTH_BASE = 'https://vamsys.io';
const VAMSYS_API_BASE = 'https://vamsys.io/api/v3/operations';

// 獲取 OAuth 2.0 Access Token (7 天有效期)
async function getAccessToken() {
  try {
    console.log('🔐 Attempting OAuth with vAMSYS...');
    console.log('📍 Auth URL:', `${VAMSYS_AUTH_BASE}/oauth/token`);
    console.log('🆔 Client ID:', VAMSYS_CLIENT_ID ? 'Present' : 'Missing');
    console.log('🔑 Client Secret:', VAMSYS_CLIENT_SECRET ? 'Present' : 'Missing');

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
        scope: '*', // Full access scope
      }).toString(),
      signal: AbortSignal.timeout(30000), // 增加到 30 秒
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OAuth Error Response:', errorText);
      throw new Error(`OAuth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OAuth Success - Token expires in:', data.expires_in, 'seconds');
    return data.access_token;
  } catch (error: any) {
    console.error('❌ OAuth Error:', error.message);
    if (error.cause) {
      console.error('📌 Cause:', error.cause.message);
      console.error('📌 Code:', error.cause.code);
    }
    throw error;
  }
}

// 獲取飛行員列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pilotId = searchParams.get('pilot_id');

    // 檢查環境變量
    if (!VAMSYS_CLIENT_ID || !VAMSYS_CLIENT_SECRET) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'vAMSYS credentials not configured',
          hint: 'Please check VAMSYS_CLIENT_ID and VAMSYS_CLIENT_SECRET in .env.local'
        },
        { status: 500 }
      );
    }

    // 獲取 OAuth Token
    const token = await getAccessToken();

    // 如果指定了 pilot_id，獲取單個飛行員資料
    if (pilotId) {
      const response = await fetch(`${VAMSYS_API_BASE}/pilots/${pilotId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Get Pilot Error Response:', errorText);
        throw new Error(`Get pilot failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // 否則獲取所有飛行員列表（處理分頁）
    console.log('📡 Fetching pilots from vAMSYS...');
    
    let allPilots: any[] = [];
    let nextCursor: string | null = null;
    let pageCount = 0;
    
    do {
      pageCount++;
      const url: string = nextCursor 
        ? `${VAMSYS_API_BASE}/pilots?page[size]=100&page[cursor]=${encodeURIComponent(nextCursor)}`
        : `${VAMSYS_API_BASE}/pilots?page[size]=100`;
      
      console.log(`📄 Fetching page ${pageCount}...`);
      
      const pageResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!pageResponse.ok) {
        const errorText = await pageResponse.text();
        console.error('❌ Get Pilots Error Response:', errorText);
        throw new Error(`Get pilots failed: ${pageResponse.status} - ${errorText}`);
      }

      const pageData = await pageResponse.json();
      const pagePilots = pageData.data || [];
      allPilots = allPilots.concat(pagePilots);
      
      console.log(`✅ Page ${pageCount} fetched: ${pagePilots.length} pilots (Total so far: ${allPilots.length})`);
      
      // 檢查是否有下一頁
      nextCursor = pageData.meta?.next_cursor || null;
      
      // 安全檢查：防止無限循環（最多 50 頁 = 5000 飛行員）
      if (pageCount >= 50) {
        console.warn('⚠️ Reached maximum page limit (50 pages)');
        break;
      }
    } while (nextCursor);
    
    console.log(`✅ All pilots fetched: ${allPilots.length} pilots from ${pageCount} pages`);
    
    // 過濾並格式化飛行員資料
    const pilots = allPilots.map((pilot: any) => ({
      id: pilot.id,
      callsign: pilot.username, // vAMSYS 使用 username 作為 callsign
      name: pilot.name || `${pilot.first_name || ''} ${pilot.last_name || ''}`.trim(),
      first_name: pilot.first_name,
      last_name: pilot.last_name,
      email: pilot.email,
      status: pilot.status,
      rank: pilot.rank?.name || null,
      discord_id: pilot.discord_id || null, // vAMSYS pilot 的 Discord ID
    }));

    return NextResponse.json({
      success: true,
      pilots: pilots,
      total: pilots.length,
      pages: pageCount,
    });

  } catch (error: any) {
    console.error('❌ vAMSYS API Error:', error.message);
    
    // 根據錯誤類型提供更友好的提示
    let userMessage = 'Failed to fetch pilots from vAMSYS';
    let hint = null;

    if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      userMessage = 'Connection timeout - Cannot reach vAMSYS API server';
      hint = 'Please check your internet connection, firewall, or proxy settings. The vAMSYS API might be temporarily unavailable.';
    } else if (error.message.includes('OAuth failed')) {
      userMessage = 'Authentication failed';
      hint = 'Please verify your vAMSYS Client ID and Client Secret are correct.';
    }

    return NextResponse.json(
      { 
        success: false, 
        error: userMessage,
        hint: hint,
        details: error.message,
        technicalDetails: error.cause?.message || null
      },
      { status: 500 }
    );
  }
}
