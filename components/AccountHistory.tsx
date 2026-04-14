'use client';
import { useState, useEffect } from 'react';
import type { Investor } from '@/types';
import styles from './AccountHistory.module.css';

interface Transaction {
  id: string;
  investor_id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  nav_before: number;
  nav_after: number;
  note: string | null;
  created_at: string;
  investors?: { name: string; email: string };
}

interface Props {
  investors: Investor[];
}

export default function AccountHistory({ investors }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'withdrawal' | 'deposit'>('withdrawal');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/transactions', {
        headers: { 'x-admin-secret': adminSecret }
      });
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvestor || !amount) return;
    setSaving(true);
    setError('');
    setSuccess('');

    const res = await fetch('/api/admin/withdrawal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        investor_id: selectedInvestor,
        amount: parseFloat(amount),
        type,
        note,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Transaction failed');
      setSaving(false);
      return;
    }

    const investor = investors.find(i => i.id === selectedInvestor);
    const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    setSuccess(
      `✓ ${type === 'withdrawal' ? 'Withdrawal' : 'Deposit'} of ${fmt(parseFloat(amount))} processed for ${investor?.name}. New NAV: ${fmt(data.nav_after)}`
    );
    setAmount('');
    setNote('');
    setSaving(false);
    fetchTransactions();
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Account History</h1>
        <p className={styles.sub}>Process withdrawals and deposits, view full transaction history</p>
      </div>

      {/* Adjuster form */}
      <div className={styles.adjusterCard}>
        <h2 className={styles.sectionTitle}>Capital Adjustment</h2>
        <p className={styles.sectionSub}>
          Withdrawals and deposits automatically recalculate all investor ownership percentages
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Investor</label>
              <select
                className={styles.select}
                value={selectedInvestor}
                onChange={e => setSelectedInvestor(e.target.value)}
                required
              >
                <option value="">Select investor...</option>
                {investors.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} — {fmt(inv.starting_capital)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Transaction Type</label>
              <div className={styles.typeToggle}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${type === 'withdrawal' ? styles.typeBtnActive : ''}`}
                  onClick={() => setType('withdrawal')}
                  style={{ '--active-color': 'var(--red)' } as React.CSSProperties}
                >
                  Withdrawal
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${type === 'deposit' ? styles.typeBtnActiveGreen : ''}`}
                  onClick={() => setType('deposit')}
                >
                  Deposit
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Amount ($)</label>
              <input
                type="number"
                className={styles.input}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="10000"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Note (optional)</label>
              <input
                type="text"
                className={styles.input}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Partial withdrawal request"
              />
            </div>
          </div>

          {/* Preview */}
          {selectedInvestor && amount && (
            <div className={styles.preview}>
              {(() => {
                const inv = investors.find(i => i.id === selectedInvestor);
                const totalCapital = investors.reduce((sum, i) => sum + i.starting_capital, 0);
                const adjustedCapital = inv
                  ? inv.starting_capital + (type === 'withdrawal' ? -parseFloat(amount) : parseFloat(amount))
                  : 0;
                const newTotal = totalCapital + (type === 'withdrawal' ? -parseFloat(amount) : parseFloat(amount));
                const newPct = newTotal > 0 ? (adjustedCapital / newTotal) * 100 : 0;
                return (
                  <>
                    <div className={styles.previewRow}>
                      <span>Current Capital</span>
                      <span>{fmt(inv?.starting_capital ?? 0)}</span>
                    </div>
                    <div className={styles.previewRow}>
                      <span>After {type === 'withdrawal' ? 'Withdrawal' : 'Deposit'}</span>
                      <span style={{ color: type === 'withdrawal' ? 'var(--red)' : 'var(--green)' }}>
                        {fmt(adjustedCapital)}
                      </span>
                    </div>
                    <div className={styles.previewRow}>
                      <span>New Ownership %</span>
                      <span style={{ color: 'var(--blue)' }}>{newPct.toFixed(2)}%</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Processing...' : `Process ${type === 'withdrawal' ? 'Withdrawal' : 'Deposit'} →`}
          </button>
        </form>
      </div>

      {/* Transaction history */}
      <div className={styles.historyCard}>
        <h2 className={styles.sectionTitle}>Transaction History</h2>
        {loading ? (
          <p className={styles.loading}>Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <div className={styles.empty}>
            <p>No transactions yet</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Investor</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>NAV Before</th>
                  <th>NAV After</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td className={styles.mutedCell}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {investors.find(i => i.id === t.investor_id)?.name ?? '—'}
                    </td>
                    <td>
                      <span className={t.type === 'withdrawal' ? styles.badgeRed : styles.badgeGreen}>
                        {t.type}
                      </span>
                    </td>
                    <td style={{ color: t.type === 'withdrawal' ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                      {t.type === 'withdrawal' ? '-' : '+'}{fmt(t.amount)}
                    </td>
                    <td className={styles.mutedCell}>{fmt(t.nav_before)}</td>
                    <td>{fmt(t.nav_after)}</td>
                    <td className={styles.mutedCell}>{t.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
