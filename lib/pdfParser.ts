import type { ParsedStatement } from '@/types';

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];

/**
 * Parse OMA Funds PDF statement.
 * Extracts the latest month's return ONLY — previous months are already in the DB.
 * Returns all monthly returns for reference but flags the latest one.
 */
export function parseOmaStatement(text: string): ParsedStatement {
  const normalized = text.replace(/\s+/g, ' ').trim();

  // ── NAV ──────────────────────────────────────────────────
  const navMatch = normalized.match(/NAV\s*\$?([\d,]+\.?\d*)/i);
  if (!navMatch) throw new Error('Could not find NAV in statement');
  const navTotal = parseFloat(navMatch[1].replace(/,/g, ''));

  // ── Starting Value ───────────────────────────────────────
  const startMatch = normalized.match(/Starting Value\s*\$?([\d,]+\.?\d*)/i);
  const startingValue = startMatch ? parseFloat(startMatch[1].replace(/,/g, '')) : 0;

  // ── YTD ROI ──────────────────────────────────────────────
  const ytdMatch = normalized.match(/YTD ROI\s*([\d.]+)%/i);
  const ytdRoi = ytdMatch ? parseFloat(ytdMatch[1]) : 0;

  // ── Year ─────────────────────────────────────────────────
  // Your statements use "26-May" format
  let year = new Date().getFullYear();
  const shortYearMatch = normalized.match(
    /\b(\d{2})-(january|february|march|april|may|june|july|august|september|october|november|december)\b/i
  );
  if (shortYearMatch) {
    year = 2000 + parseInt(shortYearMatch[1]);
  } else {
    const yearMatch = normalized.match(/\b(20\d{2})\s+Summary/i) ?? normalized.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1]);
  }

  // ── Which months are present in header ───────────────────
  const portfolioReturnIdx = normalized.toLowerCase().indexOf('portfolio return');
  if (portfolioReturnIdx === -1) throw new Error('Could not find Portfolio Return row');

  const beforePortfolio = normalized.slice(0, portfolioReturnIdx).toLowerCase();
  const startingValueIdx = beforePortfolio.lastIndexOf('starting value');
  const monthHeaderSection = startingValueIdx !== -1
    ? beforePortfolio.slice(startingValueIdx)
    : beforePortfolio.slice(-300);

  const presentMonths: number[] = [];
  MONTH_NAMES.forEach((m, idx) => {
    if (monthHeaderSection.includes(m)) presentMonths.push(idx + 1);
  });

  // ── Extract returns from Portfolio Return row ONLY ────────
  // Stop before asset table data
  const afterPortfolio = normalized.slice(portfolioReturnIdx);
  const stopKeywords = ['unrealized', 'asset name', 'realized gross', 'available cash', 'ytd roi', 'stock buy', 'stock sell'];
  let stopIdx = afterPortfolio.length;
  for (const kw of stopKeywords) {
    const idx = afterPortfolio.toLowerCase().indexOf(kw);
    if (idx > 10 && idx < stopIdx) stopIdx = idx;
  }

  const portfolioSection = afterPortfolio.slice(0, stopIdx);
  const pctMatches = portfolioSection.matchAll(/([-]?\d+\.?\d*)%/g);
  const rawPcts = Array.from(pctMatches).map(m => parseFloat(m[1]));
  const monthlyPcts = rawPcts.filter(v => v >= -50 && v <= 100);

  const monthsToUse = presentMonths.length > 0
    ? presentMonths.slice(0, monthlyPcts.length)
    : Array.from({ length: monthlyPcts.length }, (_, i) => i + 1);

  const monthlyReturns = monthlyPcts.map((returnPct, i) => ({
    month: monthsToUse[i] ?? i + 1,
    returnPct,
  }));

  return { year, navTotal, startingValue, ytdRoi, monthlyReturns };
}

/**
 * Compute investor NAV for a SINGLE month's return.
 * This is used when processing monthly statements.
 */
export function applyMonthReturn(
  currentNav: number,
  returnPct: number,
  month: number
): { month: number; nav: number; returnPct: number } {
  const newNav = parseFloat((currentNav * (1 + returnPct / 100)).toFixed(2));
  return { month, nav: newNav, returnPct };
}

/**
 * Compute investor NAV by compounding through multiple months.
 * Used for backfill scenarios only.
 */
export function computeInvestorNAV(
  currentNav: number,
  monthlyReturns: { month: number; returnPct: number }[]
): { month: number; nav: number; returnPct: number }[] {
  let running = currentNav;
  return [...monthlyReturns].sort((a, b) => a.month - b.month).map(({ month, returnPct }) => {
    running = parseFloat((running * (1 + returnPct / 100)).toFixed(2));
    return { month, nav: running, returnPct };
  });
}
