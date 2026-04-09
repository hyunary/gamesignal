export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import YahooFinanceClass from 'yahoo-finance2';

const yahooFinance = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

const TICKERS = [
  { name: 'KRAFTON', ticker: '259960.KS', currency: '₩' },
  { name: 'PEARL ABYSS', ticker: '263750.KS', currency: '₩' },
  { name: 'NEXON', ticker: '3659.T', currency: '¥' },
  { name: 'NCSOFT', ticker: '036570.KS', currency: '₩' },
  { name: 'NETMARBLE', ticker: '251270.KS', currency: '₩' },
  { name: 'EA', ticker: 'EA', currency: '$' },
  { name: 'TAKE-TWO', ticker: 'TTWO', currency: '$' },
  { name: 'UBISOFT', ticker: 'UBI.PA', currency: '€' },
  { name: 'CAPCOM', ticker: '9697.T', currency: '¥' },
  { name: 'BANDAI NAMCO', ticker: '7832.T', currency: '¥' },
  { name: 'NEOWIZ', ticker: '095660.KS', currency: '₩' },
  { name: 'KAKAO GAMES', ticker: '293490.KS', currency: '₩' },
  { name: 'DEVSISTERS', ticker: '194480.KS', currency: '₩' },
  { name: 'SHIFT UP', ticker: '462870.KS', currency: '₩' },
  { name: 'JOYCITY', ticker: '067000.KS', currency: '₩' },
];

export async function GET() {
  try {
    const results = await Promise.allSettled(
      TICKERS.map(t =>
        yahooFinance.quote(t.ticker, {}, { validateResult: false })
      )
    );

    const stocks = TICKERS.map((t, i) => {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        const q = result.value as any;
        return {
          name: t.name,
          ticker: t.ticker,
          currency: t.currency,
          price: q.regularMarketPrice ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
        };
      }
      return { name: t.name, ticker: t.ticker, currency: t.currency, price: null, changePercent: null };
    });

    return NextResponse.json(stocks, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch {
    return NextResponse.json(
      TICKERS.map(t => ({ name: t.name, ticker: t.ticker, currency: t.currency, price: null, changePercent: null }))
    );
  }
}
