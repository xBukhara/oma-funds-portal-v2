'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';
import localStyles from './change.module.css';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase automatically handles the token from the reset email URL
    // and establishes a session — we just need to confirm user is authed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { force_password_change: false }, // clear the first-login flag
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Redirect to their dashboard
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: investor } = await supabase
      .from('investors')
      .select('slug')
      .eq('user_id', user.id)
      .single();

    if (investor?.slug) {
      router.push(`/i/${investor.slug}`);
    } else {
      router.push('/login');
    }
  }

  if (!ready) return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Verifying your session…</p>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoOrb} />
        </div>
        <p className={styles.brand}>OMA FUNDS</p>
        <h1 className={styles.title}>Set Your Password</h1>
        <p className={styles.sub}>Choose a secure password for your account</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Minimum 8 characters"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={styles.input}
              placeholder="Re-enter your password"
              required
            />
          </div>

          {/* Strength hints */}
          <div className={localStyles.hints}>
            <span className={password.length >= 8 ? localStyles.hintMet : localStyles.hint}>
              {password.length >= 8 ? '✓' : '○'} At least 8 characters
            </span>
            <span className={/[A-Z]/.test(password) ? localStyles.hintMet : localStyles.hint}>
              {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
            </span>
            <span className={/[0-9]/.test(password) ? localStyles.hintMet : localStyles.hint}>
              {/[0-9]/.test(password) ? '✓' : '○'} One number
            </span>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.btn}
            disabled={loading || password.length < 8 || password !== confirm}
          >
            {loading ? 'Saving…' : 'Set Password & Enter Portal →'}
          </button>
        </form>
      </div>
    </div>
  );
}
