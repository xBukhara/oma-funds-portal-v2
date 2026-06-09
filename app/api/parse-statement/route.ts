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
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
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

    const year = manualYear ? parseInt(manualYear as string) : parsed.year;
    const navTotal = parsed.navTotal;
    const ytdRoi = parsed.ytdRoi;

    const latestParsedMonth = parsed.monthlyReturns[parsed.monthlyReturns.length - 1];
    const statementMonth = manualMonth
      ? parseInt(manualMonth as string)
      : (latestParsedMonth?.month ?? new Date().getMonth() + 1);
    const statementReturnPct = manualReturnPct
      ? parseFloat(manualReturnPct as string)
      : (latestParsedMonth?.returnPct ?? 0);

    const supabase = getServiceClient();

    // Upload PDF to storage
    const filePath = `statements/${year}/${file.name}`;
    await supabase.storage
      .from('statements')
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: true });

    // Upsert fund return for this month only
    await supabase.from('fund_returns').upsert({
      year,
      month: statementMonth,
      monthly_return_pct: statementReturnPct,
      nav_total: navTotal,
      ytd_roi: ytdRoi,
    }, { onConflict: 'year,month' });

    // Upsert statement record
    const { data: statementRow } = await supabase
      .from('statements')
      .upsert({
        year,
        month: statementMonth,
        file_path: filePath,
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'year,month' })
      .select()
      .single();

    // Load investors
    const { data: investors } = await supabase.from('investors').select('*');
    if (!investors || investors.length === 0) {
      return NextResponse.json({ success: true, warning: 'No investors found' });
    }

    // Get latest NAV for each investor
    const { data: allNavRecords } = await supabase
      .from('nav_records')
      .select('investor_id, nav, year, month, id')
      .in('investor_id', investors.map(i => i.id));

    const latestNavMap: Record<string, { nav: number; id: string }> = {};
    for (const inv of investors) {
      const records = (allNavRecords ?? [])
        .filter(n => n.investor_id === inv.id)
        .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
      if (records[0]) {
        latestNavMap[inv.id] = { nav: records[0].nav, id: records[0].id };
      }
    }

    // Apply ONLY this month's return to each investor
    const emailResults: { investor: string; status: string }[] = [];
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://port.omafunds.com';

    for (const investor of investors as Investor[]) {
      const currentNav = latestNavMap[investor.id]?.nav ?? investor.starting_capital;
      const newNav = parseFloat((currentNav * (1 + statementReturnPct / 100)).toFixed(2));

      // Upsert nav record for this month
      await supabase.from('nav_records').upsert({
        investor_id: investor.id,
        year,
        month: statementMonth,
        nav: newNav,
        monthly_return_pct: statementReturnPct,
      }, { onConflict: 'investor_id,year,month' });

      // Send email
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
            status: 'failed',
            error_msg: msg,
          });
        }
        emailResults.push({ investor: investor.email, status: `failed: ${msg}` });
      }
    }

    // Mark email sent
    if (statementRow) {
      await supabase.from('statements')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', statementRow.id);
    }

    return NextResponse.json({
      success: true,
      parsed: { year, navTotal, ytdRoi, statementMonth, statementReturnPct },
      emailResults,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getMonthName(month: number): string {
  return ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'][month] ?? '';
}
