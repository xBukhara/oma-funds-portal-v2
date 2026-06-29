import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

// GET all IPO holdings, optionally filtered by investor_id
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const investorId = req.nextUrl.searchParams.get('investor_id');
  const supabase = getServiceClient();

  let query = supabase
    .from('ipo_holdings')
    .select('*, investors(name, email, slug)')
    .order('created_at', { ascending: false });

  if (investorId) query = query.eq('investor_id', investorId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holdings: data });
}

// POST create new holding
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { investor_id, company_name, ticker, shares, entry_price, current_valuation, entry_date, notes } = body;

  if (!investor_id || !company_name || !shares || !entry_price || !current_valuation) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('ipo_holdings')
    .insert({
      investor_id,
      company_name,
      ticker: ticker || null,
      shares: parseFloat(shares),
      entry_price: parseFloat(entry_price),
      current_valuation: parseFloat(current_valuation),
      entry_date: entry_date || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holding: data });
}

// PATCH update existing holding
export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'Missing holding id' }, { status: 400 });

  // Parse numeric fields if present
  if (updates.shares) updates.shares = parseFloat(updates.shares);
  if (updates.entry_price) updates.entry_price = parseFloat(updates.entry_price);
  if (updates.current_valuation) updates.current_valuation = parseFloat(updates.current_valuation);
  updates.updated_at = new Date().toISOString();

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('ipo_holdings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holding: data });
}

// DELETE a holding
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase.from('ipo_holdings').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
