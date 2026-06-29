'use client';
import { useState, useEffect } from 'react';
import type { Investor } from '@/types';

interface IpoHolding {
  id: string;
  investor_id: string;
  company_name: string;
  ticker: string | null;
  shares: number;
  entry_price: number;
  current_valuation: number;
  entry_date: string | null;
  notes: string | null;
  created_at: string;
  investors?: { name: string; email: string; slug: string };
}

interface Props {
  investors: Investor[];
}

const EMPTY_FORM = {
  investor_id: '', company_name: '', ticker: '', shares: '',
  entry_price: '', current_valuation: '', entry_date: '', notes: '',
};

export default function IpoHoldingsManager({ investors }: Props) {
  const [holdings, setHoldings] = useState<IpoHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterInvestor, setFilterInvestor] = useState('');

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';
  const headers = { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret };

  useEffect(() => { fetchHoldings(); }, []);

  async function fetchHoldings() {
    setLoading(true);
    const res = await fetch('/api/admin/ipo-holdings', { headers });
    const data = await res.json();
    setHoldings(data.holdings ?? []);
    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  function calcValue(h: { shares: number; current_valuation: number }) {
    return h.shares * h.current_valuation;
  }
  function calcCost(h: { shares: number; entry_price: number }) {
    return h.shares * h.entry_price;
  }
  function calcGain(h: { shares: number; entry_price: number; current_valuation: number }) {
    return calcValue(h) - calcCost(h);
  }
  function calcGainPct(h: { entry_price: number; current_valuation: number }) {
    return h.entry_price > 0 ? ((h.current_valuation - h.entry_price) / h.entry_price) * 100 : 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      investor_id: form.investor_id,
      company_name: form.company_name,
      ticker: form.ticker,
      shares: form.shares,
      entry_price: form.entry_price,
      current_valuation: form.current_valuation,
      entry_date: form.entry_date,
      notes: form.notes,
    };

    const res = editingId
      ? await fetch('/api/admin/ipo-holdings', {
          method: 'PATCH', headers, body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await fetch('/api/admin/ipo-holdings', {
          method: 'POST', headers, body: JSON.stringify(payload),
        });

    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return; }

    await fetchHoldings();
    setForm(EMPTY_FORM);
    setShowAdd(false);
    setEditingId(null);
    setSaving(false);
  }

  function startEdit(h: IpoHolding) {
    setForm({
      investor_id: h.investor_id,
      company_name: h.company_name,
      ticker: h.ticker ?? '',
      shares: String(h.shares),
      entry_price: String(h.entry_price),
      current_valuation: String(h.current_valuation),
      entry_date: h.entry_date ?? '',
      notes: h.notes ?? '',
    });
    setEditingId(h.id);
    setShowAdd(true);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/ipo-holdings?id=${id}`, { method: 'DELETE', headers });
    await fetchHoldings();
    setDeleteConfirm(null);
  }

  const filteredHoldings = filterInvestor
    ? holdings.filter(h => h.investor_id === filterInvestor)
    : holdings;

  // Group by investor for summary
  const investorTotals = investors.map(inv => {
    const invHoldings = holdings.filter(h => h.investor_id === inv.id);
    const totalValue = invHoldings.reduce((s, h) => s + calcValue(h), 0);
    const totalCost = invHoldings.reduce((s, h) => s + calcCost(h), 0);
    return { investor: inv, count: invHoldings.length, totalValue, totalCost, gain: totalValue - totalCost };
  }).filter(t => t.count > 0);

  const inputStyle = {
    background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text)',
    outline: 'none', fontFamily: 'var(--font-body)', width: '100%',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600 as const, textTransform: 'uppercase' as const,
    letterSpacing: '.1em', color: 'var(--muted)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Legal disclaimer */}
      <div style={{ background: 'rgba(232,200,122,0.06)', border: '1px solid rgba(232,200,122,0.2)',
        borderRadius: 12, padding: '14px 18px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          ⚖ All Pre-IPO valuations entered here are <strong style={{ color: 'var(--gold)' }}>estimates only</strong> and
          are not legally binding. They do not constitute investment advice, a guarantee of value, or an offer to sell securities.
        </p>
      </div>

      {/* Summary cards */}
      {investorTotals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {investorTotals.map(t => (
            <div key={t.investor.id} style={{ background: 'rgba(14,22,40,0.7)', border: '1px solid var(--card-border)',
              borderRadius: 14, padding: 16, cursor: 'pointer' }}
              onClick={() => setFilterInvestor(filterInvestor === t.investor.id ? '' : t.investor.id)}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>{t.investor.name}</p>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', margin: '0 0 4px' }}>
                {fmt(t.totalValue)}
              </p>
              <p style={{ fontSize: 12, margin: 0, color: t.gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {t.gain >= 0 ? '+' : ''}{fmt(t.gain)} • {t.count} position{t.count !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {filterInvestor && (
            <button onClick={() => setFilterInvestor('')} style={{
              background: 'rgba(90,167,255,0.1)', border: '1px solid rgba(90,167,255,0.3)',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }}>
              {investors.find(i => i.id === filterInvestor)?.name} ✕
            </button>
          )}
        </div>
        <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(EMPTY_FORM); }}
          style={{ background: 'linear-gradient(135deg, #5aa7ff, #a78bfa)', border: 'none',
            borderRadius: 10, padding: '10px 20px', fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
          {showAdd ? 'Cancel' : '+ Add Holding'}
        </button>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <form onSubmit={handleSubmit} style={{ background: 'rgba(14,22,40,0.8)', border: '1px solid var(--card-border)',
          borderRadius: 18, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: 0 }}>
            {editingId ? 'Edit Holding' : 'New IPO Holding'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Investor *</label>
              <select value={form.investor_id} onChange={e => setForm(f => ({ ...f, investor_id: e.target.value }))}
                required style={inputStyle}>
                <option value="">Select investor...</option>
                {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={labelStyle}>Company Name *</label>
              <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="e.g. SpaceX, Anthropic" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={labelStyle}>Ticker (optional)</label>
              <input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="e.g. SPCX" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={labelStyle}>Shares *</label>
              <input type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                placeholder="1000" step="0.0001" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={labelStyle}>Entry Price / Share ($) *</label>
              <input type="number" value={form.entry_price} onChange={e => setForm(f => ({ ...f, entry_price: e.target.value }))}
                placeholder="12.50" step="0.0001" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={labelStyle}>Current Valuation / Share ($) *</label>
              <input type="number" value={form.current_valuation} onChange={e => setForm(f => ({ ...f, current_valuation: e.target.value }))}
                placeholder="18.75" step="0.0001" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={labelStyle}>Entry Date</label>
              <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes (optional)</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Series C round, lockup expires 2027" style={inputStyle} />
            </div>
          </div>

          {/* Live preview */}
          {form.shares && form.entry_price && form.current_valuation && (
            <div style={{ background: 'rgba(7,10,18,0.5)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 28 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Cost Basis</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{fmt(parseFloat(form.shares) * parseFloat(form.entry_price))}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Current Value</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--blue)' }}>
                  {fmt(parseFloat(form.shares) * parseFloat(form.current_valuation))}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Est. Gain/Loss</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0,
                  color: parseFloat(form.current_valuation) >= parseFloat(form.entry_price) ? 'var(--green)' : 'var(--red)' }}>
                  {fmtPct(((parseFloat(form.current_valuation) - parseFloat(form.entry_price)) / parseFloat(form.entry_price)) * 100)}
                </p>
              </div>
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>}

          <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #5aa7ff, #a78bfa)',
            border: 'none', borderRadius: 10, padding: '12px 24px', fontFamily: 'var(--font-display)',
            fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', alignSelf: 'flex-start',
            opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving...' : editingId ? 'Update Holding' : 'Add Holding'}
          </button>
        </form>
      )}

      {/* Holdings table */}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading holdings...</p>
      ) : filteredHoldings.length === 0 ? (
        <div style={{ background: 'rgba(14,22,40,0.5)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>
            No IPO holdings yet
          </p>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            Add holdings using the button above.
          </p>
        </div>
      ) : (
        <div style={{ background: 'rgba(14,22,40,0.7)', border: '1px solid var(--card-border)',
          borderRadius: 16, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr>
                {['Investor', 'Company', 'Shares', 'Entry Price', 'Current Val.', 'Cost Basis', 'Current Value', 'Gain/Loss', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)',
                    borderBottom: '1px solid var(--card-border)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map(h => {
                const value = calcValue(h);
                const cost = calcCost(h);
                const gain = calcGain(h);
                const gainPct = calcGainPct(h);
                return (
                  <tr key={h.id}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{h.investors?.name ?? '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {h.company_name}
                      {h.ticker && <span style={{ color: 'var(--muted)', fontSize: 11 }}> ({h.ticker})</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{h.shares.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>${h.entry_price.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px' }}>${h.current_valuation.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{fmt(cost)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{fmt(value)}</td>
                    <td style={{ padding: '12px 14px', color: gain >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {fmtPct(gainPct)}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit(h)} style={{ background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 10px',
                        fontSize: 11, color: 'var(--blue)', cursor: 'pointer', marginRight: 6 }}>Edit</button>
                      {deleteConfirm === h.id ? (
                        <>
                          <button onClick={() => handleDelete(h.id)} style={{ background: 'rgba(248,113,113,0.15)',
                            border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '4px 10px',
                            fontSize: 11, color: 'var(--red)', cursor: 'pointer', marginRight: 4 }}>Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 10px',
                            fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>No</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(h.id)} style={{ background: 'transparent',
                          border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '4px 10px',
                          fontSize: 11, color: 'rgba(248,113,113,0.7)', cursor: 'pointer' }}>Remove</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
