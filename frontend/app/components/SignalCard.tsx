interface SignalCardProps {
  signal: {
    signal_id: string;
    signal_type: string;
    priority: string;
    title: string;
    signal_date: string;
    payload: any;
    genres: string[];
    header_image_url: string;
    most_played_rank: number;
    concurrent_users: number;
    wishlist_rank: number;
    company_name: string | null;
    stock_ticker: string | null;
    exchange: string | null;
    is_listed: boolean | null;
    is_first_ever_entry_mp: boolean | null;
    positive_pct: number | null;
    neutral_pct: number | null;
    negative_pct: number | null;
    video_url: string | null;
    video_title: string | null;
    comments_total: number | null;
  };
}

const SIGNAL_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  new_entry_mp:    { emoji: '🎮', label: 'Most Played 신규 진입', color: 'border-green-500' },
  new_entry_wl:    { emoji: '⭐', label: 'Wishlist 신규 진입',    color: 'border-blue-500' },
  traffic_revival: { emoji: '🔥', label: '트래픽 부활',           color: 'border-orange-500' },
  wishlist_surge:  { emoji: '📈', label: '위시리스트 급등',        color: 'border-blue-400' },
  review_spike:    { emoji: '💬', label: '리뷰 급증',             color: 'border-pink-500' },
  composite:       { emoji: '⚡', label: '복합 신호',             color: 'border-purple-500' },
};

export default function SignalCard({ signal }: SignalCardProps) {
  const cfg = SIGNAL_CONFIG[signal.signal_type] || { emoji: '📊', label: signal.signal_type, color: 'border-gray-500' };
  const date = new Date(signal.signal_date).toLocaleDateString('ko-KR');

  return (
    <div className={`bg-gray-900 border-l-4 ${cfg.color} rounded-lg p-4 hover:bg-gray-800 transition-colors`}>
      <div className="flex items-start gap-3">
        {signal.header_image_url && (
          <img
            src={signal.header_image_url}
            alt={signal.title}
            className="w-24 h-14 object-cover rounded flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{cfg.emoji}</span>
            <span className="text-white font-semibold truncate">{signal.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
              signal.priority === 'P0' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
            }`}>
              {signal.priority}
            </span>
            {signal.signal_type === 'new_entry_mp' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                signal.is_first_ever_entry_mp
                  ? 'bg-green-900 text-green-300'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {signal.is_first_ever_entry_mp ? '🆕 역대 첫 진입' : '🔄 재진입'}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">{cfg.label}</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {signal.most_played_rank && (
              <span>📊 Most Played {signal.most_played_rank}위</span>
            )}
            {signal.concurrent_users && (
              <span>👥 {signal.concurrent_users.toLocaleString()}명</span>
            )}
            {signal.wishlist_rank && (
              <span>⭐ Wishlist {signal.wishlist_rank}위</span>
            )}
            {signal.payload?.ccu_pct && (
              <span>📈 +{signal.payload.ccu_pct}% 반등</span>
            )}
            {signal.payload?.review_pct && (
              <span>💬 +{signal.payload.review_pct}% 급증</span>
            )}
            <span className="ml-auto">{date}</span>
          </div>
          {signal.genres?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {signal.genres.slice(0, 3).map(g => (
                <span key={g} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                  {g}
                </span>
              ))}
            </div>
          )}
          {signal.is_listed && signal.stock_ticker && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded font-mono">
                📊 {signal.company_name}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {signal.stock_ticker} · {signal.exchange}
              </span>
            </div>
          )}
          {signal.is_listed === false && signal.company_name && (
            <div className="mt-2">
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                🔒 {signal.company_name} · 비상장
              </span>
            </div>
          )}
          {signal.video_url && signal.comments_total && (
            <div className="mt-2 p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs text-gray-400">🎬 YouTube 댓글 분석</span>
                <span className="text-xs text-gray-600">({signal.comments_total}개)</span>
                <a
                  href={signal.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 ml-auto"
                >
                  영상 보기 →
                </a>
              </div>
              <div className="flex gap-1 h-2 rounded overflow-hidden">
                <div
                  className="bg-green-500"
                  style={{ width: `${signal.positive_pct}%` }}
                />
                <div
                  className="bg-gray-500"
                  style={{ width: `${signal.neutral_pct}%` }}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${signal.negative_pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-green-400">긍정 {signal.positive_pct}%</span>
                <span className="text-gray-400">중립 {signal.neutral_pct}%</span>
                <span className="text-red-400">부정 {signal.negative_pct}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
