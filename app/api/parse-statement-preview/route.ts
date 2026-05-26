import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { parseOmaStatement, computeInvestorNAV } from '@/lib/pdfParser';

async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('statement') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Parse PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromBuffer(buffer);
    const parsed = parseOmaStatement(rawText);
    const { year, navTotal, startingValue, ytdRoi, monthlyReturns } = parsed;

    // Load all investors with their current NAV
    const supabase = getServiceClient();
    const { data: investors } = await supabase
      .from('investors')
      .select('*')
      .order('starting_capital', { ascending: false });

    if (!investors || investors.length === 0) {
      return NextResponse.json({ error: 'No investors found' }, { status: 404 });
    }

    // For each investor, get their latest NAV record
    const { data: latestNavs } = await supabase
      .from('nav_records')
      .select('investor_id, nav, year, month')
      .in('investor_id', investors.map(i => i.id));

    // Build map of investor_id -> latest nav
    const latestNavMap: Record<string, number> = {};
    if (latestNavs) {
      for (const inv of investors) {
        const records = latestNavs
          .filter(n => n.investor_id === inv.id)
          .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
        latestNavMap[inv.id] = records[0]?.nav ?? inv.starting_capital;
      }
    }

    // Compute new NAVs for each investor
    const investorPreviews = investors.map(investor => {
      const currentNav = latestNavMap[investor.id] ?? investor.starting_capital;
      const monthly = computeInvestorNAV(currentNav, monthlyReturns);
      const latestMonth = monthly[monthly.length - 1];
      const newNav = latestMonth?.nav ?? currentNav;
      const change = newNav - currentNav;
      const changePct = currentNav > 0 ? (change / currentNav) * 100 : 0;

      return {
        id: investor.id,
        name: investor.name,
        email: investor.email,
        slug: investor.slug,
        current_nav: currentNav,
        new_nav: newNav,
        change,
        change_pct: changePct,
        monthly_return_pct: latestMonth?.returnPct ?? 0,
        has_email: !!investor.email,
      };
    });

    // Fund-level check
    const sumOfInvestorNavs = investorPreviews.reduce((sum, i) => sum + i.new_nav, 0);
    const discrepancy = Math.abs(sumOfInvestorNavs - navTotal);
    const discrepancyPct = navTotal > 0 ? (discrepancy / navTotal) * 100 : 0;

    return NextResponse.json({
      parsed: {
        year,
        navTotal,
        startingValue,
        ytdRoi,
        monthsProcessed: monthlyReturns.length,
        latestMonth: monthlyReturns[monthlyReturns.length - 1]?.month ?? 0,
        latestReturn: monthlyReturns[monthlyReturns.length - 1]?.returnPct ?? 0,
        monthlyReturns,
      },
      investors: investorPreviews,
      fundCheck: {
        parsedNavTotal: navTotal,
        sumOfInvestorNavs,
        discrepancy,
        discrepancyPct,
        isBalanced: discrepancyPct < 5, // within 5% is acceptable
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
