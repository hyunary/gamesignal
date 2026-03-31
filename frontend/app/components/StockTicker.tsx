'use client';

import { useEffect, useState } from 'react';

interface Stock {
  name: string;
  ticker: string;
  currency: string;
  price: number | null;
  changePercent: number | null;
}

export default function StockTicker() {
  const [stocks, setStocks] = useState<Stock[]>([]);

  useEffect(() => {
    fetch('/api/stocks')
      .then(r => r.json())
      .then(setStocks)
      .catch(() => {});

    // 5분마다 갱신
    const interval = setInterval(() => {
      fetch('/api/stocks')
        .then(r => r.json())
        .then(setStocks)
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const items = [...stocks, ...stocks]; // 마퀴 루프용

  return (
    <div className="bg-black/60 border-b border-cyan-500/20 overflow-hidden py-2">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((stock, i) => (
          <span key={i} className="inline-flex items-center gap-2 mx-8 text-xs">
            <span className="text-cyan-400 font-bold tracking-widest">{stock.name}</span>
            <span className="text-gray-600 font-mono text-[10px]">{stock.ticker}</span>
            {stock.price !== null ? (
              <>
                <span className="text-gray-300 font-mono">
                  {stock.currency}{stock.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className={`font-mono text-[10px] font-bold ${
                  (stock.changePercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(stock.changePercent ?? 0) >= 0 ? '▲' : '▼'}
                  {Math.abs(stock.changePercent ?? 0).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-gray-700 font-mono text-[10px]">--</span>
            )}
            <span className="text-gray-800 mx-2">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
