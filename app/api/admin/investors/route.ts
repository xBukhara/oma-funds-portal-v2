import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

// GET all investors
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investors')
    .select('*, nav_records(year, month, nav, monthly_return_pct)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investors: data });
}

// POST create investor + auth user
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, email, slug, starting_capital, share_pct, temp_password } = body;

  if (!name || !email || !slug || !starting_capital || !temp_password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Create Supabase auth user with force_password_change flag
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true, // auto-confirm so they can log in immediately
    user_metadata: {
      force_password_change: true, // triggers password change on first login
      full_name: name,
    },
  });

  if (authError) {
    return NextResponse.json(
      { error: `Auth user creation failed: ${authError.message}` },
      { status: 500 }
    );
  }

  // Create investor record linked to auth user
  const { data: investor, error: invError } = await supabase
    .from('investors')
    .insert({
      user_id: authUser.user.id,
      name,
      email,
      slug,
      starting_capital: parseFloat(starting_capital),
      share_pct: parseFloat(share_pct ?? 0),
    })
    .select()
    .single();

  if (invError) {
    // Rollback auth user if investor record fails
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json(
      { error: `Investor record failed: ${invError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ investor });
}

// PATCH update investor
export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'Missing investor id' }, { status: 400 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investor: data });
}

// DELETE investor + their auth user
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = getServiceClient();

  const { data: inv } = await supabase
    .from('investors')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('investors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (inv?.user_id) {
    await supabase.auth.admin.deleteUser(inv.user_id);
  }

  return NextResponse.json({ success: true });
}
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // TEMPORARY DEBUG - remove after fixing
  console.log('ENV CHECK:', {
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSecretKey: !!process.env.SUPABASE_SECRET_KEY,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    serviceRoleLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
    secretKeyLength: process.env.SUPABASE_SECRET_KEY?.length,
  });
