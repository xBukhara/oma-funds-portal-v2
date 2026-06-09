import type { ParsedStatement } from '@/types';

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];

/**
 * Parse raw text extracted from an OMA Funds PDF statement.
 *
 * The statement layout is:
 *   NAV $388,371.12   Starting Value $157,460.00
 *   [Month headers]: January  February  March  April  May
 *   Portfolio Return  -0.87%  -1.81%  14.54%  11.23%  9.57%
 *
 * Critical: we must ONLY read the monthly returns from the "Portfolio Return" row
 * and stop before hitting asset-level data. The number of returns must match
 * exactly the number of month headers shown.
 */
export function parseOmaStatement(text: string): ParsedStatement {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // ── NAV ────────────────────────────────────────────────────
  const navMatch = normalized.match(/NAV\s*\$?([\d,]+\.?\d*)/i);
  if (!navMatch) throw new Error('Could not find NAV in statement');
  const navTotal = parseFloat(navMatch[1].replace(/,/g, ''));

  // ── Starting Value ─────────────────────────────────────────
  const startMatch = normalized.match(/Starting Value\s*\$?([\d,]+\.?\d*)/i);
  const startingValue = startMatch
    ? parseFloat(startMatch[1].replace(/,/g, ''))
    : 0;

  // ── YTD ROI ────────────────────────────────────────────────
  const ytdMatch = normalized.match(/YTD ROI\s*([\d.]+)%/i);
  const ytdRoi = ytdMatch ? parseFloat(ytdMatch[1]) : 0;

  // ── Year ────────────────────────────────────────────────────
  // Look specifically for "26-Month" or "Month YYYY" activity pattern
  let year = new Date().getFullYear();

  // Try "26-May" or "26-Apr" format first (your statement uses this)
  const shortYearMatch = normalized.match(/\b(\d{2})-(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (shortYearMatch) {
    year = 2000 + parseInt(shortYearMatch[1]);
  } else {
    // Try "2026 Summary" or "Month YYYY Activity"
    const yearMatch = normalized.match(/\b(20\d{2})\s+Summary/i)
      ?? normalized.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1]);
  }

  // ── Month headers present in statement ─────────────────────
  // Find the section between "Starting Value..." and "Portfolio Return"
  // The month names listed there tell us exactly which months have data
  const portfolioReturnIdx = normalized.toLowerCase().indexOf('portfolio return');
  if (portfolioReturnIdx === -1) {
    throw new Error('Could not find Portfolio Return row in statement');
  }

  // Look at text before "Portfolio Return" for month names
  const beforePortfolio = normalized.slice(0, portfolioReturnIdx).toLowerCase();

  // Find the LAST occurrence of "starting value" before portfolio return
  // Everything after that is the month header row
  const startingValueIdx = beforePortfolio.lastIndexOf('starting value');
  const monthHeaderSection = startingValueIdx !== -1
    ? beforePortfolio.slice(startingValueIdx)
    : beforePortfolio.slice(-200); // last 200 chars

  // Find which months appear in the header row, in order
  const presentMonths: number[] = [];
  MONTH_NAMES.forEach((m, idx) => {
    if (monthHeaderSection.includes(m)) {
      presentMonths.push(idx + 1); // 1-based month number
    }
  });

  // ── Monthly Returns ─────────────────────────────────────────
  // Extract ONLY the text immediately after "Portfolio Return"
  // and stop before the first asset name or "Unrealized" keyword
  const afterPortfolio = normalized.slice(portfolioReturnIdx);

  // Find where asset data starts (stops our extraction)
  const stopKeywords = ['unrealized', 'asset name', 'realized gross', 'available cash', 'ytd roi'];
  let stopIdx = afterPortfolio.length;
  for (const keyword of stopKeywords) {
    const idx = afterPortfolio.toLowerCase().indexOf(keyword);
    if (idx > 0 && idx < stopIdx) stopIdx = idx;
  }

  const portfolioReturnSection = afterPortfolio.slice(0, stopIdx);

  // Extract percentages from ONLY this section
  const pctMatches = portfolioReturnSection.matchAll(/([-]?\d+\.?\d*)%/g);
  const rawPcts = Array.from(pctMatches).map(m => parseFloat(m[1]));

  // Filter to only plausible monthly returns (-50% to +100%)
  const monthlyPcts = rawPcts.filter(v => v >= -50 && v <= 100);

  // Match returns to months — use presentMonths if detected, otherwise assume Jan onwards
  const monthsToUse = presentMonths.length > 0
    ? presentMonths.slice(0, monthlyPcts.length)
    : Array.from({ length: monthlyPcts.length }, (_, i) => i + 1);

  const monthlyReturns = monthlyPcts.map((returnPct, i) => ({
    month: monthsToUse[i] ?? i + 1,
    returnPct,
  }));

  // Safety check: if we got more returns than months, trim to match
  const finalReturns = monthlyReturns.slice(0, presentMonths.length || monthlyReturns.length);

  return { year, navTotal, startingValue, ytdRoi, monthlyReturns: finalReturns };
}

/**
 * Compute investor NAV by compounding from their current NAV
 * using the fund's monthly return percentages.
 */
export function computeInvestorNAV(
  currentNav: number,
  monthlyReturns: { month: number; returnPct: number }[]
): { month: number; nav: number; returnPct: number }[] {
  let running = currentNav;
  const sorted = [...monthlyReturns].sort((a, b) => a.month - b.month);

  return sorted.map(({ month, returnPct }) => {
    running = running * (1 + returnPct / 100);
    return { month, nav: parseFloat(running.toFixed(2)), returnPct };
  });
}
