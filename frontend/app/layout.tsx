import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="ko" className="dark">
      <body className={`${inter.className} bg-gray-950`}>{children}</body>
    </html>
  );
}
