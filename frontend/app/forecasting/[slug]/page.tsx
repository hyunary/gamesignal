import { getForecastBySlug } from '../../lib/queries';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const revalidate = 0;

const MILESTONE_CONFIG: Record<string, { icon: string; color: string }> = {
  initial: { icon: '📋', color: 'border-cyan-500/40 bg-cyan-500/5' },
  wishlist_signal: { icon: '⭐', color: 'border-yellow-500/40 bg-yellow-500/5' },
  metacritic: { icon: '🎯', color: 'border-purple-500/40 bg-purple-500/5' },
  launch_week: { icon: '🚀', color: 'border-green-500/40 bg-green-500/5' },
  launch_month: { icon: '📊', color: 'border-blue-500/40 bg-blue-500/5' },
  update: { icon: '🔄', color: 'border-gray-500/40 bg-gray-500/5' },
};

export default async function ForecastDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getForecastBySlug(params.slug).catch(() => null);
  if (!data) notFound();

  const { forecast, threads } = data;

  return (
    <main className="min-h-screen bg-[#070B14] text-gray-100 bg-grid">
      <div className="glow-cyan" />
      <div className="glow-purple" />

      <div className="max-w-3xl mx-auto px-6 py-8 relative z-10">
        {/* 뒤로가기 */}
        <Link href="/forecasting" className="text-gray-600 hover:text-cyan-400 text-xs font-mono uppercase tracking-widest transition-colors mb-6 block">
          ← Forecasting
        </Link>

        {/* 게임 헤더 */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-6 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black font-mono mb-1">{forecast.game_title}</h1>
              <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                {forecast.developer && <span>{forecast.developer}</span>}
                {forecast.platform && <span>· {forecast.platform}</span>}
                {forecast.release_date && <span>· {forecast.release_date}</span>}
              </div>
              {forecast.summary && (
                <p className="text-gray-400 text-base mt-3">{forecast.summary}</p>
              )}
            </div>
            {forecast.app_id && (
              <a
                href={`https://store.steampowered.com/app/${forecast.app_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cyan-600 hover:text-cyan-400 font-mono transition-colors flex-shrink-0"
              >
                Steam ↗
              </a>
            )}
          </div>

          {/* 예측 범위 바 */}
          <div className="mt-5 pt-5 border-t border-white/[0.05]">
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-3">Year 1 판매량 예측 범위</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Bear', value: forecast.bear_min ? `${forecast.bear_min}만~` : '-', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                { label: 'Base', value: forecast.base_min && forecast.base_max ? `${forecast.base_min}~${forecast.base_max}만` : '-', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
                { label: 'Bull', value: forecast.bull_max ? `${forecast.bull_max}만+` : '-', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
              ].map(s => (
                <div key={s.label} className={`rounded-lg p-3 border ${s.bg} text-center`}>
                  <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">{s.label}</p>
                  <p className={`text-lg font-black font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thread 타임라인 */}
        <div className="mb-4 flex items-center gap-2">
          <div className="w-1 h-4 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">
            Analysis Thread
          </h2>
          <span className="text-[10px] text-gray-600 font-mono">{threads.length} updates</span>
        </div>

        {threads.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-8 text-center">
            <p className="text-gray-600 text-xs font-mono uppercase tracking-widest">
              아직 업데이트가 없습니다
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* 타임라인 라인 */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.05]"></div>

            <div className="space-y-4">
              {threads.map(thread => {
                const cfg = MILESTONE_CONFIG[thread.milestone_type] || MILESTONE_CONFIG.update;
                const hasUpdatedRange = thread.updated_base_min && thread.updated_base_max;

                return (
                  <div key={thread.id} className="relative pl-14">
                    {/* 아이콘 */}
                    <div className="absolute left-0 w-10 h-10 rounded-full bg-[#070B14] border border-white/[0.08] flex items-center justify-center text-lg z-10">
                      {cfg.icon}
                    </div>

                    <div className={`border rounded-xl p-5 backdrop-blur-sm ${cfg.color}`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-black font-mono text-gray-300 uppercase tracking-widest">
                            {thread.milestone_label}
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono ml-3">
                            {thread.thread_date}
                          </span>
                        </div>
                        {hasUpdatedRange && (
                          <div className="flex-shrink-0 text-right">
                            <p className="text-[10px] text-gray-600 font-mono mb-0.5">수정 예측</p>
                            <p className="text-sm font-black text-cyan-400 font-mono">
                              {thread.updated_base_min}~{thread.updated_base_max}만
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 마크다운 내용을 단락으로 렌더링 */}
                      <div className="text-gray-400 text-base leading-relaxed space-y-2">
                        {thread.content.split('\n').filter(Boolean).map((line, j) => (
                          <p key={j} className={
                            line.startsWith('##') ? 'text-gray-300 font-bold text-sm uppercase tracking-widest mt-3' :
                            line.startsWith('#') ? 'text-gray-200 font-black text-base mt-3' :
                            line.startsWith('- ') ? 'pl-3 border-l border-white/10 text-gray-500 text-sm' :
                            'text-gray-400 text-sm'
                          }>
                            {line.replace(/^#{1,3} /, '').replace(/^- /, '')}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
