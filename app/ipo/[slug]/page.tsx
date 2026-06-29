'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './ipo.module.css';

interface Holding {
  id: string;
  company_name: string;
  ticker: string | null;
  shares: number;
  entry_price: number;
  current_valuation: number;
  entry_date: string | null;
  notes: string | null;
}

export default function IpoPortalPage() {
  const params = useParams();
  const router = useRouter();
  const [investor, setInvestor] = useState<{ name: string; slug: string } | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const slug = params.slug as string;
      const res = await fetch(`/api/ipo-data?slug=${slug}`, {
        headers: { 'x-user-id': session.user.id }
      });

      if (!res.ok) { router.push('/login'); return; }

      const data = await res.json();
      setInvestor(data.investor);
      setHoldings(data.holdings);
      setLoading(false);
    }
    load();
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtShares = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  const calcValue = (h: Holding) => h.shares * h.current_valuation;
  const calcCost = (h: Holding) => h.shares * h.entry_price;
  const calcGain = (h: Holding) => calcValue(h) - calcCost(h);
  const calcGainPct = (h: Holding) => h.entry_price > 0 ? ((h.current_valuation - h.entry_price) / h.entry_price) * 100 : 0;

  const totalValue = holdings.reduce((s, h) => s + calcValue(h), 0);
  const totalCost = holdings.reduce((s, h) => s + calcCost(h), 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.loadingOrb} />
      <p className={styles.loadingText}>Loading your portfolio...</p>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.noise} />
      <div className={styles.vignette} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.crest}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4AF6A" strokeWidth="1.2" />
                <path d="M12 8l-4 2.5v3L12 16l4-2.5v-3L12 8z" fill="#D4AF6A" opacity="0.85" />
              </svg>
            </div>
            <div>
              <div className={styles.brandName}>OMA FUNDS</div>
              <div className={styles.brandSub}>Private Holdings</div>
            </div>
          </div>
          <a href={`/i/${investor?.slug}`} className={styles.backLink}>
            ← Main Portfolio
          </a>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero */}
        <div className={styles.hero}>
          <p className={styles.heroEyebrow}>Pre-IPO & Private Equity</p>
          <h1 className={styles.heroTitle}>{investor?.name}'s Holdings</h1>
          <p className={styles.heroSub}>
            Estimated value of private market positions, updated by fund management
          </p>
        </div>

        {/* Total summary */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryMain}>
            <p className={styles.summaryLabel}>Total Estimated Value</p>
            <p className={styles.summaryValue}>{fmt(totalValue)}</p>
            <div className={styles.summaryMeta}>
              <span className={totalGain >= 0 ? styles.gainPos : styles.gainNeg}>
                {totalGain >= 0 ? '+' : ''}{fmt(totalGain)} ({fmtPct(totalGainPct)})
              </span>
              <span className={styles.summaryDivider}>·</span>
              <span>{holdings.length} position{holdings.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className={styles.summaryStats}>
            <div className={styles.statBlock}>
              <p className={styles.statLabel}>Total Invested</p>
              <p className={styles.statValue}>{fmt(totalCost)}</p>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statBlock}>
              <p className={styles.statLabel}>Unrealized Gain</p>
              <p className={styles.statValue} style={{ color: totalGain >= 0 ? '#D4AF6A' : '#E07856' }}>
                {fmtPct(totalGainPct)}
              </p>
            </div>
          </div>
        </div>

        {/* Holdings */}
        {holdings.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>◇</div>
            <p className={styles.emptyTitle}>No Holdings Yet</p>
            <p className={styles.emptySub}>
              Your private market positions will appear here once added by fund management.
            </p>
          </div>
        ) : (
          <div className={styles.holdingsGrid}>
            {holdings.map(h => {
              const value = calcValue(h);
              const gain = calcGain(h);
              const gainPct = calcGainPct(h);
              const isExpanded = selected === h.id;

              return (
                <div
                  key={h.id}
                  className={`${styles.holdingCard} ${isExpanded ? styles.holdingCardExpanded : ''}`}
                  onClick={() => setSelected(isExpanded ? null : h.id)}
                >
                  <div className={styles.holdingHeader}>
                    <div>
                      <h3 className={styles.holdingName}>{h.company_name}</h3>
                      {h.ticker && <span className={styles.holdingTicker}>{h.ticker}</span>}
                    </div>
                    <div className={styles.holdingValue}>
                      <p className={styles.holdingValueAmount}>{fmt(value)}</p>
                      <p className={gainPct >= 0 ? styles.gainPos : styles.gainNeg}>
                        {fmtPct(gainPct)}
                      </p>
                    </div>
                  </div>

                  <div className={styles.holdingBar}>
                    <div
                      className={styles.holdingBarFill}
                      style={{ width: `${Math.min(100, Math.max(8, (value / Math.max(...holdings.map(calcValue))) * 100))}%` }}
                    />
                  </div>

                  <div className={styles.holdingDetails}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Shares</span>
                      <span className={styles.detailValue}>{fmtShares(h.shares)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Entry Price</span>
                      <span className={styles.detailValue}>${h.entry_price.toFixed(2)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Current Est.</span>
                      <span className={styles.detailValue}>${h.current_valuation.toFixed(2)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Gain/Loss</span>
                      <span className={styles.detailValue} style={{ color: gain >= 0 ? '#D4AF6A' : '#E07856' }}>
                        {gain >= 0 ? '+' : ''}{fmt(gain)}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (h.entry_date || h.notes) && (
                    <div className={styles.holdingExpanded}>
                      {h.entry_date && (
                        <p className={styles.expandedRow}>
                          <span>Entry Date</span>
                          <span>{new Date(h.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                      )}
                      {h.notes && (
                        <p className={styles.expandedNote}>{h.notes}</p>
                      )}
                    </div>
                  )}

                  <div className={styles.expandHint}>
                    {isExpanded ? '— Click to collapse' : '+ Click for details'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Disclaimer */}
        <div className={styles.disclaimer}>
          <p>
            All valuations shown are estimates provided by OMA Funds management for informational purposes only.
            They are not legally binding, do not constitute an offer or sale of securities, and do not guarantee
            any future value or liquidity event. Private market investments carry significant risk including total
            loss of capital. For questions, contact{' '}
            <a href="mailto:statements@omafunds.com">statements@omafunds.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}
