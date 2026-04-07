import type { ParsedStatement } from '@/types';

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];

/**
 * Parse raw text extracted from an OMA Funds PDF statement.
 * The statement format has a header section with:
 *   NAV $434,118.56   Starting Value $150,000.00   January February March ...
 *   Portfolio Return  10.18%  2.30%  26.17% ...
 *   YTD ROI  216.50%
 *
 * This parser is resilient to whitespace variations since pdf-parse
 * flattens the layout into a single text stream.
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

  // ── Year (from "December 2025 Activity" or similar) ─────────
  const yearMatch = normalized.match(/\b(202\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // ── Monthly Returns ─────────────────────────────────────────
  // The statement lists month names across the top, then
  // "Portfolio Return 10.18% 2.30% 26.17% ..."
  // We grab all % values after "Portfolio Return"
  const portfolioReturnIdx = normalized.toLowerCase().indexOf('portfolio return');
  if (portfolioReturnIdx === -1) {
    throw new Error('Could not find Portfolio Return row in statement');
  }

  const afterPortfolio = normalized.slice(portfolioReturnIdx);
  // Match all percentage values (including negatives like -1.37%)
  const pctMatches = afterPortfolio.matchAll(/([-]?\d+\.?\d*)%/g);
  const allPcts = Array.from(pctMatches).map(m => parseFloat(m[1]));

  // The first N values before hitting "Realized" are the monthly returns.
  // The statement always has 12 months max. We grab up to 12.
  // Filter out values that look like they're from the asset table (too large).
  const monthlyPcts = allPcts
    .slice(0, 12)
    .filter(v => v >= -50 && v <= 100); // monthly returns are bounded

  // Determine which months are present by looking at month header row
  // The text has "January February March..." before "Portfolio Return"
  const beforePortfolio = normalized.slice(0, portfolioReturnIdx).toLowerCase();
  const presentMonths: number[] = [];
  MONTH_NAMES.forEach((m, idx) => {
    if (beforePortfolio.includes(m)) {
      presentMonths.push(idx + 1); // 1-based
    }
  });

  // If we can't detect months from header, assume Jan–Dec in order
  const monthsToUse = presentMonths.length > 0
    ? presentMonths
    : Array.from({ length: monthlyPcts.length }, (_, i) => i + 1);

  const monthlyReturns = monthlyPcts.map((returnPct, i) => ({
    month: monthsToUse[i] ?? i + 1,
    returnPct,
  }));

  return { year, navTotal, startingValue, ytdRoi, monthlyReturns };
}

/**
 * Given the fund-level monthly returns and an investor's share percentage,
 * compute their NAV for each month by compounding from their starting capital.
 */
export function computeInvestorNAV(
  startingCapital: number,
  sharePct: number,
  monthlyReturns: { month: number; returnPct: number }[],
  fundNavTotal: number
): { month: number; nav: number; returnPct: number }[] {
  // Investor's NAV = their share of total fund NAV
  // For each month we compound their personal starting capital
  let running = startingCapital;
  const sorted = [...monthlyReturns].sort((a, b) => a.month - b.month);

  return sorted.map(({ month, returnPct }) => {
    running = running * (1 + returnPct / 100);
    return { month, nav: parseFloat(running.toFixed(2)), returnPct };
  });
}
