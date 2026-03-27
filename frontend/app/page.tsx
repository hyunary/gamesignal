import { getTodaySignals, getRecentSignals, getPipelineStatus, getTopGames } from './lib/queries';
import SignalCard from './components/SignalCard';
import PipelineStatus from './components/PipelineStatus';

export const revalidate = 300; // 5분마다 갱신

export default async function Dashboard() {
  const [todaySignals, recentSignals, pipelineRuns, topGames] = await Promise.all([
    getTodaySignals().catch(() => []),
    getRecentSignals().catch(() => []),
    getPipelineStatus().catch(() => []),
    getTopGames().catch(() => []),
  ]);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-mono">
              <span className="text-green-400">▶</span> GameSignal
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">Steam 게임 트래픽 신호 감지</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">{today}</p>
            <p className="text-gray-600 text-xs">
              오늘 신호 {todaySignals.length}개
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 왼쪽: 신호 피드 */}
          <div className="lg:col-span-2 space-y-4">

            {/* 오늘의 신호 */}
            <section>
              <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-red-400">●</span> 오늘의 신호
                <span className="text-gray-600">({todaySignals.length})</span>
              </h2>
              {todaySignals.length > 0 ? (
                <div className="space-y-3">
                  {todaySignals.map(signal => (
                    <SignalCard key={signal.signal_id} signal={signal} />
                  ))}
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-600">
                  <p className="text-2xl mb-2">📡</p>
                  <p>오늘 감지된 신호가 없습니다</p>
                  <p className="text-xs mt-1">파이프라인은 매일 KST 06:00에 실행됩니다</p>
                </div>
              )}
            </section>

            {/* 최근 7일 신호 */}
            {recentSignals.filter(s =>
              new Date(s.signal_date).toDateString() !== new Date().toDateString()
            ).length > 0 && (
              <section>
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="text-yellow-400">●</span> 최근 7일
                </h2>
                <div className="space-y-3">
                  {recentSignals
                    .filter(s => new Date(s.signal_date).toDateString() !== new Date().toDateString())
                    .slice(0, 10)
                    .map(signal => (
                      <SignalCard key={signal.signal_id} signal={signal} />
                    ))}
                </div>
              </section>
            )}
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">

            {/* 파이프라인 상태 */}
            <PipelineStatus runs={pipelineRuns} />

            {/* Steam Top 10 */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-3">
                Steam Top 10 (오늘)
              </h3>
              <div className="space-y-2">
                {topGames.slice(0, 10).map((game: any) => (
                  <div key={game.app_id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600 font-mono w-5 text-right text-xs">
                      {game.most_played_rank}
                    </span>
                    <span className="text-gray-300 truncate flex-1">{game.title}</span>
                    <span className="text-gray-500 text-xs flex-shrink-0">
                      {Number(game.concurrent_users).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 통계 */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-3">
                누적 통계
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">추적 게임</span>
                  <span className="text-white font-mono">{topGames.length > 0 ? '112+' : '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">7일 신호</span>
                  <span className="text-white font-mono">{recentSignals.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">오늘 신호</span>
                  <span className="text-green-400 font-mono">{todaySignals.length}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
