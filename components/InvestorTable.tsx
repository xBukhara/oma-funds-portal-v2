'use client';
import { useState, useEffect } from 'react';
import type { Investor } from '@/types';
import CSVUploader from './CSVUploader';
import styles from './InvestorTable.module.css';

interface Props {
  investors: Investor[];
  onUpdate: (investors: Investor[]) => void;
}

const EMPTY_FORM = {
  name: '', email: '', slug: '',
  starting_capital: '', share_pct: '', temp_password: '',
};

export default function InvestorTable({ investors: initialInvestors, onUpdate }: Props) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);
  const [mode, setMode] = useState<'table' | 'add' | 'csv'>('table');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';
  const headers = { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret };

  useEffect(() => {
    fetchInvestors();
  }, []);

  async function fetchInvestors() {
    setFetching(true);
    try {
      const res = await fetch('/api/admin/investors', { headers });
      const data = await res.json();
      if (data.investors) {
        setInvestors(data.investors);
        onUpdate(data.investors);
      }
    } catch (e) {
      console.error('Failed to fetch investors', e);
    } finally {
      setFetching(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/admin/investors', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...form,
        starting_capital: parseFloat(form.starting_capital),
        share_pct: parseFloat(form.share_pct),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed to create investor');
      setSaving(false);
      return;
    }

    const updated = [data.investor, ...investors];
    setInvestors(updated);
    onUpdate(updated);
    setForm(EMPTY_FORM);
    setMode('table');
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/investors?id=${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      const updated = investors.filter(i => i.id !== id);
      setInvestors(updated);
      onUpdate(updated);
    }
    setDeleteConfirm(null);
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Investors</h1>
          <p className={styles.sub}>
            {fetching ? 'Loading...' : `${investors.length} investor${investors.length !== 1 ? 's' : ''} in the fund`}
          </p>
        </div>
        <div className={styles.topActions}>
          <button
            className={`${styles.actionBtn} ${mode === 'csv' ? styles.actionBtnActive : ''}`}
            onClick={() => setMode(mode === 'csv' ? 'table' : 'csv')}
          >
            📋 CSV Import
          </button>
          <button
            className={`${styles.addBtn} ${mode === 'add' ? styles.addBtnCancel : ''}`}
            onClick={() => setMode(mode === 'add' ? 'table' : 'add')}
          >
            {mode === 'add' ? 'Cancel' : '+ Add Investor'}
          </button>
        </div>
      </div>

      {/* CSV Uploader */}
      {mode === 'csv' && (
        <div className={styles.csvWrap}>
          <CSVUploader onComplete={() => { fetchInvestors(); setMode('table'); }} />
        </div>
      )}

      {/* Add form */}
      {mode === 'add' && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <h2 className={styles.formTitle}>New Investor</h2>
          <div className={styles.formGrid}>
            <Field label="Full Name" required>
              <input className={styles.input} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith" required />
            </Field>
            <Field label="Email" required>
              <input type="email" className={styles.input} value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com" required />
            </Field>
            <Field label="Portal Slug" required hint="/i/[slug]">
              <input className={styles.input} value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="jane-smith" required />
            </Field>
            <Field label="Temp Password" required>
              <input type="password" className={styles.input} value={form.temp_password}
                onChange={e => setForm(f => ({ ...f, temp_password: e.target.value }))}
                placeholder="Temporary password" required />
            </Field>
            <Field label="Starting Capital ($)" required>
              <input type="number" className={styles.input} value={form.starting_capital}
                onChange={e => setForm(f => ({ ...f, starting_capital: e.target.value }))}
                placeholder="50000" min="0" step="0.01" required />
            </Field>
            <Field label="Fund Share %" hint="e.g. 10 for 10%">
              <input type="number" className={styles.input} value={form.share_pct}
                onChange={e => setForm(f => ({ ...f, share_pct: e.target.value }))}
                placeholder="10" min="0" max="100" step="0.0001" />
            </Field>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Creating…' : 'Create Investor Account'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {mode === 'table' && (
        investors.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No investors yet</p>
            <p className={styles.emptySub}>Add investors manually or import via CSV.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Portal URL</th>
                  <th>Starting Capital</th>
                  <th>Share %</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {investors.map(inv => (
                  <tr key={inv.id}>
                    <td className={styles.nameCell}>{inv.name}</td>
                    <td className={styles.mutedCell}>{inv.email}</td>
                    <td>
                      <a href={`/i/${inv.slug}`} target="_blank" rel="noopener noreferrer" className={styles.slugLink}>
                        /i/{inv.slug} ↗
                      </a>
                    </td>
                    <td>{fmt(inv.starting_capital)}</td>
                    <td>{inv.share_pct}%</td>
                    <td className={styles.mutedCell}>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td>
                      {deleteConfirm === inv.id ? (
                        <div className={styles.confirmRow}>
                          <span className={styles.confirmText}>Delete?</span>
                          <button className={styles.confirmYes} onClick={() => handleDelete(inv.id)}>Yes</button>
                          <button className={styles.confirmNo} onClick={() => setDeleteConfirm(null)}>No</button>
                        </div>
                      ) : (
                        <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(inv.id)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}{required && <span style={{ color: 'var(--blue)' }}> *</span>}
        {hint && <span className={styles.fieldHint}> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}
