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
        </div>
      </div>
    </div>
  );
}
