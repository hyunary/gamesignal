import { getNewsByDate, getNewsDateList, NewsClip, NewsSummary } from '../lib/queries';
import TerminalShell from '../components/TerminalShell';
import PageHeading from '../components/PageHeading';
import Markdown from '../components/Markdown';
import Link from 'next/link';

export const revalidate = 0;

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// ─── Error panel ─────────────────────────────────────────────────────────────

function ErrorPanel({
  code,
  message,
  detail,
  link,
}: {
  code: string;
  message: string;
  detail?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div style={{
      padding: '48px 32px', textAlign: 'center',
      border: '1px solid var(--line)', borderRadius: 'var(--r)',
      background: 'var(--bg-elev)',
    }}>
      <p style={{
        fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)',
        letterSpacing: '.1em', marginBottom: 10,
      }}>
        {code}
      </p>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
        {message}
      </p>
      {detail && (
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
          {detail}
        </p>
      )}
      {link && (
        <Link href={link.href} style={{
          fontFamily: 'var(--t-mono)', fontSize: 12,
          color: 'var(--accent)', textDecoration: 'none',
        }}>
          {link.label} →
        </Link>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function NewsPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const rawDate = searchParams?.date;

  // 1) Date validation before DB query
  const dateInvalid = rawDate !== undefined && !isValidDate(rawDate);

  // Always fetch date list (cheap; needed for archive + latest link in errors)
  const dates = await getNewsDateList().catch(() => []);
  const latestDate = dates[0] ?? null;
  const latestLink = latestDate
    ? { href: `/news?date=${latestDate}`, label: '최신 브리핑 보기' }
    : { href: '/news', label: '최신 브리핑 보기' };

  if (dateInvalid) {
    return (
      <TerminalShell activeTab="news">
        <div className="gs-page">
          <PageHeading
            eyebrow="02 — EDITORIAL"
            title="What matters today."
            description="Steam 생태계의 주요 사건을 애널리스트 관점에서 큐레이션합니다."
          />
          <ErrorPanel
            code="INVALID DATE"
            message="잘못된 날짜 형식입니다."
            detail={`"${rawDate}"은(는) YYYY-MM-DD 형식이 아니거나 존재하지 않는 날짜입니다.`}
            link={latestLink}
          />
        </div>
      </TerminalShell>
    );
  }

  // 2) Fetch news — catch separately to distinguish fetch failure from empty
  let clips: NewsClip[] = [];
  let summary: NewsSummary | null = null;
  let fetchFailed = false;

  try {
    const result = await getNewsByDate(rawDate);
    clips = result.clips;
    summary = result.summary;
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed) {
    return (
      <TerminalShell activeTab="news">
        <div className="gs-page">
          <PageHeading
            eyebrow="02 — EDITORIAL"
            title="What matters today."
            description="Steam 생태계의 주요 사건을 애널리스트 관점에서 큐레이션합니다."
          />
          <ErrorPanel
            code="FETCH ERROR"
            message="뉴스를 불러오지 못했습니다."
            detail="서버와 통신 중 문제가 발생했습니다."
            link={{ href: rawDate ? `/news?date=${rawDate}` : '/news', label: '다시 시도' }}
          />
        </div>
      </TerminalShell>
    );
  }

  if (clips.length === 0) {
    return (
      <TerminalShell activeTab="news">
        <div className="gs-page">
          <PageHeading
            eyebrow="02 — EDITORIAL"
            title="What matters today."
            description="Steam 생태계의 주요 사건을 애널리스트 관점에서 큐레이션합니다."
          />
          <ErrorPanel
            code="NO CLIPS"
            message="이 날짜에 수집된 기사가 없습니다."
            detail={rawDate ? `${rawDate} 날짜의 기사를 찾을 수 없습니다.` : undefined}
            link={latestLink}
          />
        </div>
      </TerminalShell>
    );
  }

  // 3) displayDate — from data, not from today
  const displayDate = typeof clips[0].clip_date === 'string'
    ? clips[0].clip_date
    : (clips[0].clip_date as unknown as Date).toISOString().split('T')[0];

  // 4) Lead: importance=high, lowest id
  const highClips = clips.filter(c => c.importance === 'high').sort((a, b) => a.id - b.id);
  const featured = highClips[0] ?? null;
  const rest = clips.filter(c => c !== featured);

  return (
    <TerminalShell activeTab="news">
      <div className="gs-page">

        {/* ── Page header ─────────────────────────────────────────── */}
        <PageHeading
          eyebrow="02 — EDITORIAL"
          title="What matters today."
          description={`Steam 생태계의 주요 사건을 애널리스트 관점에서 큐레이션합니다. 총 ${clips.length}건.`}
          timeLabel="발행일"
          timeValue={displayDate}
        />

        {/* ── Today's Lead ────────────────────────────────────────── */}
        {featured && (
          <section style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderTop: '3px solid var(--accent)',
            borderRadius: 'var(--r)',
            overflow: 'hidden',
            marginBottom: 40,
          }}>
            <div style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="gs-section-label" style={{ margin: 0 }}>
                  TODAY&apos;S LEAD · 중요도 HIGH
                </span>
                <span style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
                  letterSpacing: '.1em', color: 'var(--ink-3)',
                }}>
                  {featured.category.toUpperCase()}
                </span>
              </div>
              <h2 className="nc-clamp-3" style={{
                fontSize: 26, lineHeight: 1.25, letterSpacing: '-0.025em',
                fontWeight: 500, margin: '0 0 14px',
              }}>
                {featured.title}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 18px' }}>
                {featured.summary}
              </p>
              {featured.analyst_comment && (
                <div style={{
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: 14,
                  marginBottom: 20,
                }}>
                  <div style={{
                    fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 700,
                    letterSpacing: '.1em', color: 'var(--accent)', marginBottom: 6,
                  }}>
                    ANALYST VIEW · AI 분석
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                    {featured.analyst_comment}
                  </div>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 14, borderTop: '1px solid var(--line)',
              }}>
                {featured.related_ticker ? (
                  <span style={{
                    fontFamily: 'var(--t-mono)', fontSize: 11,
                    color: 'var(--accent-ink)', background: 'var(--accent-soft)',
                    padding: '3px 8px', borderRadius: 'var(--r)',
                  }}>
                    {featured.related_company} · {featured.related_ticker}
                  </span>
                ) : <span />}
                {featured.source_url && (
                  <a
                    href={featured.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}
                  >
                    원문 보기 →
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Main grid: stories + sidebar ────────────────────────── */}
        <div className="nc-news-grid">

          {/* Story list */}
          <div>
            <span className="gs-section-label">LATEST STORIES</span>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
              {rest.map((clip, i) => (
                <StoryRow
                  key={clip.id}
                  clip={clip}
                  displayIdx={featured ? i + 2 : i + 1}
                />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ position: 'sticky', top: 80 }}>

            {/* Daily briefing */}
            {summary && (
              <div style={{ marginBottom: 32 }}>
                <span className="gs-section-label">TODAY&apos;S BRIEFING</span>
                <h3 style={{ fontSize: 20, letterSpacing: '-0.02em', fontWeight: 500, margin: '2px 0 16px' }}>
                  오늘을 60초로
                </h3>
                <Markdown>{summary.summary}</Markdown>
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
                      padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r)',
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

      </div>
    </TerminalShell>
  );
}

// ─── Importance Pill ─────────────────────────────────────────────────────────

function ImportancePill({ importance }: { importance: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    high:   { label: 'HIGH', color: 'var(--p0)', bg: 'var(--p0-soft)' },
    medium: { label: 'MED',  color: 'var(--p1)', bg: 'var(--p1-soft)' },
    low:    { label: 'LOW',  color: 'var(--p2)', bg: 'var(--p2-soft)' },
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

function StoryRow({ clip, displayIdx }: { clip: NewsClip; displayIdx: number }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 1fr',
      gap: 18, padding: '20px 0',
      borderBottom: '1px solid var(--line)',
    }}>
      {/* Index */}
      <span style={{
        fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)',
        fontVariantNumeric: 'tabular-nums', paddingTop: 3,
      }}>
        {String(displayIdx).padStart(2, '0')}
      </span>

      {/* Content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ImportancePill importance={clip.importance} />
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
            letterSpacing: '.1em', color: 'var(--ink-3)',
          }}>
            {clip.category.toUpperCase()}
          </span>
        </div>
        <h3 className="nc-clamp-2" style={{
          fontSize: 16, lineHeight: 1.3, letterSpacing: '-0.015em',
          fontWeight: 500, margin: '0 0 8px', color: 'var(--ink)',
        }}>
          {clip.title}
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55, margin: '0 0 10px' }}>
          {clip.summary}
        </p>
        {clip.analyst_comment && (
          <details className="nc-analyst-details" style={{
            borderLeft: '2px solid var(--accent)',
            paddingLeft: 12,
            marginBottom: 10,
          }}>
            <summary>ANALYST VIEW · AI 분석</summary>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '6px 0 0' }}>
              {clip.analyst_comment}
            </p>
          </details>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {clip.related_ticker && (
            <span style={{
              fontFamily: 'var(--t-mono)', fontSize: 10.5,
              color: 'var(--accent-ink)', background: 'var(--accent-soft)',
              padding: '2px 7px', borderRadius: 'var(--r)',
            }}>
              {clip.related_company} · {clip.related_ticker}
            </span>
          )}
          {clip.source_url && (
            <a
              href={clip.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}
            >
              원문 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
