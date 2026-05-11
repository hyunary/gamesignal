import type { Metadata } from 'next';
import { Inter_Tight, IBM_Plex_Mono } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'NoiseCatcher — 게임 트래픽 신호를 먼저 잡다',
  description: '게임이 뜨기 전에 신호가 옵니다. AI가 노이즈 속에서 진짜를 건집니다.',
  openGraph: {
    title: 'NoiseCatcher — 게임 트래픽 신호를 먼저 잡다',
    description: '게임이 뜨기 전에 신호가 옵니다. AI가 노이즈 속에서 진짜를 건집니다.',
    url: 'https://noisecatcher.ai',
    siteName: 'NoiseCatcher',
    images: [
      {
        url: 'https://www.noisecatcher.ai/og-image.png',
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
    images: ['https://www.noisecatcher.ai/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${interTight.variable} ${ibmPlexMono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
