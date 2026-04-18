import { getNewsByDate, getNewsDateList, NewsClip } from '../lib/queries';
import TerminalShell from '../components/TerminalShell';
import Link from 'next/link';

export const revalidate = 0;

export default async function NewsPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const [{ clips, summary }, dates] = await Promise.all([
    getNewsByDate(searchParams?.date).catch(() => ({ clips: [], summary: null })),
    getNewsDateList().catch(() => []),
  ]);

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const displayDate = clips[0]
    ? (typeof clips[0].clip_date === 'string' ? clips[0].clip_date : today)
    : today;

  const businessClips = clips.filter(c => c.category === 'business');
  const newgameClips  = clips.filter(c => c.category === 'newgame');

  return (
    <TerminalShell activeTab="news">
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Panel header ───────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--line)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>News Feed</span>
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
            background: 'var(--bg-sunken)', padding: '2px 7px', borderRadius: 999,
          }}>
            {clips.length} clips
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            {displayDate}
          </span>
        </div>

        {clips.length === 0 ? (
          <div style={{
            padding: '56px 24px', textAlign: 'center',
            background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8,
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>📭</div>
            <p style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-4)' }}>
              NO NEWS CLIPS
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 6 }}>
              Claude Code에서 &ldquo;인벤 뉴스 분석해줘&rdquo;를 실행해주세요
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 핵심 요약 */}
            {summary && (
              <div style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: '0 8px 8px 0',
                padding: '14px 18px',
              }}>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--accent)',
                  letterSpacing: '.1em', marginBottom: 10,
                }}>
                  TODAY&apos;S SUMMARY
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {summary.summary.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 업계·비즈니스 */}
            {businessClips.length > 0 && (
              <section>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>Business</span>
                  <span style={{ color: 'var(--ink-4)' }}>{businessClips.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {businessClips.map(clip => <NewsCard key={clip.id} clip={clip} />)}
                </div>
              </section>
            )}

            {/* 신작·서비스 */}
            {newgameClips.length > 0 && (
              <section>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>New Games</span>
                  <span style={{ color: 'var(--ink-4)' }}>{newgameClips.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newgameClips.map(clip => <NewsCard key={clip.id} clip={clip} />)}
                </div>
              </section>
            )}

            {/* 날짜 아카이브 */}
            {dates.length > 1 && (
              <section>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line)',
                }}>
                  Archive
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {dates.slice(1).map(date => (
                    <Link key={date} href={`/news?date=${date}`} style={{
                      fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)',
                      padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 4,
                      textDecoration: 'none', background: 'var(--bg-elev)',
                      transition: 'border-color .15s',
                    }}>
                      {date}
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </TerminalShell>
  );
}

// ─── News Card ──────────────────────────────────────────────────────────────

function NewsCard({ clip }: { clip: NewsClip }) {
  const cfgMap: Record<string, { label: string; color: string; bg: string }> = {
    high:   { label: 'HIGH', color: 'var(--p0)', bg: 'var(--p0-soft)' },
    medium: { label: 'MED',  color: 'var(--p1)', bg: 'var(--p1-soft)' },
    low:    { label: 'LOW',  color: 'var(--p2)', bg: 'var(--p2-soft)' },
  };
  const cfg = cfgMap[clip.importance] || cfgMap.medium;

  return (
    <div style={{
      background: 'var(--bg-elev)', border: '1px solid var(--line)',
      borderRadius: 8, padding: '14px 16px',
    }}>
      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span style={{
          fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
          background: cfg.bg, color: cfg.color, padding: '3px 7px', borderRadius: 999,
        }}>
          {cfg.label}
        </span>
        {clip.related_ticker && (
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10,
            background: 'var(--accent-soft)', color: 'var(--accent-ink)',
            padding: '3px 7px', borderRadius: 999,
          }}>
            📊 {clip.related_company} · {clip.related_ticker}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: 14, fontWeight: 600, color: 'var(--ink)',
        marginBottom: 6, lineHeight: 1.45,
      }}>
        {clip.title}
      </h3>

      {/* Summary */}
      <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>
        {clip.summary}
      </p>

      {/* Analyst comment */}
      {clip.analyst_comment && (
        <div style={{
          background: 'var(--bg-sunken)',
          borderLeft: '2px solid var(--p1)',
          borderRadius: '0 4px 4px 0',
          padding: '8px 12px', marginTop: 10,
        }}>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.65, fontStyle: 'italic' }}>
            💡 {clip.analyst_comment}
          </p>
        </div>
      )}

      {/* Source link */}
      {clip.source_url && (
        <div style={{ marginTop: 10 }}>
          <a
            href={clip.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--t-mono)', fontSize: 11,
              color: 'var(--ink-4)', textDecoration: 'none',
            }}>
            원문 보기 →
          </a>
        </div>
      )}
    </div>
  );
}
