'use client';
import { useState, useRef, useCallback } from 'react';
import type { Statement, Investor } from '@/types';
import styles from './StatementUploader.module.css';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface UploadResult {
  success: boolean;
  parsed?: {
    year: number;
    navTotal: number;
    ytdRoi: number;
    monthsProcessed: number;
  };
  emailResults?: { investor: string; status: string }[];
  error?: string;
  warning?: string;
}

interface Props {
  statements: Statement[];
  investors: Investor[];
}

export default function StatementUploader({ statements, investors }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<string>('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const adminSecret = typeof window !== 'undefined'
    ? localStorage.getItem('oma-admin-secret') ?? ''
    : '';

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      setStep('📄 Reading PDF...');
      const formData = new FormData();
      formData.append('statement', file);

      setStep('🔍 Parsing statement data...');
      const res = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET ?? adminSecret },
        body: formData,
      });

      setStep('💾 Updating investor records...');
      const data: UploadResult = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setStep('✉️ Sending investor emails...');
      // Small delay so the user sees the email step
      await new Promise(r => setTimeout(r, 600));

      setResult(data);
      setFile(null);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setUploading(false);
      setStep('');
    }
  }

  const emailSuccess = result?.emailResults?.filter(r => r.status === 'sent').length ?? 0;
  const emailFailed  = result?.emailResults?.filter(r => r.status !== 'sent').length ?? 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Upload Statement</h1>
        <p className={styles.sub}>
          Upload a monthly PDF statement. The portal will automatically parse it,
          update all investor NAV records, and send personalized email notifications.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className={styles.hiddenInput}
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className={styles.filePreview}>
            <span className={styles.fileIcon}>📄</span>
            <div>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB — PDF ready to upload</p>
            </div>
            <button
              className={styles.clearBtn}
              onClick={e => { e.stopPropagation(); setFile(null); }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className={styles.dropContent}>
            <div className={styles.dropIcon}>↑</div>
            <p className={styles.dropTitle}>Drop your PDF statement here</p>
            <p className={styles.dropSub}>or click to browse — PDF files only</p>
          </div>
        )}
      </div>

      {/* Pipeline preview */}
      <div className={styles.pipeline}>
        {[
          { label: 'Parse PDF', desc: 'Extract NAV + monthly returns' },
          { label: 'Update Records', desc: 'Upsert all investor NAV data' },
          { label: 'Email Blast', desc: `Notify ${investors.length} investor${investors.length !== 1 ? 's' : ''}` },
        ].map((step, i) => (
          <div key={i} className={styles.pipelineStep}>
            <div className={styles.pipelineNum}>{i + 1}</div>
            <div>
              <p className={styles.pipelineLabel}>{step.label}</p>
              <p className={styles.pipelineDesc}>{step.desc}</p>
            </div>
            {i < 2 && <div className={styles.pipelineArrow}>→</div>}
          </div>
        ))}
      </div>

      {/* Upload button */}
      <button
        className={styles.uploadBtn}
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? (
          <span className={styles.uploadingInner}>
            <span className={styles.spinner} />
            {step}
          </span>
        ) : (
          'Process Statement & Notify Investors →'
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`${styles.result} ${result.success ? styles.resultSuccess : styles.resultError}`}>
          {result.success ? (
            <>
              <div className={styles.resultHeader}>
                <span className={styles.resultIcon}>✓</span>
                <div>
                  <p className={styles.resultTitle}>Statement Processed Successfully</p>
                  <p className={styles.resultSub}>
                    {result.parsed?.year} — {result.parsed?.monthsProcessed} month{result.parsed?.monthsProcessed !== 1 ? 's' : ''} processed •
                    Fund NAV: ${result.parsed?.navTotal.toLocaleString()} •
                    YTD ROI: {result.parsed?.ytdRoi}%
                  </p>
                </div>
              </div>

              {result.warning && (
                <p className={styles.resultWarning}>⚠ {result.warning}</p>
              )}

              {result.emailResults && result.emailResults.length > 0 && (
                <div className={styles.emailResults}>
                  <p className={styles.emailResultsTitle}>
                    Email Notifications — {emailSuccess} sent{emailFailed > 0 ? `, ${emailFailed} failed` : ''}
                  </p>
                  <div className={styles.emailList}>
                    {result.emailResults.map((r, i) => (
                      <div key={i} className={styles.emailRow}>
                        <span className={r.status === 'sent' ? styles.emailSent : styles.emailFailed}>
                          {r.status === 'sent' ? '✓' : '✗'}
                        </span>
                        <span className={styles.emailAddr}>{r.investor}</span>
                        <span className={r.status === 'sent' ? styles.emailSent : styles.emailFailed}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.resultHeader}>
              <span className={styles.resultIconError}>✗</span>
              <div>
                <p className={styles.resultTitle}>Upload Failed</p>
                <p className={styles.resultSub}>{result.error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous statements */}
      {statements.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Statement History</h2>
          <div className={styles.historyTable}>
            <div className={styles.historyHeader}>
              <span>Period</span>
              <span>Uploaded</span>
              <span>Emails</span>
            </div>
            {statements.map(s => (
              <div key={s.id} className={styles.historyRow}>
                <span>{MONTHS[s.month]} {s.year}</span>
                <span className={styles.historyMuted}>
                  {new Date(s.uploaded_at).toLocaleDateString()}
                </span>
                <span>
                  {s.email_sent_at
                    ? <span className={styles.sent}>✓ Sent {new Date(s.email_sent_at).toLocaleDateString()}</span>
                    : <span className={styles.pending}>— Not sent</span>
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
