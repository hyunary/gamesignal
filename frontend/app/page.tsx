import { getTodaySignals, getRecentSignals, getPipelineStatus, getTopGames } from './lib/queries';
import SignalCard from './components/SignalCard';
import Link from 'next/link';

export const revalidate = 0;

const TICKER_STOCKS = [
  { name: 'KRAFTON', ticker: '259960.KS' },
  { name: 'PEARL ABYSS', ticker: '263750.KS' },
  { name: 'NEXON', ticker: '3659.T' },
  { name: 'NCSOFT', ticker: '036570.KS' },
  { name: 'NETMARBLE', ticker: '251270.KS' },
  { name: 'EA', ticker: 'EA' },
  { name: 'TAKE-TWO', ticker: 'TTWO' },
  { name: 'UBISOFT', ticker: 'UBI.PA' },
];

export default async function Home() {
  const [todaySignals, recentSignals, pipelineStatus, topGames] = await Promise.all([
    getTodaySignals().catch(() => []),
    getRecentSignals().catch(() => []),
    getPipelineStatus().catch(() => []),
    getTopGames().catch(() => []),
  ]);

  const allSignals = todaySignals.length > 0 ? todaySignals : recentSignals;
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = kstNow.toISOString().split('T')[0];
  const timeStr = kstNow.toISOString().split('T')[1].slice(0, 5) + ' KST';

  const successCount = pipelineStatus.filter((p: any) => p.status === 'success').length;
  const totalCount = pipelineStatus.length;

  return (
    <div className="min-h-screen bg-[#070B14] text-gray-100" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>

      {/* 상단 주가 티커 */}
      <div className="bg-black/60 border-b border-cyan-500/20 overflow-hidden py-2">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...TICKER_STOCKS, ...TICKER_STOCKS].map((stock, i) => (
            <span key={i} className="inline-flex items-center gap-2 mx-8 text-xs">
              <span className="text-cyan-400 font-bold">{stock.name}</span>
              <span className="text-gray-500">{stock.ticker}</span>
              <span className="text-gray-600">●</span>
            </span>
          ))}
        </div>
      </div>

      {/* 헤더 */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-9 h-9 bg-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.5)]">
                <span className="font-black text-black text-lg">G</span>
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase">
                Game<span className="text-cyan-400">Signal</span>
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Command Center</p>
            </div>
          </div>

          <nav className="flex items-center gap-6 text-xs uppercase tracking-widest">
            <Link href="/" className="text-cyan-400 border-b border-cyan-400 pb-0.5">Dashboard</Link>
            <Link href="/news" className="text-gray-500 hover:text-cyan-400 transition-colors">News</Link>
          </nav>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${successCount === totalCount ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 'bg-yellow-400'} animate-pulse`}></div>
              <span>PIPELINE {successCount}/{totalCount}</span>
            </div>
            <span className="text-gray-700">|</span>
            <span>{dateStr} {timeStr}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* 상태 바 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'SIGNALS TODAY', value: todaySignals.length, color: 'cyan', icon: '⚡' },
            { label: 'GAMES TRACKED', value: topGames.length, color: 'purple', icon: '🎮' },
            { label: 'PIPELINE', value: `${successCount}/${totalCount}`, color: successCount === totalCount ? 'green' : 'yellow', icon: '⚙' },
            { label: 'LAST UPDATE', value: timeStr, color: 'gray', icon: '🕐' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 backdrop-blur-sm hover:border-cyan-500/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-gray-500">{stat.label}</span>
                <span className="text-base">{stat.icon}</span>
              </div>
              <div className={`text-2xl font-black ${
                stat.color === 'cyan' ? 'text-cyan-400' :
                stat.color === 'green' ? 'text-green-400' :
                stat.color === 'purple' ? 'text-purple-400' :
                stat.color === 'yellow' ? 'text-yellow-400' : 'text-gray-300'
              }`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-3 gap-6">

          {/* 신호 피드 (2/3) */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(0,212,255,0.8)]"></div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">
                  Signal Feed
                </h2>
                {todaySignals.length > 0 && (
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                    TODAY
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-600">{allSignals.length} SIGNALS</span>
            </div>

            {allSignals.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-16 text-center">
                <div className="text-4xl mb-4 opacity-20">◈</div>
                <p className="text-gray-600 text-sm uppercase tracking-widest">No signals detected</p>
                <p className="text-gray-700 text-xs mt-2">Pipeline runs at KST 06:00</p>
              </div>
            ) : (
              allSignals.map((signal: any) => (
                <SignalCard key={signal.signal_id} signal={signal} />
              ))
            )}
          </div>

          {/* 사이드바 (1/3) */}
          <div className="space-y-6">

            {/* Steam Top 10 */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Steam Top 10</h3>
              </div>
              <div className="space-y-2">
                {topGames.slice(0, 10).map((game: any, i: number) => (
                  <div key={game.app_id} className="flex items-center gap-3 group py-1.5 border-b border-white/[0.03] last:border-0">
                    <span className={`text-[10px] font-black w-5 text-right flex-shrink-0 ${i < 3 ? 'text-cyan-400' : 'text-gray-600'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://store.steampowered.com/app/${game.app_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-300 truncate block group-hover:text-cyan-400 transition-colors"
                      >
                        {game.title}
                      </a>
                      <span className="text-[10px] text-gray-600 font-mono">
                        {(game.concurrent_users || 0).toLocaleString()} CCU
                      </span>
                    </div>
                    {i < 3 && (
                      <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_4px_rgba(0,212,255,0.8)] flex-shrink-0"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 파이프라인 상태 */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pipeline Status</h3>
              </div>
              <div className="space-y-3">
                {pipelineStatus.map((p: any) => (
                  <div key={p.source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        p.status === 'success' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' :
                        p.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                        p.status === 'failed' ? 'bg-red-400' : 'bg-gray-600'
                      }`}></div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400">{p.source}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold ${
                        p.status === 'success' ? 'text-green-400' :
                        p.status === 'failed' ? 'text-red-400' :
                        p.status === 'running' ? 'text-yellow-400' : 'text-gray-600'
                      }`}>{p.status?.toUpperCase()}</span>
                      {p.rows_collected && (
                        <span className="block text-[10px] text-gray-600">{p.rows_collected}개</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

    </div>
  );
}
