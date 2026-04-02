import { getAllForecasts } from '../lib/queries';
import Link from 'next/link';

export const revalidate = 0;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: '분석 진행 중', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  concluded: { label: '분석 완료', color: 'text-gray-400 border-gray-500/30 bg-gray-500/10' },
};

export default async function ForecastingPage() {
  const forecasts = await getAllForecasts().catch(() => []);

  return (
    <main className="min-h-screen bg-[#070B14] text-gray-100 bg-grid">
      <div className="glow-cyan" />
      <div className="glow-purple" />

      <div className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(0,212,255,0.8)]"></div>
            <h1 className="text-xl font-black uppercase tracking-tighter font-mono">
              Sales <span className="text-cyan-400">Forecasting</span>
            </h1>
          </div>
          <p className="text-gray-500 text-xs font-mono uppercase tracking-widest ml-3">
            미출시 게임 판매량 예측 · 마일스톤 업데이트
          </p>
        </div>

        {forecasts.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-16 text-center">
            <div className="text-4xl mb-4 opacity-20 font-mono">◈</div>
            <p className="text-gray-600 text-sm uppercase tracking-widest font-mono">
              아직 분석된 게임이 없습니다
            </p>
            <p className="text-gray-700 text-xs mt-2 font-mono">
              게임 판매량 예측을 요청하면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {forecasts.map(forecast => {
              const statusCfg = STATUS_CONFIG[forecast.status] || STATUS_CONFIG.active;
              return (
                <Link key={forecast.id} href={`/forecasting/${forecast.game_slug}`}>
                  <div className="signal-card-hover bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm hover:border-cyan-500/20 hover:shadow-[0_0_30px_rgba(0,212,255,0.08)] cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      {/* 게임 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          {forecast.game_pass && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded border text-blue-400 border-blue-500/30 bg-blue-500/10">
                              Game Pass
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-black truncate font-mono">{forecast.game_title}</h2>
                        <div className="flex items-center gap-3 mt-1">
                          {forecast.developer && (
                            <span className="text-gray-500 text-xs font-mono">{forecast.developer}</span>
                          )}
                          {forecast.platform && (
                            <span className="text-gray-600 text-xs font-mono">· {forecast.platform}</span>
                          )}
                          {forecast.release_date && (
                            <span className="text-gray-600 text-xs font-mono">· {forecast.release_date}</span>
                          )}
                        </div>
                        {forecast.summary && (
                          <p className="text-gray-500 text-sm mt-2 line-clamp-2">{forecast.summary}</p>
                        )}
                      </div>

                      {/* 예측 범위 */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-1">Year 1 예측</p>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-green-500 font-mono">Bull</span>
                            <span className="text-sm font-black text-green-400 font-mono">
                              {forecast.bull_max ? `${forecast.bull_max}만+` : '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-cyan-500 font-mono">Base</span>
                            <span className="text-sm font-black text-cyan-400 font-mono">
                              {forecast.base_min && forecast.base_max
                                ? `${forecast.base_min}~${forecast.base_max}만`
                                : '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-red-500 font-mono">Bear</span>
                            <span className="text-sm font-black text-red-400 font-mono">
                              {forecast.bear_min ? `${forecast.bear_min}만~` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
