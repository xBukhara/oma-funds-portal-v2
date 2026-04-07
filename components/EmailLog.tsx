'use client';
import styles from './AdminCharts.module.css';

interface Props { emailLog: any[]; }

export default function EmailLog({ emailLog }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Email Log</h1>
        <p className={styles.sub}>History of all statement notification emails sent to investors</p>
      </div>

      {emailLog.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', background: 'rgba(14,22,40,0.5)',
          border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>No emails sent yet</p>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Emails will appear here after you upload and process a statement.</p>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Sent At</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {emailLog.map((log: any) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{log.investors?.name ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{log.investors?.email ?? '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 999,
                        background: log.status === 'sent' ? 'rgba(54,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                        color: log.status === 'sent' ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${log.status === 'sent' ? 'rgba(54,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--red)', fontSize: 12 }}>{log.error_msg ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
