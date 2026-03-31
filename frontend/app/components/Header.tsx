import Link from 'next/link';
import StockTicker from './StockTicker';

async function getPipelineStatus() {
  const { getPipelineStatus } = await import('../lib/queries');
  return getPipelineStatus().catch(() => []);
}

export default async function Header() {
  const pipelineStatus = await getPipelineStatus();
  const successCount = pipelineStatus.filter((p: any) => p.status === 'success').length;
  const totalCount = pipelineStatus.length;

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = kstNow.toISOString().split('T')[0];
  const timeStr = kstNow.toISOString().split('T')[1].slice(0, 5) + ' KST';

  return (
    <>
      {/* 상단 주가 티커 */}
      <StockTicker />

      {/* GNB */}
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
            <Link href="/" className="text-gray-500 hover:text-cyan-400 transition-colors">
              Dashboard
            </Link>
            <Link href="/news" className="text-gray-500 hover:text-cyan-400 transition-colors">
              News
            </Link>
          </nav>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                successCount === totalCount
                  ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]'
                  : 'bg-yellow-400'
              } animate-pulse`}></div>
              <span>PIPELINE {successCount}/{totalCount}</span>
            </div>
            <span className="text-gray-700">|</span>
            <span>{dateStr} {timeStr}</span>
          </div>
        </div>
      </header>
    </>
  );
}
