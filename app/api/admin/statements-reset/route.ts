import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();

  await supabase.from('email_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('nav_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('fund_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('statements').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Delete all files in statements storage bucket
  const { data: files } = await supabase.storage.from('statements').list('statements');
  if (files && files.length > 0) {
    const paths = files.map(f => `statements/${f.name}`);
    await supabase.storage.from('statements').remove(paths);
  }

  return NextResponse.json({ success: true, message: 'All statement data cleared' });
}
