import type { Metadata } from 'next';
import './globals.css';
import Header from './components/Header';
import ConditionalHeader from './components/ConditionalHeader';

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
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", fontSize: '16px' }}>
        <ConditionalHeader>
          <Header />
        </ConditionalHeader>
        {children}
      </body>
    </html>
  );
}
