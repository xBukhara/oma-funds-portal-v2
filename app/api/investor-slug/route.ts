import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investors')
    .select('slug')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
  }

  return NextResponse.json({ slug: data.slug });
}
