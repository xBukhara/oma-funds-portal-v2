'use client';
import { useState } from 'react';
import type { Investor } from '@/types';

interface Props {
  investors: Investor[];
  onUpdate: () => void;
}

export default function NavEditor({ investors, onUpdate }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [newNav, setNewNav] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ old_nav: number; new_nav: number } | null>(null);
  const [error, setError] = useState('');

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const selected = investors.find(i => i.id === selectedId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !newNav) return;
    setSaving(true);
    setError('');
    setResult(null);

    const res = await fetch('/api/admin/edit-nav', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        investor_id: selectedId,
        new_nav: parseFloat(newNav),
        note: note || 'Admin NAV adjustment',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed to update NAV');
      setSaving(false);
      return;
    }

    setResult({ old_nav: data.old_nav, new_nav: data.new_nav });
    setNewNav('');
    setNote('');
    setSaving(false);
    onUpdate();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: 'rgba(167,139,250,0.06)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: 12,
        padding: '14px 18px',
        fontSize: 13,
        color: 'var(--muted)',
        lineHeight: 1.6,
      }}>
        ✎ <strong style={{ color: 'var(--text)' }}>Manual NAV edit</strong> — 
        updates the investor's latest NAV record and logs the change in Account History.
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.1em', color: 'var(--muted)' }}>Investor</label>
            <select
              value={selectedId}
              onChange={e => {
                setSelectedId(e.target.value);
                const inv = investors.find(i => i.id === e.target.value);
                if (inv) setNewNav(inv.starting_capital.toFixed(2));
              }}
              required
              style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text)',
                outline: 'none', fontFamily: 'var(--font-body)' }}
            >
              <option value="">Select investor...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} — {fmt(inv.starting_capital)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.1em', color: 'var(--muted)' }}>New NAV ($)</label>
            <input
              type="number"
              value={newNav}
              onChange={e => setNewNav(e.target.value)}
              step="0.01"
              min="0"
              required
              placeholder="Enter new NAV value"
              style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text)',
                outline: 'none', fontFamily: 'var(--font-body)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.1em', color: 'var(--muted)' }}>Reason / Note</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Monthly statement adjustment, fee correction..."
              style={{ background: 'rgba(7,10,18,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text)',
                outline: 'none', fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>

        {/* Preview */}
        {selected && newNav && (
          <div style={{ background: 'rgba(7,10,18,0.5)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 32 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px',
                textTransform: 'uppercase', letterSpacing: '.1em' }}>Current NAV</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>
                {fmt(selected.starting_capital)}
              </p>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 20, alignSelf: 'center' }}>→</div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px',
                textTransform: 'uppercase', letterSpacing: '.1em' }}>New NAV</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0,
                fontFamily: 'var(--font-display)', color: 'var(--blue)' }}>
                {fmt(parseFloat(newNav))}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px',
                textTransform: 'uppercase', letterSpacing: '.1em' }}>Change</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)',
                color: parseFloat(newNav) >= selected.starting_capital ? 'var(--green)' : 'var(--red)' }}>
                {parseFloat(newNav) >= selected.starting_capital ? '+' : ''}
                {fmt(parseFloat(newNav) - selected.starting_capital)}
              </p>
            </div>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px', margin: 0 }}>
            {error}
          </p>
        )}

        {result && (
          <p style={{ fontSize: 13, color: 'var(--green)', background: 'rgba(54,211,153,0.08)',
            border: '1px solid rgba(54,211,153,0.2)', borderRadius: 10, padding: '10px 14px', margin: 0 }}>
            ✓ NAV updated from {fmt(result.old_nav)} to {fmt(result.new_nav)} — logged in Account History.
          </p>
        )}

        <button type="submit" disabled={saving} style={{
          background: 'linear-gradient(135deg, #5aa7ff, #a78bfa)', border: 'none',
          borderRadius: 12, padding: '13px 24px', fontFamily: 'var(--font-display)',
          fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
          opacity: saving ? 0.5 : 1, alignSelf: 'flex-start',
        }}>
          {saving ? 'Saving...' : 'Update NAV →'}
        </button>
      </form>
    </div>
  );
}
