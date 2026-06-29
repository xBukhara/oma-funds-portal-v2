'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Holding {
  shares: number;
  current_valuation: number;
  entry_price: number;
}

interface Props {
  slug: string;
  userId?: string;
}

export default function IpoSummaryCard({ slug, userId }: Props) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Use passed userId if available, otherwise fetch from session
      let uid = userId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user.id;
      }
      if (!uid) { setLoading(false); return; }

      try {
        const res = await fetch(`/api/ipo-data?slug=${slug}`, { headers: { 'x-user-id': uid } });
        const d = await res.json();
        setHoldings(d.holdings ?? []);
      } catch {
        // silently fail — card just won't show
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, userId]);

  if (loading || holdings.length === 0) return null;

  const totalValue = holdings.reduce((s, h) => s + h.shares * h.current_valuation, 0);
  const totalCost = holdings.reduce((s, h) => s + h.shares * h.entry_price, 0);
  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <a
      href={`/ipo/${slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: 'linear-gradient(155deg, rgba(20,18,15,0.95), rgba(10,9,8,0.92))',
        border: '1px solid rgba(212,175,106,0.25)',
        borderRadius: 20,
        padding: '24px 28px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,106,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,175,106,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        position: 'absolute', top: -1, left: -1, right: -1, height: 2,
        background: 'linear-gradient(90deg, transparent, #D4AF6A, transparent)', opacity: 0.5,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4AF6A" strokeWidth="1.4" />
            </svg>
            <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: '#D4AF6A', fontWeight: 700 }}>Pre-IPO Holdings</span>
          </div>
          <p style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", fontSize: 28,
            fontWeight: 600, color: '#F0EBE0', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            {fmt(totalValue)}
          </p>
          <p style={{ fontSize: 12, color: gain >= 0 ? '#D4AF6A' : '#E07856', margin: 0, fontWeight: 600 }}>
            {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%) ·{' '}
            <span style={{ color: 'rgba(240,235,224,0.5)', fontWeight: 400 }}>
              {holdings.length} position{holdings.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(240,235,224,0.55)', display: 'flex',
          alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          View Portfolio
          <span style={{ color: '#D4AF6A' }}>→</span>
        </div>
      </div>
    </a>
  );
}
