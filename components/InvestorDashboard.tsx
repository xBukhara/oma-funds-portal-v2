'use client';
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { Investor, NavRecord, Statement } from '@/types';
import styles from './InvestorDashboard.module.css';

Chart.register(...registerables);

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  investor: Investor;
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
  const totalGain = currentNav - investor.starting_capital;
  const totalGainPct = ((totalGain / investor.starting_capital) * 100);

  const isNewStatement = latestStatement &&
    !navRecords.some(r =>
      r.year === latestStatement.year && r.month === latestStatement.month
    );

  // Format helpers
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  useEffect(() => {
    if (!equityRef.current || !barRef.current) return;

    const labels = navRecords.map(r => `${MONTHS[r.month]} ${r.year}`);
    const navValues = navRecords.map(r => r.nav);
    const returnValues = navRecords.map(r => r.monthly_return_pct);

    // Equity curve
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
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1628',
            borderColor: '#1b2a49',
            borderWidth: 1,
            titleColor: '#a6b4d0',
            bodyColor: '#eaf2ff',
            callbacks: {
              label: ctx => ` ${fmt(ctx.raw as number)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: {
            ticks: { color: '#a6b4d0', font: { size: 11 }, callback: v => `$${Number(v).toLocaleString()}` },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });

    // Monthly returns bar chart
    if (barChart.current) barChart.current.destroy();
    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Monthly Return',
          data: returnValues,
          backgroundColor: returnValues.map(v => v >= 0
            ? 'rgba(54,211,153,0.75)'
            : 'rgba(248,113,113,0.75)'
          ),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1628',
            borderColor: '#1b2a49',
            borderWidth: 1,
            titleColor: '#a6b4d0',
            bodyColor: '#eaf2ff',
            callbacks: {
              label: ctx => ` ${fmtPct(ctx.raw as number)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#a6b4d0', font: { size: 11 } }, grid: { display: false } },
          y: {
            ticks: { color: '#a6b4d0', font: { size: 11 }, callback: v => `${v}%` },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });

    return () => {
      equityChart.current?.destroy();
      barChart.current?.destroy();
    };
  }, [navRecords, investor.starting_capital]);

  return (
    <div className={styles.page}>
      <div className={styles.bg} />

      {/* Nav */}
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
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* New statement banner */}
        {isNewStatement && (
          <div className={styles.banner}>
            📄 A new statement is available for {MONTHS[latestStatement!.month]} {latestStatement!.year}
          </div>
        )}

        {/* Hero metrics */}
        <div className={styles.heroGrid}>
          <div className={styles.navCard}>
            <p className={styles.metricLabel}>Your Account Value</p>
            <p className={styles.navValue}>{fmt(currentNav)}</p>
            <p className={styles.navSub}>Starting Capital: {fmt(investor.starting_capital)}</p>
          </div>

          <div className={styles.metricsGrid}>
            <MetricCard
              label="Last Month Return"
              value={fmtPct(currentReturn)}
              color={currentReturn >= 0 ? 'green' : 'red'}
            />
            <MetricCard
              label="Total Gain / Loss"
              value={fmt(totalGain)}
              color={totalGain >= 0 ? 'green' : 'red'}
            />
            <MetricCard
              label="Overall Return"
              value={fmtPct(totalGainPct)}
              color={totalGainPct >= 0 ? 'green' : 'red'}
            />
            <MetricCard
              label="Months Reporting"
              value={`${navRecords.length}`}
              color="blue"
            />
          </div>
        </div>

        {/* Equity curve */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h2 className={styles.chartTitle}>Account Value Growth</h2>
            <p className={styles.chartSub}>Your NAV over time</p>
          </div>
          <div className={styles.chartWrap}>
            <canvas ref={equityRef} />
          </div>
        </div>

        {/* Monthly returns */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h2 className={styles.chartTitle}>Monthly Performance</h2>
            <p className={styles.chartSub}>Gain / loss per month</p>
          </div>
          <div className={styles.chartWrap}>
            <canvas ref={barRef} />
          </div>
        </div>

        {/* Returns table */}
        {navRecords.length > 0 && (
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
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'var(--green)',
    red: 'var(--red)',
    blue: 'var(--blue)',
    gold: 'var(--gold)',
  };
  return (
    <div className={styles.metricCard}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue} style={{ color: colorMap[color] ?? 'var(--text)' }}>{value}</p>
    </div>
  );
}

function LogoutButton() {
  const { supabase } = require('@/lib/supabase');
  return (
    <button
      className={styles.logoutBtn}
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
      }}
    >
      Sign Out
    </button>
  );
}
