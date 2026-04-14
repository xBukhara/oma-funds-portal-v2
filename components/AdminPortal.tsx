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
import styles from './AdminPortal.module.css';

type Tab = 'upload' | 'investors' | 'history' | 'dashboard' | 'growth' | 'tape' | 'emails';

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
  { id: 'dashboard', label: 'OMA Dashboard',     icon: '▦' },
  { id: 'growth',    label: 'OMA Growth',        icon: '↗' },
  { id: 'tape',      label: 'Tape Decoder',      icon: '◈' },
  { id: 'emails',    label: 'Email Log',         icon: '✉' },
];

export default function AdminPortal({ investors, fundReturns, statements, emailLog }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [liveInvestors, setLiveInvestors] = useState<Investor[]>(investors);

  return (
    <div className={styles.page}>
      <div className={styles.bg} />

      {/* Sidebar */}
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

      {/* Main content */}
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
          {activeTab === 'dashboard' && (
            <AdminDashboard fundReturns={fundReturns} />
          )}
          {activeTab === 'growth' && (
            <AdminGrowth fundReturns={fundReturns} />
          )}
          {activeTab === 'tape' && (
            <AdminTapeDecoder fundReturns={fundReturns} />
          )}
          {activeTab === 'emails' && (
            <EmailLog emailLog={emailLog} />
          )}
        </div>
      </main>
    </div>
  );
}
