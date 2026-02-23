import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    
    // 取得資料庫中的正確密碼
    // 改成小寫
const { data, error } = await supabaseAdmin
  .from('sjx_adminconfig') 
  .select('admin_password')
  .maybeSingle();

    if (error) {
      console.error('Supabase 查詢錯誤:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('資料庫密碼:', data?.admin_password);
    console.log('你輸入的密碼:', password);

    if (data?.admin_password === password) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch (err) {
    console.error('API 系統錯誤:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}