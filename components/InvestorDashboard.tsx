'use client';
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { Investor, NavRecord, Statement } from '@/types';
import StockTicker from './StockTicker';
import styles from './InvestorDashboard.module.css';

Chart.register(...registerables);

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  investor: Investor & {
    invested?: number;
    withdrawn?: number;
    net_capital?: number;
    total_pl?: number;
    contribution_date?: string;
  };
  navRecords: NavRecord[];
  latestStatement: Statement | null;
}

export default function InvestorDashboard({ investor, navRecords, latestStatement }: Props) {
  const equityRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const equityChart = useRef<Chart | null>(null);
  const barChart = useRef<Chart | null>(null);

  const latestRecord = navRecords[navRecords.length - 1];
  const currentNav = latestRecord?.nav ?? investor.starting_capital;
  const currentReturn = latestRecord?.monthly_return_pct ?? 0;

  // P&L calculations
  const invested = investor.invested ?? investor.starting_capital;
  const withdrawn = investor.withdrawn ?? 0;
  const netCapital = investor.net_capital ?? invested;
  const totalValueReceived = currentNav + withdrawn;
  const plVsInvested = totalValueReceived - invested;
  const plVsNetCapital = totalValueReceived - netCapital;
  const plPctVsInvested = invested > 0 ? (plVsInvested / invested) * 100 : 0;
  const plPctVsNetCapital = netCapital !== 0 ? (plVsNetCapital / Math.abs(netCapital)) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  useEffect(() => {
    if (!equityRef.current || !barRef.current || navRecords.length === 0) return;

    const labels = navRecords.map(r => `${MONTHS[r.month]} ${r.year}`);
    const navValues = navRecords.map(r => r.nav);
    const returnValues = navRecords.map(r => r.monthly_return_pct);

    if (equityChart.current) equityChart.current.destroy();
    equityChart.current = new Chart(equityRef.current, {
      type: 'line',
      data: {
        labels: ['Start', ...labels],
        datasets: [{
          label: 'Account Value',
          data: [investor.starting_capital, ...navValues],
          borderColor: '#5aa7ff',
          backgroundColor: 'rgba(90,167,255,0.1)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#5aa7ff',
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1,
            titleColor: '#a6b4d0', bodyColor: '#eaf2ff',
            callbacks: { label: ctx => ` ${fmt(ctx.raw as number)}` },
          },
        },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#a6b4d0', font: { size: 11 }, callback: v => `$${Number(v).toLocaleString()}` },
            grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });

    if (barChart.current) barChart.current.destroy();
    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Monthly Return',
          data: returnValues,
          backgroundColor: returnValues.map(v => v >= 0 ? 'rgba(54,211,153,0.75)' : 'rgba(248,113,113,0.75)'),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1628', borderColor: '#1b2a49', borderWidth: 1,
            callbacks: { label: ctx => ` ${fmtPct(ctx.raw as number)}` },
          },
        },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#a6b4d0', font: { size: 11 }, callback: v => `${v}%` },
            grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });

    return () => { equityChart.current?.destroy(); barChart.current?.destroy(); };
  }, [navRecords, investor.starting_capital]);

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <StockTicker />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.logoOrb} />
            <div>
              <div className={styles.brandName}>OMA FUNDS</div>
              <div className={styles.brandSub}>Investor Portal</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.investorBadge}>{investor.name}</span>
            <button
              className={styles.logoutBtn}
              onClick={async () => {
                const { supabase } = await import('@/lib/supabase');
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>

        {/* Disclaimer */}
        <div className={styles.disclaimer}>
          ⓘ All figures shown are approximate values and may be subject to administrative adjustments.
          For questions, contact <a href="mailto:statements@omafunds.com" style={{ color: 'var(--blue)' }}>
          statements@omafunds.com</a>
        </div>

        {/* Hero — Current NAV */}
        <div className={styles.heroGrid}>
          <div className={styles.navCard}>
            <p className={styles.metricLabel}>Your Account Value</p>
            <p className={styles.navValue}>{fmt(currentNav)}</p>
            <div className={styles.navMeta}>
              <span>Member since {investor.contribution_date
                ? new Date(investor.contribution_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : '—'
              }</span>
              {currentReturn !== 0 && (
                <span style={{ color: currentReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtPct(currentReturn)} last month
                </span>
              )}
            </div>
          </div>

          <div className={styles.metricsGrid}>
            <MetricCard label="Last Month Return" value={fmtPct(currentReturn)}
              color={currentReturn >= 0 ? 'green' : 'red'} />
            <MetricCard label="Months Reporting" value={`${navRecords.length}`} color="blue" />
            <MetricCard
              label="Total Withdrawn"
              value={fmt(withdrawn)}
              color={withdrawn > 0 ? 'gold' : 'muted'}
            />
            <MetricCard
              label="Total Value Received"
              value={fmt(totalValueReceived)}
              color="blue"
            />
          </div>
        </div>

        {/* P&L Section */}
        <div className={styles.plGrid}>
          <div className={styles.plCard}>
            <p className={styles.metricLabel}>Total P&L vs Invested</p>
            <p className={styles.plValue} style={{ color: plVsInvested >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(plVsInvested)}
            </p>
            <p className={styles.plSub}>
              {fmtPct(plPctVsInvested)} on {fmt(invested)} invested
            </p>
          </div>

          <div className={styles.plCard}>
            <p className={styles.metricLabel}>Total P&L vs Net Capital</p>
            <p className={styles.plValue} style={{ color: plVsNetCapital >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(plVsNetCapital)}
            </p>
            <p className={styles.plSub}>
              {netCapital >= 0
                ? `${fmtPct(plPctVsNetCapital)} on ${fmt(netCapital)} net capital`
                : `Net capital: ${fmt(netCapital)} (withdrawals exceed contributions)`
              }
            </p>
          </div>

          <div className={styles.plCard}>
            <p className={styles.metricLabel}>Capital Summary</p>
            <div className={styles.capitalRows}>
              <div className={styles.capitalRow}>
                <span>Invested</span>
                <span>{fmt(invested)}</span>
              </div>
              <div className={styles.capitalRow}>
                <span>Withdrawn</span>
                <span style={{ color: withdrawn > 0 ? 'var(--gold)' : 'var(--muted)' }}>
                  {withdrawn > 0 ? `- ${fmt(withdrawn)}` : fmt(withdrawn)}
                </span>
              </div>
              <div className={styles.capitalRow} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Net Capital</span>
                <span style={{ fontWeight: 600, color: netCapital >= 0 ? 'var(--text)' : 'var(--red)' }}>
                  {fmt(netCapital)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        {navRecords.length > 0 && (
          <>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h2 className={styles.chartTitle}>Account Value Growth</h2>
                <p className={styles.chartSub}>Your NAV over time</p>
              </div>
              <div className={styles.chartWrap}><canvas ref={equityRef} /></div>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h2 className={styles.chartTitle}>Monthly Performance</h2>
                <p className={styles.chartSub}>Gain / loss per month</p>
              </div>
              <div className={styles.chartWrap}><canvas ref={barRef} /></div>
            </div>

            {/* Statement history table */}
            <div className={styles.tableCard}>
              <h2 className={styles.chartTitle} style={{ marginBottom: 20 }}>Statement History</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Monthly Return</th>
                      <th>Account Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...navRecords].reverse().map(r => (
                      <tr key={r.id}>
                        <td>{MONTHS[r.month]} {r.year}</td>
                        <td style={{ color: r.monthly_return_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmtPct(r.monthly_return_pct)}
                        </td>
                        <td>{fmt(r.nav)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {navRecords.length === 0 && (
          <div className={styles.chartCard} style={{ textAlign: 'center', padding: '48px 32px' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>
              Statement data coming soon
            </p>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              Your monthly performance charts will appear here once statements are uploaded.
            </p>
          </div>
        )}

        {/* Footer disclaimer */}
        <div className={styles.footerDisclaimer}>
          <p>
            All figures are approximate and subject to adjustment by OMA Funds management.
            Past performance does not guarantee future results. This portal is for informational
            purposes only and does not constitute investment advice. For official records or questions,
            contact <a href="mailto:statements@omafunds.com">statements@omafunds.com</a>
          </p>
        </div>

      </main>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'var(--green)', red: 'var(--red)', blue: 'var(--blue)',
    gold: 'var(--gold)', muted: 'var(--muted)',
  };
  return (
    <div className={styles.metricCard}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue} style={{ color: colorMap[color] ?? 'var(--text)' }}>{value}</p>
    </div>
  );
}
