import { NextResponse } from 'next/server';

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
];

export async function GET() {
  try {
    const symbols = TICKERS.map(t => t.ticker).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 } // 5분 캐시
    });

    if (!res.ok) throw new Error('Yahoo Finance API 오류');

    const data = await res.json();
    const quotes = data.quoteResponse?.result || [];

    const stocks = TICKERS.map(t => {
      const quote = quotes.find((q: any) => q.symbol === t.ticker);
      return {
        name: t.name,
        ticker: t.ticker,
        currency: t.currency,
        price: quote?.regularMarketPrice ?? null,
        changePercent: quote?.regularMarketChangePercent ?? null,
      };
    });

    return NextResponse.json(stocks);
  } catch {
    // 실패 시 가격 없이 티커만 반환
    return NextResponse.json(
      TICKERS.map(t => ({ ...t, price: null, changePercent: null }))
    );
  }
}
