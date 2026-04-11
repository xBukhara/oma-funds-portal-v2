import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols') ?? '';
  if (!symbols) return NextResponse.json({ quotes: [] });

  const symbolList = symbols.split(',').filter(Boolean);

  try {
    const quotes: Quote[] = await Promise.all(
      symbolList.map(async (symbol) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0',
              },
            }
          );

          const data = await res.json();
          const result = data?.chart?.result?.[0];
          const meta = result?.meta;

          const price = meta?.regularMarketPrice ?? 0;
          const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
          const change = price - prevClose;
          const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

          return {
            symbol,
            price: parseFloat(price.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePct: parseFloat(changePct.toFixed(2)),
          };
        } catch {
          return { symbol, price: 0, change: 0, changePct: 0 };
        }
      })
    );

    // Filter out failed fetches
    const valid = quotes.filter(q => q.price > 0);

    return NextResponse.json({ quotes: valid }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
      }
    });
  } catch {
    return NextResponse.json({ quotes: [] }, { status: 500 });
  }
}
