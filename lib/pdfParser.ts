import type { ParsedStatement } from '@/types';

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];

/**
 * Parse raw text extracted from an OMA Funds PDF statement.
 * Correctly identifies the statement period from "Month YYYY Activity" header.
 */
export function parseOmaStatement(text: string): ParsedStatement {
  const normalized = text.replace(/\s+/g, ' ').trim();

  // ── NAV ─────────────────────────────────────────────────────
  const navMatch = normalized.match(/NAV\s*\$?([\d,]+\.?\d*)/i);
  if (!navMatch) throw new Error('Could not find NAV in statement');
  const navTotal = parseFloat(navMatch[1].replace(/,/g, ''));

  // ── Starting Value ──────────────────────────────────────────
  const startMatch = normalized.match(/Starting Value\s*\$?([\d,]+\.?\d*)/i);
  const startingValue = startMatch
    ? parseFloat(startMatch[1].replace(/,/g, ''))
    : 0;

  // ── YTD ROI ─────────────────────────────────────────────────
  const ytdMatch = normalized.match(/YTD ROI\s*([\d.]+)%/i);
  const ytdRoi = ytdMatch ? parseFloat(ytdMatch[1]) : 0;

  // ── Year + Statement Month ───────────────────────────────────
  // Look for "Month YYYY Activity" or "Month YYYY Summary" pattern
  // This is the most reliable indicator of the statement period
  let year = new Date().getFullYear();
  let statementMonth = 12; // default to December

  // Try to find "Month YYYY Activity" pattern first
  const activityMatch = normalized.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\s+(?:activity|summary)/i
  );

  if (activityMatch) {
    statementMonth = MONTH_NAMES.indexOf(activityMatch[1].toLowerCase()) + 1;
    year = parseInt(activityMatch[2]);
  } else {
    // Fallback: find year near month names in header
    const yearMatch = normalized.match(/\b(20\d{2})\s+Summary/i);
    if (yearMatch) year = parseInt(yearMatch[1]);

    // Find the last month mentioned before "Activity"
    const months = normalized.toLowerCase();
    for (let i = MONTH_NAMES.length - 1; i >= 0; i--) {
      if (months.includes(MONTH_NAMES[i])) {
        statementMonth = i + 1;
        break;
      }
    }
  }

  // ── Monthly Returns ──────────────────────────────────────────
  // Find "Portfolio Return" row and extract all percentages after it
  const portfolioReturnIdx = normalized.toLowerCase().indexOf('portfolio return');
  if (portfolioReturnIdx === -1) {
    throw new Error('Could not find Portfolio Return row in statement');
  }

  const afterPortfolio = normalized.slice(portfolioReturnIdx);
  const pctMatches = afterPortfolio.matchAll(/([-]?\d+\.?\d*)%/g);
  const allPcts = Array.from(pctMatches).map(m => parseFloat(m[1]));

  // Monthly returns are bounded between -50% and +100%
  // Take only the first values that fit this range (before asset table data)
  const monthlyPcts: number[] = [];
  for (const pct of allPcts) {
    if (monthlyPcts.length >= statementMonth) break;
    if (pct >= -50 && pct <= 100) {
      monthlyPcts.push(pct);
    }
  }

  // Determine which months are present
  // The statement lists months in header: Jan Feb Mar ... up to statement month
  const monthlyReturns = monthlyPcts.map((returnPct, i) => ({
    month: i + 1, // Always starts from January (month 1)
    returnPct,
  }));

  return { year, navTotal, startingValue, ytdRoi, monthlyReturns };
}

/**
 * Compute investor NAV by compounding from their starting capital
 * using the fund's monthly return percentages.
 */
export function computeInvestorNAV(
  startingCapital: number,
  monthlyReturns: { month: number; returnPct: number }[]
): { month: number; nav: number; returnPct: number }[] {
  let running = startingCapital;
  const sorted = [...monthlyReturns].sort((a, b) => a.month - b.month);

  return sorted.map(({ month, returnPct }) => {
    running = running * (1 + returnPct / 100);
    return { month, nav: parseFloat(running.toFixed(2)), returnPct };
  });
}
