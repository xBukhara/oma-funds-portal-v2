'use client';
import { useEffect, useState, useRef } from 'react';
import styles from './StockTicker.module.css';

const SYMBOLS = [
  'NVDA', 'AMD', 'SPY', 'QQQ', 'META', 'TSM',
  'RTX', 'LMT', 'NOC', 'GLD', 'SLV', 'CORZ',
  'ACHR', 'ONON', 'HUBB', 'GLW', 'XOM', 'TLT'
];

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
}

export default function StockTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState(false);

  async function fetchQuotes() {
    try {
      const res = await fetch(`/api/ticker?symbols=${SYMBOLS.join(',')}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setQuotes(data.quotes);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  if (error || quotes.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...quotes, ...quotes];

  return (
    <div className={styles.ticker}>
      <div className={styles.tickerLabel}>LIVE</div>
      <div className={styles.tickerTrack}>
        <div className={styles.tickerInner}>
          {items.map((q, i) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.symbol}>{q.symbol}</span>
              <span className={styles.price}>${q.price.toFixed(2)}</span>
              <span className={q.changePct >= 0 ? styles.up : styles.down}>
                {q.changePct >= 0 ? '▲' : '▼'} {Math.abs(q.changePct).toFixed(2)}%
              </span>
              <span className={styles.divider}>|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
