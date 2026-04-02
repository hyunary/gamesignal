import { getNewsByDate, getNewsDateList, NewsClip } from '../lib/queries';
import Link from 'next/link';


export const revalidate = 0;

const IMPORTANCE_CONFIG = {
  high:   { emoji: '🔴', label: 'High',   color: 'bg-red-900 text-red-300' },
  medium: { emoji: '🟡', label: 'Medium', color: 'bg-yellow-900 text-yellow-300' },
  low:    { emoji: '🟢', label: 'Low',    color: 'bg-green-900 text-green-300' },
};

export default async function NewsPage() {
  const [{ clips, summary }, dates] = await Promise.all([
    getNewsByDate().catch(() => ({ clips: [], summary: null })),
    getNewsDateList().catch(() => []),
  ]);

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const businessClips = clips.filter(c => c.category === 'business');
  const newgameClips  = clips.filter(c => c.category === 'newgame');

  return (
    <main className="min-h-screen bg-[#070B14] text-gray-100 bg-grid">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase">
              📰 게임 뉴스 <span className="text-yellow-400">클리핑</span>
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">인벤 · VC/애널리스트 관점 분석</p>
          </div>
          <div className="text-right text-xs text-gray-500 font-mono">
            <p>{today}</p>
            <p className="text-gray-600">{clips.length}개 뉴스</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8">
        {clips.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-12 text-center text-gray-600">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-xl">오늘 수집된 뉴스가 없습니다</p>
            <p className="text-base mt-2">Claude Code에서 &ldquo;인벤 뉴스 분석해줘&rdquo;를 실행해주세요</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* 핵심 요약 */}
            {summary && (
              <div className="bg-gray-900 border border-yellow-800 rounded-lg p-5">
                <h2 className="text-xs font-mono text-yellow-400 uppercase tracking-wider mb-3">
                  📌 오늘의 핵심 요약
                </h2>
                <div className="space-y-1.5">
                  {summary.summary.split('\n').map((line, i) => (
                    <p key={i} className="text-gray-300 text-base leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* 업계·비즈니스 */}
            {businessClips.length > 0 && (
              <section>
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4">
                  🏢 업계·비즈니스
                </h2>
                <div className="space-y-4">
                  {businessClips.map(clip => (
                    <NewsCard key={clip.id} clip={clip} />
                  ))}
                </div>
              </section>
            )}

            {/* 신작·서비스 */}
            {newgameClips.length > 0 && (
              <section>
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4">
                  🎮 신작·서비스
                </h2>
                <div className="space-y-4">
                  {newgameClips.map(clip => (
                    <NewsCard key={clip.id} clip={clip} />
                  ))}
                </div>
              </section>
            )}

            {/* 날짜 히스토리 */}
            {dates.length > 1 && (
              <section>
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3">
                  📅 이전 클리핑
                </h2>
                <div className="flex flex-wrap gap-2">
                  {dates.slice(1).map(date => (
                    <Link
                      key={date}
                      href={`/news?date=${date}`}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded font-mono transition-colors"
                    >
                      {date}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function NewsCard({ clip }: { clip: NewsClip }) {
  const cfg = IMPORTANCE_CONFIG[clip.importance as keyof typeof IMPORTANCE_CONFIG]
    || IMPORTANCE_CONFIG.medium;

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded font-mono flex-shrink-0 ${cfg.color}`}>
          {cfg.emoji} {cfg.label}
        </span>
        {clip.related_ticker && (
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded font-mono flex-shrink-0">
            📊 {clip.related_company} · {clip.related_ticker}
          </span>
        )}
      </div>

      <h3 className="text-white font-semibold mb-2 leading-snug">{clip.title}</h3>

      <p className="text-gray-400 text-base mb-3 leading-relaxed">{clip.summary}</p>

      {clip.analyst_comment && (
        <div className="bg-gray-800 rounded p-3 border-l-2 border-yellow-600">
          <p className="text-yellow-200 text-sm leading-relaxed">
            💡 <span className="italic">{clip.analyst_comment}</span>
          </p>
        </div>
      )}

      {clip.source_url && (
        <div className="mt-3">
          <a
            href={clip.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            원문 보기 →
          </a>
        </div>
      )}
    </div>
  );
}
