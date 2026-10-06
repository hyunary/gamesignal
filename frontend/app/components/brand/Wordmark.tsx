import Link from 'next/link';

export default function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="NoiseCatcher 대시보드" className="nc-wordmark">
      Noise<span className="nc-wordmark__catch">Catcher</span>
    </Link>
  );
}
