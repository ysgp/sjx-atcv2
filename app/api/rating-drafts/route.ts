import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 驗證 session 並取得用戶資訊
async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get('discord_session');
  if (!sessionCookie) return null;
  
  try {
    const session = JSON.parse(sessionCookie.value);
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = 60 * 60 * 24 * 7 * 1000;
    
    if (sessionAge > maxAge) return null;
    
    return {
      id: session.userId,
      username: session.username,
    };
  } catch {
    return null;
  }
}

// GET: 取得草稿列表
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const formType = searchParams.get('formType');

  let query = supabaseAdmin
    .from('sjx_rating_drafts')
    .select('*')
    .eq('examiner_id', user.id)
    .order('updated_at', { ascending: false });

  if (formType) {
    query = query.eq('form_type', formType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: data });
}

// POST: 儲存草稿
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { formType, pilotName, callsign, draftData } = await request.json();

    if (!formType || !draftData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 檢查是否已有相同表單類型和呼號的草稿
    const { data: existing } = await supabaseAdmin
      .from('sjx_rating_drafts')
      .select('id')
      .eq('examiner_id', user.id)
      .eq('form_type', formType)
      .eq('callsign', callsign || '')
      .maybeSingle();

    let result;
    if (existing) {
      // 更新現有草稿
      result = await supabaseAdmin
        .from('sjx_rating_drafts')
        .update({
          pilot_name: pilotName || '',
          draft_data: draftData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // 建立新草稿
      result = await supabaseAdmin
        .from('sjx_rating_drafts')
        .insert({
          examiner_id: user.id,
          examiner_name: user.username,
          form_type: formType,
          pilot_name: pilotName || '',
          callsign: callsign || '',
          draft_data: draftData,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving draft:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, draft: result.data });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 刪除草稿
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get('id');

  if (!draftId) {
    return NextResponse.json({ error: 'Missing draft ID' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('sjx_rating_drafts')
    .delete()
    .eq('id', draftId)
    .eq('examiner_id', user.id);

  if (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
