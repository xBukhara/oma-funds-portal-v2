'use client';
import { useState, useRef, useCallback } from 'react';
import type { Statement, Investor } from '@/types';
import styles from './StatementUploader.module.css';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface InvestorPreview {
  id: string;
  name: string;
  email: string;
  slug: string;
  current_nav: number;
  new_nav: number;
  change: number;
  change_pct: number;
  monthly_return_pct: number;
  has_email: boolean;
}

interface ParsedPreview {
  year: number;
  navTotal: number;
  ytdRoi: number;
  allMonthlyReturns: { month: number; returnPct: number }[];
  statementMonth: number;
  statementReturnPct: number;
  monthsInStatement: number;
}

interface PreviewData {
  parsed: ParsedPreview;
  investors: InvestorPreview[];
  fundCheck: { parsedNavTotal: number; sumOfInvestorNavs: number; note: string };
}

interface Props {
  statements: Statement[];
  investors: Investor[];
}

type Step = 'upload' | 'preview' | 'sending' | 'done';

export default function StatementUploader({ statements, investors }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [statusMsg, setStatusMsg] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Manual override fields
  const [manualReturnPct, setManualReturnPct] = useState('');
  const [manualMonth, setManualMonth] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [useManual, setUseManual] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  }, []);

  async function handleParse() {
    if (!file) return;
    setError('');
    setStatusMsg('📄 Parsing statement...');

    const formData = new FormData();
    formData.append('statement', file);
    if (useManual && manualReturnPct) formData.append('manual_return_pct', manualReturnPct);
    if (useManual && manualMonth) formData.append('manual_month', manualMonth);
    if (useManual && manualYear) formData.append('manual_year', manualYear);

    const res = await fetch('/api/parse-statement-preview', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: formData,
    });

    const data = await res.json();
    setStatusMsg('');

    if (!res.ok) {
      setError(data.error ?? 'Parse failed');
      return;
    }

    setPreview(data);
    setStep('preview');
  }

  async function handleConfirmSend() {
    if (!file || !preview) return;
    setStep('sending');
    setStatusMsg('💾 Writing to database...');

    const formData = new FormData();
    formData.append('statement', file);
    // Always pass the confirmed values
    formData.append('manual_return_pct', String(preview.parsed.statementReturnPct));
    formData.append('manual_month', String(preview.parsed.statementMonth));
    formData.append('manual_year', String(preview.parsed.year));

    const res = await fetch('/api/parse-statement', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: formData,
    });

    setStatusMsg('✉️ Sending emails...');
    await new Promise(r => setTimeout(r, 600));

    const data = await res.json();
    setSendResult(data);
    setStep('done');
    setStatusMsg('');
  }

  function handleReset() {
    setFile(null);
    setStep('upload');
    setPreview(null);
    setSendResult(null);
    setError('');
    setStatusMsg('');
    setManualReturnPct('');
    setManualMonth('');
    setManualYear('');
    setUseManual(false);
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // ── UPLOAD STEP ────────────────────────────────────────────
  if (step === 'upload') return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Upload Statement</h1>
        <p className={styles.sub}>
          Upload the monthly PDF. The parser will extract the month and return %.
          Use manual override if needed.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="application/pdf"
          className={styles.hiddenInput}
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className={styles.filePreview}>
            <span className={styles.fileIcon}>📄</span>
            <div>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB — ready</p>
            </div>
            <button className={styles.clearBtn} onClick={e => { e.stopPropagation(); setFile(null); }}>✕</button>
          </div>
        ) : (
          <div className={styles.dropContent}>
            <div className={styles.dropIcon}>↑</div>
            <p className={styles.dropTitle}>Drop your PDF statement here</p>
            <p className={styles.dropSub}>or click to browse</p>
          </div>
        )}
      </div>

      {/* Manual override toggle */}
      <div style={{ background: 'rgba(14,22,40,0.6)', border: '1px solid var(--card-border)',
        borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: useManual ? 16 : 0 }}>
          <button
            onClick={() => setUseManual(!useManual)}
            style={{
              width: 36, height: 20, borderRadius: 999,
              background: useManual ? 'var(--blue)' : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: useManual ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Manual Override
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              Override the parsed month and return % if the parser gets it wrong
            </p>
          </div>
        </div>

        {useManual && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '.1em', color: 'var(--muted)' }}>Month</label>
              <select value={manualMonth} onChange={e => setManualMonth(e.target.value)}
                style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
                  outline: 'none', fontFamily: 'var(--font-body)' }}>
                <option value="">Auto-detect</option>
                {MONTHS.slice(1).map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '.1em', color: 'var(--muted)' }}>Year</label>
              <input type="number" value={manualYear} onChange={e => setManualYear(e.target.value)}
                placeholder="2026"
                style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
                  outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '.1em', color: 'var(--muted)' }}>Return %</label>
              <input type="number" value={manualReturnPct} onChange={e => setManualReturnPct(e.target.value)}
                placeholder="e.g. 9.57 or -2.30" step="0.01"
                style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
                  outline: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {statusMsg && <p style={{ fontSize: 14, color: 'var(--muted)' }}>{statusMsg}</p>}

      <button className={styles.uploadBtn} onClick={handleParse} disabled={!file || !!statusMsg}>
        {statusMsg || 'Parse & Preview →'}
      </button>

      {/* History */}
      {statements.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Statement History</h2>
          <div className={styles.historyTable}>
            <div className={styles.historyHeader}>
              <span>Period</span><span>Uploaded</span><span>Emails</span>
            </div>
            {statements.map(s => (
              <div key={s.id} className={styles.historyRow}>
                <span>{MONTHS[s.month]} {s.year}</span>
                <span className={styles.historyMuted}>{new Date(s.uploaded_at).toLocaleDateString()}</span>
                <span>
                  {s.email_sent_at
                    ? <span className={styles.sent}>✓ Sent</span>
                    : <span className={styles.pending}>— Not sent</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── PREVIEW STEP ───────────────────────────────────────────
  if (step === 'preview' && preview) {
    const { parsed, investors: invPreviews } = preview;
    const emailCount = invPreviews.filter(i => i.has_email).length;
    const returnColor = parsed.statementReturnPct >= 0 ? 'var(--green)' : 'var(--red)';

    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>Statement Preview</h1>
          <p className={styles.sub}>Review before sending. Nothing has been saved or emailed yet.</p>
        </div>

        {/* Fund summary */}
        <div style={{ background: 'rgba(14,22,40,0.8)', border: '1px solid var(--card-border)',
          borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, margin: 0 }}>
              {MONTHS[parsed.statementMonth]} {parsed.year}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(7,10,18,0.5)', borderRadius: 12, padding: '10px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Monthly Return Applied:</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)',
                color: returnColor }}>
                {fmtPct(parsed.statementReturnPct)}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Fund NAV (PDF)', value: fmt(parsed.navTotal), color: 'var(--blue)' },
              { label: 'Months in Statement', value: `${parsed.monthsInStatement}`, color: 'var(--text)' },
              { label: 'Emails to Send', value: `${emailCount} / ${invPreviews.length}`, color: 'var(--blue)' },
            ].map((m, i) => (
              <div key={i} style={{ background: 'rgba(7,10,18,0.5)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em',
                  color: 'var(--muted)', margin: '0 0 6px' }}>{m.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)',
                  margin: 0, color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* All monthly returns reference */}
          {parsed.allMonthlyReturns.length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px',
                textTransform: 'uppercase', letterSpacing: '.08em' }}>
                All months in PDF (for reference):
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {parsed.allMonthlyReturns.map(r => (
                  <div key={r.month} style={{
                    background: r.month === parsed.statementMonth
                      ? 'rgba(90,167,255,0.15)' : 'rgba(7,10,18,0.5)',
                    border: r.month === parsed.statementMonth
                      ? '1px solid rgba(90,167,255,0.4)' : '1px solid transparent',
                    borderRadius: 10, padding: '8px 12px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 3px' }}>
                      {MONTHS[r.month]}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0,
                      color: r.returnPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtPct(r.returnPct)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Investor table */}
        <div style={{ background: 'rgba(14,22,40,0.8)', border: '1px solid var(--card-border)',
          borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>
              Investor NAV Changes — {MONTHS[parsed.statementMonth]} {parsed.year}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
              Applying {fmtPct(parsed.statementReturnPct)} to each investor's current NAV
            </p>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
              <thead>
                <tr>
                  {['Investor', 'Current NAV', `New NAV (after ${fmtPct(parsed.statementReturnPct)})`,
                    'Change ($)', 'Email'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11,
                      textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)',
                      borderBottom: '1px solid var(--card-border)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invPreviews.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{inv.name}</td>
                    <td style={{ padding: '13px 16px', color: 'var(--muted)' }}>{fmt(inv.current_nav)}</td>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{fmt(inv.new_nav)}</td>
                    <td style={{ padding: '13px 16px', fontWeight: 600,
                      color: inv.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {inv.change >= 0 ? '+' : ''}{fmt(inv.change)}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {inv.has_email
                        ? <span style={{ color: 'var(--green)', fontSize: 12 }}>✓ {inv.email}</span>
                        : <span style={{ color: 'var(--red)', fontSize: 12 }}>✗ No email</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: 11,
                    textTransform: 'uppercase', color: 'var(--muted)' }}>Total</td>
                  <td style={{ padding: '13px 16px', fontWeight: 700 }}>
                    {fmt(invPreviews.reduce((s, i) => s + i.current_nav, 0))}
                  </td>
                  <td style={{ padding: '13px 16px', fontWeight: 700 }}>
                    {fmt(invPreviews.reduce((s, i) => s + i.new_nav, 0))}
                  </td>
                  <td style={{ padding: '13px 16px', fontWeight: 700,
                    color: invPreviews.reduce((s, i) => s + i.change, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt(invPreviews.reduce((s, i) => s + i.change, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={handleConfirmSend} style={{
            background: 'linear-gradient(135deg, #5aa7ff, #a78bfa)', border: 'none',
            borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}>
            ✓ Confirm & Send to {emailCount} Investor{emailCount !== 1 ? 's' : ''} →
          </button>
          <button onClick={handleReset} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '14px 24px', fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer',
          }}>
            ✕ Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── SENDING ────────────────────────────────────────────────
  if (step === 'sending') return (
    <div className={styles.wrap}>
      <div style={{ textAlign: 'center', padding: '60px 40px' }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(90,167,255,0.2)',
          borderTopColor: 'var(--blue)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
          Processing...
        </p>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>{statusMsg}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── DONE ───────────────────────────────────────────────────
  if (step === 'done' && sendResult) {
    const emailsSent = sendResult.emailResults?.filter((r: any) => r.status === 'sent').length ?? 0;
    const emailsFailed = sendResult.emailResults?.filter((r: any) => r.status !== 'sent').length ?? 0;

    return (
      <div className={styles.wrap}>
        <div style={{ background: 'rgba(54,211,153,0.06)', border: '1px solid rgba(54,211,153,0.2)',
          borderRadius: 18, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(54,211,153,0.12)', border: '1px solid rgba(54,211,153,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'var(--green)', flexShrink: 0 }}>✓</div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                margin: '0 0 4px', color: 'var(--text)' }}>Statement Processed Successfully</p>
              <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
                {MONTHS[sendResult.parsed?.statementMonth]} {sendResult.parsed?.year} •
                {' '}{fmtPct(sendResult.parsed?.statementReturnPct)} return •
                {' '}{emailsSent} emails sent
                {emailsFailed > 0 && `, ${emailsFailed} failed`}
              </p>
            </div>
          </div>
          {sendResult.emailResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sendResult.emailResults.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'center' }}>
                  <span style={{ color: r.status === 'sent' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    {r.status === 'sent' ? '✓' : '✗'}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>{r.investor}</span>
                  <span style={{ color: r.status === 'sent' ? 'var(--green)' : 'var(--red)' }}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleReset} style={{
          background: 'linear-gradient(135deg, #5aa7ff, #a78bfa)', border: 'none',
          borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-display)',
          fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', alignSelf: 'flex-start',
        }}>
          Upload Another Statement →
        </button>
      </div>
    );
  }

  return null;
}
