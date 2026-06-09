import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { parseOmaStatement } from '@/lib/pdfParser';

async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('statement') as File | null;
    const manualReturnPct = formData.get('manual_return_pct');
    const manualMonth = formData.get('manual_month');
    const manualYear = formData.get('manual_year');

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromBuffer(buffer);
    const parsed = parseOmaStatement(rawText);

    // Fund NAV from PDF is the source of truth
    const fundNav = parsed.navTotal;
    const year = manualYear ? parseInt(manualYear as string) : parsed.year;
    const latestMonth = parsed.monthlyReturns[parsed.monthlyReturns.length - 1];
    const statementMonth = manualMonth
      ? parseInt(manualMonth as string)
      : (latestMonth?.month ?? new Date().getMonth());
    const statementReturnPct = manualReturnPct
      ? parseFloat(manualReturnPct as string)
      : (latestMonth?.returnPct ?? 0);

    const supabase = getServiceClient();
    const { data: investors } = await supabase
      .from('investors')
      .select('*')
      .order('starting_capital', { ascending: false });

    if (!investors?.length) {
      return NextResponse.json({ error: 'No investors found' }, { status: 404 });
    }

    // Each investor's new NAV = Fund NAV × their share %
    const investorPreviews = investors.map(inv => {
      const newNav = parseFloat((fundNav * (inv.share_pct / 100)).toFixed(2));
      const currentNav = inv.starting_capital;
      const change = newNav - currentNav;

      return {
        id: inv.id,
        name: inv.name,
        email: inv.email,
        slug: inv.slug,
        share_pct: inv.share_pct,
        current_nav: currentNav,
        new_nav: newNav,
        change,
        change_pct: statementReturnPct,
        has_email: !!inv.email,
      };
    });

    const sumCheck = investorPreviews.reduce((s, i) => s + i.new_nav, 0);

    return NextResponse.json({
      parsed: {
        year,
        statementMonth,
        statementReturnPct,
        fundNav,
        allMonthlyReturns: parsed.monthlyReturns,
        monthsInStatement: parsed.monthlyReturns.length,
      },
      investors: investorPreviews,
      fundCheck: {
        fundNav,
        sumOfInvestorNavs: Math.round(sumCheck * 100) / 100,
        difference: Math.round((fundNav - sumCheck) * 100) / 100,
        balanced: Math.abs(fundNav - sumCheck) < 1,
      },
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
