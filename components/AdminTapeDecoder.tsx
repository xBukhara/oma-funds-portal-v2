'use client';
import { useState } from 'react';
import type { FundReturn } from '@/types';
import styles from './AdminCharts.module.css';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const SPX_2025 = [2.70, -1.42, -5.75, -0.76, 4.96, -0.41, 1.13, -1.18, -0.30, -1.01, 5.73, -2.50];

const NARRATIVES: Record<number, string> = {
  0: 'January opened with strong AI-driven momentum. OMA led with concentrated tech positions capturing the early-year rally.',
  1: 'February brought modest consolidation. Defensive positioning in aerospace limited downside.',
  2: 'March delivered the standout month. Multiple positions broke out simultaneously, led by emerging specials.',
  3: 'April saw sector rotation. The fund navigated the shift with minimal drawdown.',
  4: 'May recovered with broad-based tech strength. Megacap exposure added significant value.',
  5: 'June continued the grind higher. Gold and commodity positions contributed.',
  6: 'July saw slight pullback. Risk management kept the drawdown shallow.',
  7: 'August was the peak drawdown month. The fund held through volatility without capitulating.',
  8: 'September was a strong recovery month. Positions that weathered August bounced sharply.',
  9: 'October saw mild profit taking. The fund maintained its edge vs benchmarks.',
  10: 'November delivered a solid close. Positioning into year-end set up December.',
  11: 'December capped the year with a strong final push. YTD performance secured significant outperformance.',
};

interface Props { fundReturns: FundReturn[]; }

export default function AdminTapeDecoder({ fundReturns }: Props) {
  const [idx, setIdx] = useState(0);

  if (fundReturns.length === 0) return (
    <div style={{ padding: '80px 40px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>No data</p>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Upload a statement to use the Tape Decoder.</p>
    </div>
  );

  const current = fundReturns[idx];
  const oma = current.monthly_return_pct;
  const spx = SPX_2025[idx] ?? 0;
  const alpha = oma - spx;
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tape Decoder</h1>
        <p className={styles.sub}>Scrub through each month and decode the market narrative</p>
      </div>

      <div className={styles.tapeGrid}>
        {/* Slider panel */}
        <div className={styles.chartCard} style={{ flex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--muted)', margin: '0 0 6px' }}>Selected Month</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
              {MONTHS[current.month]} {current.year}
            </p>
          </div>

          <input
            type="range"
            min={0}
            max={fundReturns.length - 1}
            value={idx}
            onChange={e => setIdx(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--blue)', marginBottom: 24 }}
          />

          {/* Month grid */}
          <div className={styles.monthGrid}>
            {fundReturns.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setIdx(i)}
                className={`${styles.monthBtn} ${i === idx ? styles.monthBtnActive : ''}`}
                style={{ color: r.monthly_return_pct >= 0 ? 'var(--green)' : 'var(--red)' }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{MONTHS[r.month].slice(0, 3)}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtPct(r.monthly_return_pct)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 260 }}>
          <div className={styles.tapeCard}>
            <p className={styles.tapeLabel}>OMA Return</p>
            <p className={styles.tapeValue} style={{ color: oma >= 0 ? 'var(--blue)' : 'var(--red)', fontSize: 38 }}>
              {fmtPct(oma)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Monthly print from statement</p>
          </div>

          <div className={styles.tapeCard}>
            <p className={styles.tapeLabel}>Alpha vs S&P 500</p>
            <p className={styles.tapeValue} style={{ color: alpha >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmtPct(alpha)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              S&P: {fmtPct(spx)}
            </p>
          </div>

          <div className={styles.tapeCard}>
            <p className={styles.tapeLabel}>Market Narrative</p>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
              {NARRATIVES[idx] ?? 'Month data available.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
