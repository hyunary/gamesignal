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
  title: 'GameSignal — Steam 게임 신호 감지',
  description: 'Steam 게임 트래픽 데이터 기반 신호 감지 서비스',
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
