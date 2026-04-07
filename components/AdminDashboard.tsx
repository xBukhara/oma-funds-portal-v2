'use client';
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { FundReturn } from '@/types';
import styles from './AdminCharts.module.css';

Chart.register(...registerables);

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props { fundReturns: FundReturn[]; }

export default function AdminDashboard({ fundReturns }: Props) {
  const monthlyRef = useRef<HTMLCanvasElement>(null);
  const equityRef  = useRef<HTMLCanvasElement>(null);
  const c1 = useRef<Chart | null>(null);
  const c2 = useRef<Chart | null>(null);

  const latest = fundReturns[fundReturns.length - 1];
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  const startingValue = 150000;
  let runningNav = startingValue;
  const equityCurve: number[] = [startingValue];
  fundReturns.forEach(r => {
    runningNav = runningNav * (1 + r.monthly_return_pct / 100);
    equityCurve.push(runningNav);
  });

  const labels = fundReturns.map(r => `${MONTHS[r.month]} ${r.year}`);
  const returns = fundReturns.map(r => r.monthly_return_pct);

  useEffect(() => {
    if (!monthlyRef.current || !equityRef.current) return;
    c1.current?.destroy();
    c1.current = new Chart(monthlyRef.current, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Monthly Return (%)', data: returns,
        borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.12)',
        borderWidth: 2.5, pointRadius: 4, tension: 0.35, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e6edf3' } },
          tooltip: { backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1,
            callbacks: { label: ctx => ` ${fmtPct(ctx.raw as number)}` } } },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#a6b4d0', callback: v => `${v}%` }, grid: { color: 'rgba(255,255,255,0.04)' } } } },
    });
    c2.current?.destroy();
    c2.current = new Chart(equityRef.current, {
      type: 'line',
      data: { labels: ['Start', ...labels], datasets: [{ label: 'Fund Value ($)', data: equityCurve,
        borderColor: '#2ea043', backgroundColor: 'rgba(46,160,67,0.12)',
        borderWidth: 2.5, pointRadius: 3, tension: 0.35, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e6edf3' } },
          tooltip: { backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1,
            callbacks: { label: ctx => ` ${fmt(ctx.raw as number)}` } } },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#a6b4d0', callback: v => `$${Number(v).toLocaleString()}` }, grid: { color: 'rgba(255,255,255,0.04)' } } } },
    });
    return () => { c1.current?.destroy(); c2.current?.destroy(); };
  }, [fundReturns]);

  if (fundReturns.length === 0) return (
    <div style={{ padding: '80px 40px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>No data</p>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Upload a statement to populate charts.</p>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>OMA Dashboard</h1>
        <p className={styles.sub}>YTD Performance — Fund Level</p>
      </div>
      <div className={styles.metricsRow}>
        {[
          { label: 'Current Fund NAV', value: fmt(latest?.nav_total ?? 0), color: 'blue' },
          { label: 'YTD ROI', value: fmtPct(latest?.ytd_roi ?? 0), color: 'green' },
          { label: 'Last Month Return', value: fmtPct(latest?.monthly_return_pct ?? 0),
            color: (latest?.monthly_return_pct ?? 0) >= 0 ? 'green' : 'red' },
          { label: 'Months of Data', value: `${fundReturns.length}`, color: 'blue' },
        ].map((m, i) => (
          <div key={i} className={styles.metricCard}>
            <p className={styles.metricLabel}>{m.label}</p>
            <p className={styles.metricValue} style={{
              color: m.color === 'blue' ? 'var(--blue)' : m.color === 'green' ? 'var(--green)' : 'var(--red)'
            }}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Monthly Returns (%)</h2>
        <div className={styles.chartWrap}><canvas ref={monthlyRef} /></div>
      </div>
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Equity Curve — Fund Value Growth</h2>
        <div className={styles.chartWrap}><canvas ref={equityRef} /></div>
      </div>
      <div className={styles.tableCard}>
        <h2 className={styles.chartTitle} style={{ marginBottom: 16 }}>Monthly Returns Table</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Period</th><th>Monthly Return</th><th>Fund NAV</th><th>YTD ROI</th></tr></thead>
            <tbody>
              {[...fundReturns].reverse().map(r => (
                <tr key={r.id}>
                  <td>{MONTHS[r.month]} {r.year}</td>
                  <td style={{ color: r.monthly_return_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(r.monthly_return_pct)}</td>
                  <td>{fmt(r.nav_total)}</td>
                  <td style={{ color: 'var(--blue)' }}>{r.ytd_roi ? fmtPct(r.ytd_roi) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
