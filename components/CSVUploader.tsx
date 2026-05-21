'use client';
import { useState, useRef, useCallback } from 'react';
import styles from './CSVUploader.module.css';

interface ParsedInvestor {
  name: string;
  email: string;
  slug: string;
  starting_capital: number;
  share_pct: number;
  temp_password: string;
  valid: boolean;
  error?: string;
}

interface UploadResult {
  name: string;
  email: string;
  status: string;
  error?: string;
}

interface Props {
  onComplete: () => void;
}

const TEMPLATE_CSV = `name,email,slug,current_nav,share_pct,temp_password
John Smith,john@email.com,john-smith,50000,15.5,OMAFunds2025!
Jane Doe,jane@email.com,jane-doe,30000,10.2,OMAFunds2025!`;

export default function CSVUploader({ onComplete }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedInvestor[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';

  function parseCSV(text: string): ParsedInvestor[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });

      // Accept multiple column name variants for starting capital
      const capitalValue =
        row['starting_capital'] ||
        row['current_nav'] ||
        row['invested'] ||
        row['net_capital'] ||
        '0';

      // Accept multiple column name variants for share %
      const sharePctRaw = (row['share_pct'] || row['share_%'] || '0').replace('%', '');

      const missing = ['name', 'slug', 'temp_password'].filter(r => !row[r]);
      const hasCapital = parseFloat(capitalValue) > 0;
      if (!hasCapital) missing.push('starting capital (current_nav or invested)');
      const valid = missing.length === 0;

      return {
        name: row['name'] ?? '',
        email: row['email'] ?? '',
        slug: row['slug'] ?? '',
        starting_capital: parseFloat(capitalValue) || 0,
        share_pct: parseFloat(sharePctRaw) || 0,
        temp_password: row['temp_password'] ?? '',
        valid,
        error: valid ? undefined : `Missing: ${missing.join(', ')}`,
      };
    });
  }

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setParsed(rows);
      setResults([]);
      setDone(false);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  }, [handleFile]);

  async function handleUpload() {
    const valid = parsed.filter(p => p.valid);
    if (valid.length === 0) return;

    setUploading(true);
    const res = await fetch('/api/admin/bulk-investors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({ investors: valid }),
    });

    const data = await res.json();
    setResults(data.results ?? []);
    setDone(true);
    setUploading(false);
    if (data.created > 0) onComplete();
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oma-investors-template.csv';
    a.click();
  }

  const validCount = parsed.filter(p => p.valid).length;
  const invalidCount = parsed.filter(p => !p.valid).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>Bulk Import via CSV</h2>
          <p className={styles.sub}>Upload multiple investors at once using a CSV file</p>
        </div>
        <button className={styles.templateBtn} onClick={downloadTemplate}>
          ↓ Download Template
        </button>
      </div>

      {parsed.length === 0 && (
        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className={styles.hiddenInput}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className={styles.dropIcon}>📋</div>
          <p className={styles.dropTitle}>Drop your CSV file here</p>
          <p className={styles.dropSub}>or click to browse — .csv files only</p>
        </div>
      )}

      {parsed.length > 0 && !done && (
        <>
          <div className={styles.previewHeader}>
            <div className={styles.previewStats}>
              <span className={styles.statGreen}>✓ {validCount} valid</span>
              {invalidCount > 0 && <span className={styles.statRed}>✗ {invalidCount} invalid</span>}
            </div>
            <button className={styles.clearBtn} onClick={() => setParsed([])}>
              Clear
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Slug</th>
                  <th>Starting Capital</th>
                  <th>Share %</th>
                  <th>Temp Password</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((row, i) => (
                  <tr key={i} className={!row.valid ? styles.invalidRow : ''}>
                    <td>
                      {row.valid
                        ? <span className={styles.valid}>✓</span>
                        : <span className={styles.invalid} title={row.error}>✗</span>
                      }
                    </td>
                    <td>{row.name}</td>
                    <td style={{ color: row.email ? 'var(--muted)' : 'var(--red)' }}>
                      {row.email || 'No email — will skip'}
                    </td>
                    <td className={styles.mono}>/i/{row.slug}</td>
                    <td>${row.starting_capital.toLocaleString()}</td>
                    <td>{row.share_pct}%</td>
                    <td className={styles.mono}>{row.temp_password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className={styles.uploadBtn}
            onClick={handleUpload}
            disabled={uploading || validCount === 0}
          >
            {uploading
              ? `Creating ${validCount} investor accounts...`
              : `Import ${validCount} Investor${validCount !== 1 ? 's' : ''} →`
            }
          </button>
        </>
      )}

      {done && results.length > 0 && (
        <div className={styles.results}>
          <h3 className={styles.resultsTitle}>
            Import Complete — {results.filter(r => r.status === 'created').length} created,{' '}
            {results.filter(r => r.status === 'skipped').length} skipped,{' '}
            {results.filter(r => r.status === 'failed').length} failed
          </h3>
          <div className={styles.resultList}>
            {results.map((r, i) => (
              <div key={i} className={styles.resultRow}>
                <span className={
                  r.status === 'created' ? styles.valid :
                  r.status === 'skipped' ? styles.skipped : styles.invalid
                }>
                  {r.status === 'created' ? '✓' : r.status === 'skipped' ? '○' : '✗'}
                </span>
                <span className={styles.resultName}>{r.name}</span>
                <span className={styles.resultEmail}>{r.email || 'no email'}</span>
                <span className={
                  r.status === 'created' ? styles.statGreen :
                  r.status === 'skipped' ? styles.statGold : styles.statRed
                }>
                  {r.status === 'created' ? 'Created' : r.status === 'skipped' ? r.error : r.error}
                </span>
              </div>
            ))}
          </div>
          <button className={styles.clearBtn} onClick={() => { setParsed([]); setResults([]); setDone(false); }}>
            Import More
          </button>
        </div>
      )}
    </div>
  );
}
