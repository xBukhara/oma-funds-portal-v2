'use client';
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { FundReturn } from '@/types';
import styles from './AdminCharts.module.css';

Chart.register(...registerables);

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// S&P 500 2025 approximate monthly returns for comparison
const SPX_2025 = [2.70, -1.42, -5.75, -0.76, 4.96, -0.41, 1.13, -1.18, -0.30, -1.01, 5.73, -2.50];

interface Props { fundReturns: FundReturn[]; }

export default function AdminGrowth({ fundReturns }: Props) {
  const comparisonRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const projRef = useRef<HTMLCanvasElement>(null);
  const c1 = useRef<Chart | null>(null);
  const c2 = useRef<Chart | null>(null);
  const c3 = useRef<Chart | null>(null);

  const omaReturns = fundReturns.map(r => r.monthly_return_pct);
  const labels = fundReturns.map(r => `${MONTHS[r.month]} ${r.year}`);
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // Build equity curves (index = 100 start)
  const buildCurve = (returns: number[]) => {
    let v = 100;
    return [100, ...returns.map(r => { v = v * (1 + r / 100); return parseFloat(v.toFixed(2)); })];
  };

  const omaCurve = buildCurve(omaReturns);
  const spxCurve = buildCurve(SPX_2025.slice(0, omaReturns.length));

  // Projection
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const stdev = (arr: number[]) => {
    const m = mean(arr);
    return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
  };
  const mu = omaReturns.length > 0 ? mean(omaReturns) : 0;
  const sigma = omaReturns.length > 0 ? stdev(omaReturns) : 0;
  const startProj = omaCurve[omaCurve.length - 1];
  const projMonths = 12;
  let base = [startProj], bull = [startProj], bear = [startProj];
  for (let i = 0; i < projMonths; i++) {
    base.push(parseFloat((base[base.length - 1] * (1 + mu / 100)).toFixed(2)));
    bull.push(parseFloat((bull[bull.length - 1] * (1 + (mu + sigma) / 100)).toFixed(2)));
    bear.push(parseFloat((bear[bear.length - 1] * (1 + (mu - sigma) / 100)).toFixed(2)));
  }

  useEffect(() => {
    if (!comparisonRef.current || !barRef.current || !projRef.current) return;
    const projLabels = ['Now', ...Array.from({ length: 12 }, (_, i) => `M+${i + 1}`)];

    c1.current?.destroy();
    c1.current = new Chart(comparisonRef.current, {
      type: 'line',
      data: {
        labels: ['Start', ...labels],
        datasets: [
          { label: 'OMA Funds', data: omaCurve, borderColor: '#36D399', backgroundColor: 'rgba(54,211,153,0.07)', borderWidth: 2.5, pointRadius: 2, tension: 0.35 },
          { label: 'S&P 500', data: spxCurve, borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.06)', borderWidth: 2, pointRadius: 2, tension: 0.35 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'rgba(234,242,255,.86)' } },
          tooltip: { backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1 } },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#a6b4d0', callback: v => `${v}` }, grid: { color: 'rgba(255,255,255,0.04)' } } } },
    });

    c2.current?.destroy();
    c2.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'OMA Monthly Return (%)', data: omaReturns, backgroundColor: omaReturns.map(v => v >= 0 ? 'rgba(54,211,153,0.7)' : 'rgba(248,113,113,0.7)'), borderRadius: 5 },
          { label: 'S&P 500 (%)', data: SPX_2025.slice(0, omaReturns.length), backgroundColor: 'rgba(167,139,250,0.5)', borderRadius: 5 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'rgba(234,242,255,.86)' } },
          tooltip: { backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1,
            callbacks: { label: ctx => ` ${fmtPct(ctx.raw as number)}` } } },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#a6b4d0', callback: v => `${v}%` }, grid: { color: 'rgba(255,255,255,0.04)' } } } },
    });

    c3.current?.destroy();
    c3.current = new Chart(projRef.current, {
      type: 'line',
      data: {
        labels: projLabels,
        datasets: [
          { label: 'Base path', data: base, borderColor: '#5AA7FF', borderWidth: 3, pointRadius: 2, tension: 0.35 },
          { label: 'Upside case', data: bull, borderColor: 'rgba(54,211,153,.85)', borderWidth: 2, pointRadius: 0, tension: 0.35 },
          { label: 'Downside case', data: bear, borderColor: 'rgba(248,113,113,.85)', borderWidth: 2, pointRadius: 0, tension: 0.35 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'rgba(234,242,255,.86)' } },
          tooltip: { backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1 } },
        scales: {
          x: { ticks: { color: '#a6b4d0' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#a6b4d0' }, grid: { color: 'rgba(255,255,255,0.04)' } } } },
    });

    return () => { c1.current?.destroy(); c2.current?.destroy(); c3.current?.destroy(); };
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
        <h1 className={styles.title}>OMA Growth</h1>
        <p className={styles.sub}>Fund journey, benchmarks, and forward projections</p>
      </div>
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>OMA Funds vs S&P 500 (Indexed = 100)</h2>
        <div className={styles.chartWrap}><canvas ref={comparisonRef} /></div>
      </div>
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Monthly Returns — OMA vs S&P 500</h2>
        <div className={styles.chartWrap}><canvas ref={barRef} /></div>
      </div>
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>12-Month Forward Projection (Base / Bull / Bear)</h2>
        <p className={styles.chartSub}>Based on historical monthly mean and volatility</p>
        <div className={styles.chartWrap}><canvas ref={projRef} /></div>
      </div>
    </div>
  );
}
