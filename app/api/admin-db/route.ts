import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const { table, action, data, id } = await req.json();
  let result;

  switch (action) {
    case 'INSERT':
      result = await supabaseAdmin.from(table).insert([data]);
      break;
    case 'UPDATE':
      result = await supabaseAdmin.from(table).update(data).eq('id', id);
      break;
    case 'DELETE':
      result = await supabaseAdmin.from(table).delete().eq('id', id);
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}