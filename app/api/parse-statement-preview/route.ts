import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { parseOmaStatement } from '@/lib/pdfParser';

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

    // Allow manual override of return % and month
    const manualReturnPct = formData.get('manual_return_pct');
    const manualMonth = formData.get('manual_month');
    const manualYear = formData.get('manual_year');

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromBuffer(buffer);
    const parsed = parseOmaStatement(rawText);

    // Determine the month and return to apply
    // Manual overrides take priority over parsed values
    const year = manualYear ? parseInt(manualYear as string) : parsed.year;
    const navTotal = parsed.navTotal;
    const ytdRoi = parsed.ytdRoi;
    const allMonthlyReturns = parsed.monthlyReturns;

    // Get latest month from parsed data
    const latestParsedMonth = allMonthlyReturns[allMonthlyReturns.length - 1];
    const statementMonth = manualMonth
      ? parseInt(manualMonth as string)
      : (latestParsedMonth?.month ?? new Date().getMonth() + 1);
    const statementReturnPct = manualReturnPct
      ? parseFloat(manualReturnPct as string)
      : (latestParsedMonth?.returnPct ?? 0);

    // Load investors with their latest NAV
    const supabase = getServiceClient();
    const { data: investors } = await supabase
      .from('investors')
      .select('*')
      .order('starting_capital', { ascending: false });

    if (!investors || investors.length === 0) {
      return NextResponse.json({ error: 'No investors found' }, { status: 404 });
    }

    // Get latest NAV for each investor
    const { data: allNavRecords } = await supabase
      .from('nav_records')
      .select('investor_id, nav, year, month')
      .in('investor_id', investors.map(i => i.id));

    const latestNavMap: Record<string, number> = {};
    for (const inv of investors) {
      const records = (allNavRecords ?? [])
        .filter(n => n.investor_id === inv.id)
        .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
      latestNavMap[inv.id] = records[0]?.nav ?? inv.starting_capital;
    }

    // Apply ONLY the latest month return to each investor
    const investorPreviews = investors.map(investor => {
      const currentNav = latestNavMap[investor.id] ?? investor.starting_capital;
      const newNav = parseFloat((currentNav * (1 + statementReturnPct / 100)).toFixed(2));
      const change = newNav - currentNav;
      const changePct = statementReturnPct; // same for all investors

      return {
        id: investor.id,
        name: investor.name,
        email: investor.email,
        slug: investor.slug,
        current_nav: currentNav,
        new_nav: newNav,
        change,
        change_pct: changePct,
        monthly_return_pct: statementReturnPct,
        has_email: !!investor.email,
      };
    });

    return NextResponse.json({
      parsed: {
        year,
        navTotal,
        ytdRoi,
        allMonthlyReturns,
        statementMonth,
        statementReturnPct,
        monthsInStatement: allMonthlyReturns.length,
      },
      investors: investorPreviews,
      fundCheck: {
        parsedNavTotal: navTotal,
        sumOfInvestorNavs: investorPreviews.reduce((s, i) => s + i.new_nav, 0),
        note: 'Fund NAV discrepancy is expected — PDF shows total fund value, investor NAVs are proportional shares'
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
