'use client';
import { useState } from 'react';
import type { Investor, FundReturn, Statement } from '@/types';
import StatementUploader from './StatementUploader';
import InvestorTable from './InvestorTable';
import AdminDashboard from './AdminDashboard';
import AdminGrowth from './AdminGrowth';
import AdminTapeDecoder from './AdminTapeDecoder';
import EmailLog from './EmailLog';
import AccountHistory from './AccountHistory';
import NavSeeder from './NavSeeder';
import NavEditor from './NavEditor';
import IpoHoldingsManager from './IpoHoldingsManager';
import styles from './AdminPortal.module.css';

type Tab = 'upload' | 'investors' | 'history' | 'seed' | 'ipo' | 'dashboard' | 'growth' | 'tape' | 'emails';

interface Props {
  investors: Investor[];
  fundReturns: FundReturn[];
  statements: Statement[];
  emailLog: any[];
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'upload',    label: 'Upload Statement', icon: '↑' },
  { id: 'investors', label: 'Investors',         icon: '◎' },
  { id: 'history',   label: 'Account History',  icon: '⇄' },
  { id: 'seed',      label: 'NAV Manager',      icon: '⚡' },
  { id: 'ipo',       label: 'IPO Holdings',     icon: '◇' },
  { id: 'dashboard', label: 'OMA Dashboard',     icon: '▦' },
  { id: 'growth',    label: 'OMA Growth',        icon: '↗' },
  { id: 'tape',      label: 'Tape Decoder',      icon: '◈' },
  { id: 'emails',    label: 'Email Log',         icon: '✉' },
];

export default function AdminPortal({ investors, fundReturns, statements, emailLog }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [liveInvestors, setLiveInvestors] = useState<Investor[]>(investors);
  const [navSubTab, setNavSubTab] = useState<'seed' | 'edit'>('seed');

  return (
    <div className={styles.page}>
      <div className={styles.bg} />

      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.logoOrb} />
          <div>
            <div className={styles.brandName}>OMA FUNDS</div>
            <div className={styles.brandSub}>Admin Portal</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{tab.icon}</span>
              <span className={styles.navLabel}>{tab.label}</span>
            </button>
          ))}
        </nav>

        <button
          className={styles.logoutBtn}
          onClick={async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.href = '/admin/login';
          }}
        >
          Sign Out
        </button>
      </aside>

      <main className={styles.main}>
        <div className={styles.content}>
          {activeTab === 'upload' && (
            <StatementUploader statements={statements} investors={liveInvestors} />
          )}
          {activeTab === 'investors' && (
            <InvestorTable investors={liveInvestors} onUpdate={setLiveInvestors} />
          )}
          {activeTab === 'history' && (
            <AccountHistory investors={liveInvestors} />
          )}
          {activeTab === 'seed' && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
                  letterSpacing: '-0.6px', margin: '0 0 8px' }}>NAV Manager</h1>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px' }}>
                  Seed baseline NAV values or manually edit individual investor NAVs
                </p>

                {/* Sub tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                  {[
                    { id: 'seed', label: '⚡ Seed Baseline' },
                    { id: 'edit', label: '✎ Edit NAV' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setNavSubTab(t.id as 'seed' | 'edit')}
                      style={{
                        background: navSubTab === t.id ? 'rgba(90,167,255,0.12)' : 'transparent',
                        border: `1px solid ${navSubTab === t.id ? 'rgba(90,167,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 10,
                        padding: '9px 18px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: navSubTab === t.id ? 'var(--blue)' : 'var(--muted)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {navSubTab === 'seed' && <NavSeeder investors={liveInvestors} />}
              {navSubTab === 'edit' && (
                <NavEditor
                  investors={liveInvestors}
                  onUpdate={() => {
                    // Refresh investor list
                    fetch('/api/admin/investors', {
                      headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '' }
                    })
                      .then(r => r.json())
                      .then(d => { if (d.investors) setLiveInvestors(d.investors); });
                  }}
                />
              )}
            </div>
          )}
          {activeTab === 'ipo' && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
                  letterSpacing: '-0.6px', margin: '0 0 8px' }}>IPO Holdings</h1>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
                  Manage Pre-IPO and private equity positions for each investor
                </p>
              </div>
              <IpoHoldingsManager investors={liveInvestors} />
            </div>
          )}
          {activeTab === 'dashboard' && <AdminDashboard fundReturns={fundReturns} />}
          {activeTab === 'growth' && <AdminGrowth fundReturns={fundReturns} />}
          {activeTab === 'tape' && <AdminTapeDecoder fundReturns={fundReturns} />}
          {activeTab === 'emails' && <EmailLog emailLog={emailLog} />}
        </div>
      </main>
    </div>
  );
}
