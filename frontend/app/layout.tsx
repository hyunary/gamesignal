import type { Metadata } from 'next';
import { Inter_Tight, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NoiseCatcher — 게임 트래픽 신호를 먼저 잡다',
  description: '게임이 뜨기 전에 신호가 옵니다. AI가 노이즈 속에서 진짜를 건집니다.',
  icons: {
    icon: [
      { url: '/brand/png/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/png/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/svg/symbol/nc-symbol-square.svg', type: 'image/svg+xml' },
    ],
    apple: '/brand/png/apple-touch-icon-180.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'NoiseCatcher — 게임 트래픽 신호를 먼저 잡다',
    description: '게임이 뜨기 전에 신호가 옵니다. AI가 노이즈 속에서 진짜를 건집니다.',
    url: 'https://noisecatcher.ai',
    siteName: 'NoiseCatcher',
    images: [
      {
        url: 'https://noisecatcher.ai/brand/png/og-image-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'NoiseCatcher — 게임 트래픽 신호를 먼저 잡다',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NoiseCatcher — 게임 트래픽 신호를 먼저 잡다',
    description: '게임이 뜨기 전에 신호가 옵니다. AI가 노이즈 속에서 진짜를 건집니다.',
    images: ['https://noisecatcher.ai/brand/png/og-image-1200x630.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${interTight.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
