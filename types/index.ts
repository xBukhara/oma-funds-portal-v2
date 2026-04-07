export interface Investor {
  id: string;
  user_id: string;
  name: string;
  email: string;
  slug: string;
  starting_capital: number;
  share_pct: number;
  created_at: string;
}

export interface NavRecord {
  id: string;
  investor_id: string;
  year: number;
  month: number;
  nav: number;
  monthly_return_pct: number;
  created_at: string;
}

export interface FundReturn {
  id: string;
  year: number;
  month: number;
  monthly_return_pct: number;
  nav_total: number;
  ytd_roi: number | null;
  created_at: string;
}

export interface Statement {
  id: string;
  year: number;
  month: number;
  file_path: string;
  file_url: string | null;
  uploaded_at: string;
  email_sent_at: string | null;
}

export interface EmailLog {
  id: string;
  statement_id: string;
  investor_id: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error_msg: string | null;
}

export interface ParsedStatement {
  year: number;
  navTotal: number;
  startingValue: number;
  ytdRoi: number;
  monthlyReturns: { month: number; returnPct: number }[];
}
