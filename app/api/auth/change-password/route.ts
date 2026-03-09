import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 檢查 session
    const sessionCookie = request.cookies.get('discord_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    if (!session.studentId) {
      return NextResponse.json({ error: '無效的 session' }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword, confirmPassword } = body;

    // 驗證密碼
    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: '請輸入新密碼' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '兩次密碼不一致' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '密碼長度至少 6 個字元' }, { status: 400 });
    }

    if (newPassword === 'SJX12345') {
      return NextResponse.json({ error: '不能使用預設密碼' }, { status: 400 });
    }

    // Hash 新密碼並更新
    const hash = await bcrypt.hash(newPassword, 10);
    
    const { error: updateError } = await supabaseAdmin
      .from('sjx_students')
      .update({ 
        password_hash: hash, 
        password_changed: true 
      })
      .eq('id', session.studentId);

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json({ error: '更新密碼失敗' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '密碼已更新' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: '更新密碼失敗，請稍後再試' }, { status: 500 });
  }
}
