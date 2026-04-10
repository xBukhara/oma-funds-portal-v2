'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError('Login failed.');
      setLoading(false);
      return;
    }

    const isFirstLogin = user.user_metadata?.force_password_change === true;
    if (isFirstLogin) {
      router.push('/change-password');
      return;
    }

    // Use slug from user metadata if available
    // Otherwise fetch from API route which bypasses RLS
    const res = await fetch('/api/investor-slug', {
      headers: { 'x-user-id': user.id }
    });

    const slugData = await res.json();

    if (slugData?.slug) {
      router.push(`/i/${slugData.slug}`);
    } else {
      setError('Account not found. Please contact your fund manager.');
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
        <h1 className={styles.title}>Investor Portal</h1>
        <p className={styles.sub}>Sign in to access your account</p>
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <a href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </a>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
        <p className={styles.footer}>
          Need access?{' '}
          <a href="mailto:statements@omafunds.com" className={styles.link}>
            Contact OMA Funds
          </a>
        </p>
      </div>
    </div>
  );
}
