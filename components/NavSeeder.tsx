'use client';
import { useState } from 'react';
import type { Investor } from '@/types';

const SPREADSHEET_NAVS: Record<string, number> = {
  'zia': 60136.63,
  'noor': 98142.55,
  'omer-azhar': 53109.12,
  'shoaib': 23281.71,
  'sufiyan': 39278.14,
  'talha': 39278.11,
  'asad': 25744.05,
  'sarwar': 19639.07,
  'saher': 19639.07,
  'habib': 13351.39,
  'dawood': 12872.03,
  'fajar': 10858.83,
  'umer-butt': 10000.00,
  'bilal': 6436.00,
  'afaq': 3861.61,
  'timur': 3861.61,
};

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  investors: Investor[];
}

export default function NavSeeder({ investors }: Props) {
  const [navValues, setNavValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    investors.forEach(inv => {
      init[inv.id] = (SPREADSHEET_NAVS[inv.slug] ?? inv.starting_capital).toFixed(2);
    });
    return init;
  });

  const [asOfMonth, setAsOfMonth] = useState('4');
  const [asOfYear, setAsOfYear] = useState('2026');
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<{ seeded: number; failed: number } | null>(null);
  const [error, setError] = useState('');

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  async function handleSeed() {
    setSeeding(true);
    setError('');
    setResult(null);

    const seeds = investors.map(inv => ({
      investor_id: inv.id,
      nav: parseFloat(navValues[inv.id] ?? '0'),
      as_of_year: parseInt(asOfYear),
      as_of_month: parseInt(asOfMonth),
    })).filter(s => s.nav > 0);

    const res = await fetch('/api/admin/seed-nav', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({ seeds }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Seeding failed');
      setSeeding(false);
      return;
    }

    setResult({ seeded: data.seeded, failed: data.failed });
    setSeeding(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        background: 'rgba(232,200,122,0.08)',
        border: '1px solid rgba(232,200,122,0.25)',
        borderRadius: 14, padding: '16px 20px',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--gold)', lineHeight: 1.6 }}>
          ⚡ <strong>One-time NAV baseline seed.</strong> Sets each investor's current NAV as their
          starting point. Future statement uploads will compound forward from these values. Only run once.
        </p>
      </div>

      {/* As-of date */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '.1em', color: 'var(--muted)' }}>As of Month</label>
          <select value={asOfMonth} onChange={e => setAsOfMonth(e.target.value)}
            style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
              outline: 'none', fontFamily: 'var(--font-body)' }}>
            {MONTHS.slice(1).map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '.1em', color: 'var(--muted)' }}>Year</label>
          <input type="number" value={asOfYear} onChange={e => setAsOfYear(e.target.value)}
            style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
              outline: 'none', width: 100 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(14,22,40,0.7)', border: '1px solid var(--card-border)',
        borderRadius: 16, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
          <thead>
            <tr>
              {['Investor', 'Slug', 'NAV to Seed', 'Spreadsheet Value'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)',
                  borderBottom: '1px solid var(--card-border)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {investors.map(inv => {
              const spreadsheetNav = SPREADSHEET_NAVS[inv.slug];
              return (
                <tr key={inv.id}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inv.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)',
                    fontFamily: 'monospace', fontSize: 11 }}>/i/{inv.slug}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--muted)' }}>$</span>
                      <input
                        type="number"
                        value={navValues[inv.id] ?? ''}
                        onChange={e => setNavValues(v => ({ ...v, [inv.id]: e.target.value }))}
                        step="0.01"
                        style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--text)',
                          outline: 'none', width: 140 }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px',
                    color: spreadsheetNav ? 'var(--green)' : 'var(--muted)' }}>
                    {spreadsheetNav ? fmt(spreadsheetNav) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10,
          padding: '10px 14px', margin: 0 }}>{error}</p>
      )}

      {result && (
        <p style={{ fontSize: 13, color: 'var(--green)', background: 'rgba(54,211,153,0.08)',
          border: '1px solid rgba(54,211,153,0.2)', borderRadius: 10,
          padding: '10px 14px', margin: 0 }}>
          ✓ Successfully seeded {result.seeded} investors.
          {result.failed > 0 && ` ${result.failed} failed.`}
          {' '}Future statements will compound from these values.
        </p>
      )}

      <button onClick={handleSeed} disabled={seeding} style={{
        background: 'linear-gradient(135deg, #e8c87a, #f4a261)', border: 'none',
        borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-display)',
        fontSize: 15, fontWeight: 700, color: '#07090f', cursor: 'pointer',
        opacity: seeding ? 0.5 : 1, alignSelf: 'flex-start',
      }}>
        {seeding ? 'Seeding...' : `Seed NAV Baseline for ${MONTHS[parseInt(asOfMonth)]} ${asOfYear} →`}
      </button>
    </div>
  );
}
