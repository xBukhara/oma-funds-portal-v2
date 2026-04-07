'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../app/login/login.module.css'; // reuse login styles

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Invalid admin password.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoOrb} />
        </div>
        <p className={styles.brand}>OMA FUNDS</p>
        <h1 className={styles.title}>Admin Access</h1>
        <p className={styles.sub}>Restricted — authorized personnel only</p>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••••••"
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Verifying…' : 'Enter Admin Portal →'}
          </button>
        </form>
      </div>
    </div>
  );
}
