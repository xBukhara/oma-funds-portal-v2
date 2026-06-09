import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { parseOmaStatement } from '@/lib/pdfParser';
import { buildInvestorEmailHTML, buildInvestorEmailText } from '@/lib/emailTemplates';
import nodemailer from 'nodemailer';
import type { Investor } from '@/types';

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

    const filePath = `statements/${year}/${file.name}`;
    await supabase.storage.from('statements')
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: true });

    await supabase.from('fund_returns').upsert({
      year, month: statementMonth,
      monthly_return_pct: statementReturnPct,
      nav_total: fundNav,
      ytd_roi: parsed.ytdRoi,
    }, { onConflict: 'year,month' });

    const { data: statementRow } = await supabase
      .from('statements')
      .upsert({ year, month: statementMonth, file_path: filePath,
        uploaded_at: new Date().toISOString() }, { onConflict: 'year,month' })
      .select().single();

    const { data: investors } = await supabase.from('investors').select('*');
    if (!investors?.length) {
      return NextResponse.json({ success: true, warning: 'No investors found' });
    }

    const emailResults: { investor: string; status: string }[] = [];
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://port.omafunds.com';

    for (const investor of investors as Investor[]) {
      const newNav = parseFloat((fundNav * (investor.share_pct / 100)).toFixed(2));

      await supabase.from('nav_records').upsert({
        investor_id: investor.id,
        year, month: statementMonth,
        nav: newNav,
        monthly_return_pct: statementReturnPct,
      }, { onConflict: 'investor_id,year,month' });

      await supabase.from('investors')
        .update({ starting_capital: newNav })
        .eq('id', investor.id);

      if (!investor.email) continue;

      const navRecord = {
        id: '', investor_id: investor.id, year,
        month: statementMonth, nav: newNav,
        monthly_return_pct: statementReturnPct,
        created_at: new Date().toISOString(),
      };

      try {
        await transporter.sendMail({
          from: `OMA Funds <${process.env.GMAIL_USER}>`,
          to: investor.email,
          subject: `Your OMA Funds Statement — ${getMonthName(statementMonth)} ${year}`,
          html: buildInvestorEmailHTML(investor, navRecord, portalUrl),
          text: buildInvestorEmailText(investor, navRecord),
        });
        if (statementRow) {
          await supabase.from('email_log').insert({
            statement_id: statementRow.id,
            investor_id: investor.id,
            status: 'sent',
          });
        }
        emailResults.push({ investor: investor.email, status: 'sent' });
      } catch (emailErr) {
        const msg = emailErr instanceof Error ? emailErr.message : 'Unknown';
        if (statementRow) {
          await supabase.from('email_log').insert({
            statement_id: statementRow.id,
            investor_id: investor.id,
            status: 'failed', error_msg: msg,
          });
        }
        emailResults.push({ investor: investor.email, status: `failed: ${msg}` });
      }
    }

    if (statementRow) {
      await supabase.from('statements')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', statementRow.id);
    }

    return NextResponse.json({
      success: true,
      parsed: { year, statementMonth, statementReturnPct, fundNav },
      emailResults,
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function getMonthName(month: number): string {
  return ['','January','February','March','April','May','June',
    'July','August','September','October','November','December'][month] ?? '';
}
