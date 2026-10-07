interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  timeLabel?: string;
  timeValue?: string;
}

export default function PageHeading({
  eyebrow,
  title,
  description,
  timeLabel,
  timeValue,
}: PageHeadingProps) {
  return (
    <header className="nc-page-heading">
      <div>
        <span className="gs-eyebrow">{eyebrow}</span>
        <h1 className="gs-h1">{title}</h1>
        {description && <p className="gs-deck">{description}</p>}
      </div>
      {timeLabel && timeValue && (
        <div className="nc-page-heading-time">
          <div style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)',
            letterSpacing: '.1em', textTransform: 'uppercase' as const, marginBottom: 3,
          }}>
            {timeLabel}
          </div>
          <div style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
            {timeValue}
          </div>
        </div>
      )}
    </header>
  );
}
