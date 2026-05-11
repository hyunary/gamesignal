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

  // Sort: high importance first
  const sortedClips = [...clips].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.importance as keyof typeof order] ?? 1) - (order[b.importance as keyof typeof order] ?? 1);
  });

  const featured = sortedClips[0] ?? null;
  const rest = sortedClips.slice(1);

  return (
    <TerminalShell activeTab="news">
      <div className="gs-page">

        {/* ── Page header ─────────────────────────────────────────── */}
        <header style={{ marginBottom: 36 }}>
          <span className="gs-eyebrow">02 — EDITORIAL</span>
          <h1 className="gs-h1">What moved the market today.</h1>
          <p className="gs-deck">
            Steam 생태계의 주요 사건을 애널리스트 관점에서 큐레이션합니다.
            {clips.length > 0 && ` ${displayDate} · 총 ${clips.length}건.`}
          </p>
        </header>

        {clips.length === 0 ? (
          <div style={{
            padding: '56px 0', textAlign: 'center',
            border: '1px solid var(--line)', borderRadius: 10,
            background: 'var(--bg-elev)',
          }}>
            <p style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-4)', letterSpacing: '.1em' }}>
              NO NEWS CLIPS FOR THIS DATE
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 8 }}>
              Claude Code에서 &ldquo;인벤 뉴스 분석해줘&rdquo;를 실행해주세요
            </p>
          </div>
        ) : (
          <>
            {/* ── Featured lead ───────────────────────────────────── */}
            {featured && (
              <section style={{
                display: 'block',
                border: '1px solid var(--line)', borderRadius: 10,
                background: 'var(--bg-elev)', overflow: 'hidden',
                marginBottom: 48,
              }}>
                {/* Featured body */}
                <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="gs-section-label">TODAY&apos;S LEAD</span>
                    <ImportancePill importance={featured.importance} />
                    <span style={{
                      fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
                      letterSpacing: '.1em', color: 'var(--ink-3)',
                    }}>
                      {featured.category.toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 28, lineHeight: 1.2, letterSpacing: '-0.025em', fontWeight: 500, margin: '10px 0 14px' }}>
                    {featured.title}
                  </h2>
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 20px' }}>
                    {featured.summary}
                  </p>
                  {featured.analyst_comment && (
                    <div style={{
                      background: '#FFFBEB',
                      borderLeft: '3px solid #F59E0B',
                      borderRadius: '0 6px 6px 0',
                      padding: '12px 14px',
                      marginBottom: 16,
                    }}>
                      <div style={{
                        fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 700,
                        letterSpacing: '.1em', color: '#D97706', marginBottom: 6,
                      }}>
                        📊 ANALYST VIEW
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                        {featured.analyst_comment}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    {featured.related_ticker ? (
                      <span style={{
                        fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--accent-ink)',
                        background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: 4,
                      }}>
                        {featured.related_company} · {featured.related_ticker}
                      </span>
                    ) : <span />}
                    {featured.source_url && (
                      <a href={featured.source_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                        원문 보기 →
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ── Main: stories + briefing sidebar ────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 48, alignItems: 'start' }}>

              {/* Story list */}
              <div>
                <span className="gs-section-label">LATEST STORIES</span>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                  {rest.map((clip, i) => (
                    <StoryRow key={clip.id} clip={clip} idx={i} />
                  ))}
                </div>
              </div>

              {/* Sidebar */}
              <aside style={{ position: 'sticky', top: 80 }}>

                {/* Daily summary / briefing */}
                {summary && (
                  <div style={{ marginBottom: 32 }}>
                    <span className="gs-section-label">TODAY&apos;S BRIEFING</span>
                    <h3 style={{ fontSize: 20, letterSpacing: '-0.02em', fontWeight: 500, margin: '2px 0 16px' }}>
                      오늘을 60초로
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {summary.summary.split('\n').filter(Boolean).map((line, i) => (
                        <p key={i} style={{
                          fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)',
                          paddingLeft: 14, position: 'relative', margin: 0,
                        }} className="fc-bullet">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archive dates */}
                {dates.length > 1 && (
                  <div>
                    <span className="gs-section-label">ARCHIVE</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {dates.slice(0, 14).map(date => (
                        <Link key={date} href={`/news?date=${date}`} style={{
                          fontFamily: 'var(--t-mono)', fontSize: 11,
                          color: date === displayDate ? 'var(--accent-ink)' : 'var(--ink-3)',
                          background: date === displayDate ? 'var(--accent-soft)' : 'var(--bg-sunken)',
                          padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 4,
                          textDecoration: 'none',
                        }}>
                          {date}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              </aside>
            </div>
          </>
        )}

      </div>
    </TerminalShell>
  );
}

// ─── Importance Pill ─────────────────────────────────────────────────────────

function ImportancePill({ importance }: { importance: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    high:   { label: 'HIGH',   color: 'var(--p0)', bg: 'var(--p0-soft)' },
    medium: { label: 'MED',    color: 'var(--p1)', bg: 'var(--p1-soft)' },
    low:    { label: 'LOW',    color: 'var(--p2)', bg: 'var(--p2-soft)' },
  };
  const cfg = map[importance] || map.medium;
  return (
    <span style={{
      fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
      background: cfg.bg, color: cfg.color, padding: '3px 7px', borderRadius: 999,
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Story Row ───────────────────────────────────────────────────────────────

function StoryRow({ clip, idx }: { clip: NewsClip; idx: number }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 1fr',
      gap: 18, padding: '20px 14px',
      borderBottom: '1px solid var(--line)',
    }}>
      {/* Index */}
      <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', paddingTop: 3 }}>
        {String(idx + 2).padStart(2, '0')}
      </span>
      {/* Content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ImportancePill importance={clip.importance} />
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em',
            color: 'var(--ink-3)',
          }}>
            {clip.category.toUpperCase()}
          </span>
        </div>
        <h3 style={{ fontSize: 17, lineHeight: 1.3, letterSpacing: '-0.015em', fontWeight: 500, margin: '0 0 8px', color: 'var(--ink)' }}>
          {clip.title}
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55, margin: '0 0 10px' }}>
          {clip.summary}
        </p>
        {clip.analyst_comment && (
          <div style={{
            background: '#FFFBEB',
            borderLeft: '3px solid #F59E0B',
            borderRadius: '0 6px 6px 0',
            padding: '10px 12px',
            margin: '0 0 10px',
          }}>
            <div style={{
              fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 700,
              letterSpacing: '.1em', color: '#D97706', marginBottom: 5,
            }}>
              📊 ANALYST VIEW
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
              {clip.analyst_comment}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {clip.related_ticker && (
            <span style={{
              fontFamily: 'var(--t-mono)', fontSize: 10.5,
              color: 'var(--accent-ink)', background: 'var(--accent-soft)',
              padding: '2px 7px', borderRadius: 3,
            }}>
              {clip.related_company} · {clip.related_ticker}
            </span>
          )}
          {clip.source_url && (
            <a href={clip.source_url} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
              원문 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
