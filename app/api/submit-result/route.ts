import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const body = await req.json();
  const { callsign, exam_type, chapter_id, score, passed, detailed_answers } = body;

const { data, error } = await supabaseAdmin
  .from('sjx_results') // 改小寫
  .insert([{ callsign, exam_type, chapter_id, score, passed, detailed_answers }])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}