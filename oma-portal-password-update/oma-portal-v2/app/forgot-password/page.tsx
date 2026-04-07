'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from '../login/login.module.css';
import localStyles from './forgot.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/change-password`,
    });

    if (resetError) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoOrb} />
        </div>
        <p className={styles.brand}>OMA FUNDS</p>
        <h1 className={styles.title}>Reset Password</h1>

        {sent ? (
          <div className={localStyles.successBox}>
            <div className={localStyles.successIcon}>✓</div>
            <p className={localStyles.successTitle}>Check your email</p>
            <p className={localStyles.successSub}>
              We sent a password reset link to <strong>{email}</strong>.
              Click the link in the email to set a new password.
            </p>
            <a href="/login" className={localStyles.backLink}>← Back to Login</a>
          </div>
        ) : (
          <>
            <p className={styles.sub}>
              Enter your email and we'll send you a reset link
            </p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link →'}
              </button>
            </form>
            <p className={styles.footer}>
              <a href="/login" className={styles.link}>← Back to Login</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
