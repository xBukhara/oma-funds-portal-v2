import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { parseOmaStatement, computeInvestorNAV } from '@/lib/pdfParser';
import { buildInvestorEmailHTML, buildInvestorEmailText } from '@/lib/emailTemplates';
import nodemailer from 'nodemailer';
import type { Investor } from '@/types';

// pdf-parse needs to be imported with require in Next.js edge-compatible routes
// Use dynamic import to avoid issues
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('statement') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ── 1. Read PDF buffer ───────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());

    // ── 2. Extract text + parse ──────────────────────────────
    const rawText = await extractTextFromBuffer(buffer);
    const parsed = parseOmaStatement(rawText);

    const { year, navTotal, startingValue, ytdRoi, monthlyReturns } = parsed;

    const supabase = getServiceClient();

    // ── 3. Upload PDF to Supabase Storage ────────────────────
    const filePath = `statements/${year}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('statements')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // ── 4. Upsert fund-level returns ─────────────────────────
    for (const { month, returnPct } of monthlyReturns) {
      await supabase.from('fund_returns').upsert({
        year,
        month,
        monthly_return_pct: returnPct,
        nav_total: navTotal,
        ytd_roi: ytdRoi,
      }, { onConflict: 'year,month' });
    }

    // ── 5. Upsert statement record ───────────────────────────
    const { data: statementRow } = await supabase
      .from('statements')
      .upsert({
        year,
        month: monthlyReturns[monthlyReturns.length - 1]?.month ?? 12,
        file_path: filePath,
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'year,month' })
      .select()
      .single();

    // ── 6. Load all investors ────────────────────────────────
    const { data: investors, error: invError } = await supabase
      .from('investors')
      .select('*');

    if (invError || !investors || investors.length === 0) {
      return NextResponse.json({
        success: true,
        parsed,
        warning: 'No investors found — NAV records not written',
      });
    }

    // ── 7. Compute + upsert each investor's NAV records ──────
    const latestNavByInvestor: Map<string, { nav: number; month: number; returnPct: number }> = new Map();

    for (const investor of investors as Investor[]) {
      const investorMonthly = computeInvestorNAV(
        investor.starting_capital,
        monthlyReturns,
      );

      for (const { month, nav, returnPct } of investorMonthly) {
        await supabase.from('nav_records').upsert({
          investor_id: investor.id,
          year,
          month,
          nav,
          monthly_return_pct: returnPct,
        }, { onConflict: 'investor_id,year,month' });
      }

      // Track latest month for email
      const latest = investorMonthly[investorMonthly.length - 1];
      if (latest) {
        latestNavByInvestor.set(investor.id, latest);
      }
    }

    // ── 8. Send personalized emails ──────────────────────────
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://port.omafunds.com';
    const emailResults: { investor: string; status: string }[] = [];

    for (const investor of investors as Investor[]) {
      const latest = latestNavByInvestor.get(investor.id);
      if (!latest) continue;

      const navRecord = {
        id: '',
        investor_id: investor.id,
        year,
        month: latest.month,
        nav: latest.nav,
        monthly_return_pct: latest.returnPct,
        created_at: new Date().toISOString(),
      };

      try {
        await transporter.sendMail({
          from: `OMA Funds <${process.env.GMAIL_USER}>`,
          to: investor.email,
          subject: `Your OMA Funds Statement — ${getMonthName(latest.month)} ${year}`,
          html: buildInvestorEmailHTML(investor, navRecord, portalUrl),
          text: buildInvestorEmailText(investor, navRecord),
        });

        // Log success
        if (statementRow) {
          await supabase.from('email_log').insert({
            statement_id: statementRow.id,
            investor_id: investor.id,
            status: 'sent',
          });
        }

        emailResults.push({ investor: investor.email, status: 'sent' });
      } catch (emailErr) {
        const msg = emailErr instanceof Error ? emailErr.message : 'Unknown error';

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

    // ── 9. Mark statement email_sent_at ─────────────────────
    if (statementRow) {
      await supabase
        .from('statements')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', statementRow.id);
    }

    return NextResponse.json({
      success: true,
      parsed: { year, navTotal, ytdRoi, monthsProcessed: monthlyReturns.length },
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
