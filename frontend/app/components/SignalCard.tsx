'use client';

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  new_entry_mp: {
    label: 'MP ENTRY',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    glow: 'shadow-[0_0_20px_rgba(0,212,255,0.1)]',
  },
  new_entry_wl: {
    label: 'WL ENTRY',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.1)]',
  },
  traffic_revival: {
    label: 'REVIVAL',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    glow: 'shadow-[0_0_20px_rgba(251,146,60,0.1)]',
  },
  wishlist_surge: {
    label: 'WL SURGE',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    glow: 'shadow-[0_0_20px_rgba(250,204,21,0.1)]',
  },
  review_spike: {
    label: 'REVIEW ↑',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    glow: 'shadow-[0_0_20px_rgba(74,222,128,0.1)]',
  },
  composite: {
    label: 'COMPOSITE',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    glow: 'shadow-[0_0_20px_rgba(248,113,113,0.1)]',
  },
};

export default function SignalCard({ signal }: { signal: any }) {
  const cfg = SIGNAL_CONFIG[signal.signal_type] || SIGNAL_CONFIG['new_entry_mp'];
  const payload = signal.payload || {};

  return (
    <div className={`signal-card-hover relative bg-white/[0.03] border ${cfg.border} rounded-xl p-5 backdrop-blur-sm ${cfg.glow} hover:bg-white/[0.05] hover:shadow-[0_0_30px_rgba(0,212,255,0.08)] transition-all group`}>

      {/* 우측 상단 우선순위 배지 */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {signal.is_first_ever_entry_mp && (
          <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-mono">
            FIRST EVER
          </span>
        )}
        {signal.is_first_ever_entry_mp === false && signal.signal_type === 'new_entry_mp' && (
          <span className="text-[10px] bg-gray-500/10 text-gray-500 border border-gray-500/20 px-2 py-0.5 rounded-full font-mono">
            RE-ENTRY
          </span>
        )}
        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
          signal.priority === 'P0' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {signal.priority}
        </span>
      </div>

      <div className="flex gap-4">
        {/* 게임 이미지 */}
        {signal.header_image_url && (
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
            <img
              src={signal.header_image_url}
              alt={signal.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 pr-20">
          {/* 신호 타입 배지 */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border} font-mono tracking-widest`}>
              {cfg.label}
            </span>
            {signal.signal_type === 'new_entry_mp' && payload.rank && (
              <span className="text-[10px] text-gray-500 font-mono">#{payload.rank}</span>
            )}
          </div>

          {/* 게임 제목 */}
          <a
            href={`https://store.steampowered.com/app/${signal.app_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-base font-black truncate block transition-colors mb-1 hover:text-cyan-400`}
          >
            {signal.title}
          </a>

          {/* CCU */}
          {payload.concurrent_users && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">CCU</span>
              <span className={`text-sm font-bold font-mono ${cfg.color}`}>
                {payload.concurrent_users.toLocaleString()}
              </span>
            </div>
          )}

          {/* 상장사 정보 */}
          {signal.is_listed && signal.stock_ticker && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono">
                📊 {signal.company_name} · {signal.stock_ticker}
              </span>
            </div>
          )}
          {signal.is_listed === false && signal.company_name && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] bg-gray-500/10 text-gray-500 border border-gray-500/20 px-2 py-0.5 rounded font-mono">
                🔒 {signal.company_name}
              </span>
            </div>
          )}

          {/* YouTube 감성 분석 바 */}
          {signal.video_url && signal.comments_total && (
            <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                  YouTube · {signal.comments_total} comments
                </span>
                <a
                  href={signal.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-cyan-600 hover:text-cyan-400 transition-colors font-mono"
                >
                  ↗ WATCH
                </a>
              </div>
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.6)]" style={{ width: `${signal.positive_pct}%` }} />
                <div className="bg-gray-600" style={{ width: `${signal.neutral_pct}%` }} />
                <div className="bg-red-500" style={{ width: `${signal.negative_pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 font-mono">
                <span className="text-green-400">+{signal.positive_pct}%</span>
                <span className="text-gray-600">{signal.neutral_pct}%</span>
                <span className="text-red-400">-{signal.negative_pct}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
