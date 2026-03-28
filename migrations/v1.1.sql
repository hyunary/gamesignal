-- ============================================================
-- GameSignal — v1.1 Migration
-- 상장사 정보 테이블 추가
-- ============================================================

-- 개발사/퍼블리셔 → 상장사 매핑 테이블
CREATE TABLE IF NOT EXISTS publisher_stocks (
    id              SERIAL          PRIMARY KEY,
    developer_name  VARCHAR(255)    NOT NULL,   -- games.developer 또는 publisher 값
    company_name    VARCHAR(255)    NOT NULL,   -- 실제 법인명
    stock_ticker    VARCHAR(20),               -- 주식 티커 (예: 263750.KS)
    exchange        VARCHAR(20),               -- 거래소 (KRX, NASDAQ, NYSE, TSE 등)
    is_listed       BOOLEAN         NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_developer UNIQUE (developer_name)
);

-- 주요 Steam 게임 개발사 초기 데이터
INSERT INTO publisher_stocks (developer_name, company_name, stock_ticker, exchange, is_listed, notes) VALUES
-- 한국 상장사
('Pearl Abyss', '펄어비스', '263750.KS', 'KRX', TRUE, 'Black Desert 개발사'),
('Krafton', '크래프톤', '259960.KS', 'KRX', TRUE, 'PUBG 개발사'),
('Nexon', '넥슨', '3659.T', 'TSE', TRUE, '일본 상장'),
('NCSoft', '엔씨소프트', '036570.KS', 'KRX', TRUE, NULL),
('Netmarble', '넷마블', '251270.KS', 'KRX', TRUE, NULL),
('Smilegate', '스마일게이트', NULL, NULL, FALSE, '비상장'),
-- 미국 상장사
('Valve', 'Valve Corporation', NULL, NULL, FALSE, '비상장'),
('Electronic Arts', 'Electronic Arts', 'EA', 'NASDAQ', TRUE, NULL),
('Activision', 'Microsoft', 'MSFT', 'NASDAQ', TRUE, 'Microsoft 인수'),
('Blizzard Entertainment', 'Microsoft', 'MSFT', 'NASDAQ', TRUE, 'Microsoft 인수'),
('Riot Games', 'Tencent', '700.HK', 'HKEX', TRUE, 'Tencent 자회사'),
('CD Projekt', 'CD Projekt', 'CDR.WA', 'WSE', TRUE, 'Cyberpunk 2077 개발사'),
('Ubisoft', 'Ubisoft', 'UBI.PA', 'Euronext', TRUE, NULL),
('2K Games', 'Take-Two Interactive', 'TTWO', 'NASDAQ', TRUE, NULL),
('Rockstar Games', 'Take-Two Interactive', 'TTWO', 'NASDAQ', TRUE, 'GTA 개발사'),
('Bethesda Softworks', 'Microsoft', 'MSFT', 'NASDAQ', TRUE, 'Microsoft 인수'),
('Bethesda Game Studios', 'Microsoft', 'MSFT', 'NASDAQ', TRUE, 'Microsoft 인수'),
('id Software', 'Microsoft', 'MSFT', 'NASDAQ', TRUE, 'Microsoft 인수'),
('Paradox Interactive', 'Paradox Interactive', NULL, NULL, FALSE, '비상장'),
('Capcom', 'Capcom', '9697.T', 'TSE', TRUE, 'Monster Hunter 개발사'),
('Bandai Namco', 'Bandai Namco', '7832.T', 'TSE', TRUE, NULL),
('Square Enix', 'Square Enix', '9684.T', 'TSE', TRUE, 'FF14 개발사'),
('SEGA', 'SEGA Sammy', '6460.T', 'TSE', TRUE, NULL),
('Konami', 'Konami', '9766.T', 'TSE', TRUE, NULL),
('Koei Tecmo', 'Koei Tecmo', '3635.T', 'TSE', TRUE, NULL),
('505 Games', '505 Games', NULL, NULL, FALSE, '비상장'),
('Tripwire Interactive', 'Embracer Group', NULL, NULL, FALSE, NULL),
('Deep Silver', 'Plaion', NULL, NULL, FALSE, NULL),
('THQ Nordic', 'Embracer Group', NULL, NULL, FALSE, NULL),
('Focus Entertainment', 'Focus Entertainment', 'ALFOC.PA', 'Euronext', TRUE, NULL),
('Warhorse Studios', 'Koch Media', NULL, NULL, FALSE, NULL),
('Grinding Gear Games', 'Tencent', '700.HK', 'HKEX', TRUE, 'Path of Exile 개발사'),
('Larian Studios', 'Larian Studios', NULL, NULL, FALSE, '비상장, Baldur''s Gate 3'),
('Fatshark', 'Fatshark', NULL, NULL, FALSE, '비상장'),
('Wube Software', 'Wube Software', NULL, NULL, FALSE, '비상장, Factorio'),
('ConcernedApe', 'ConcernedApe', NULL, NULL, FALSE, '1인 개발, Stardew Valley'),
('Re-Logic', 'Re-Logic', NULL, NULL, FALSE, '비상장, Terraria'),
('Bohemia Interactive', 'Bohemia Interactive', NULL, NULL, FALSE, '비상장, DayZ/Arma'),
('Klei Entertainment', 'Tencent', '700.HK', 'HKEX', TRUE, 'Don''t Starve Together'),
('Hopoo Games', 'Gearbox', NULL, NULL, FALSE, NULL),
('Pocketpair', 'Pocketpair', NULL, NULL, FALSE, '비상장, Palworld'),
('Stunlock Studios', 'Stunlock Studios', NULL, NULL, FALSE, '비상장'),
('Hooded Horse', 'Hooded Horse', NULL, NULL, FALSE, '비상장'),
('Haemimont Games', 'Haemimont Games', NULL, NULL, FALSE, '비상장'),
('Massive Entertainment', 'Ubisoft', 'UBI.PA', 'Euronext', TRUE, 'Division 개발사'),
('PUBG Corporation', '크래프톤', '259960.KS', 'KRX', TRUE, NULL),
('Tencent Games', 'Tencent', '700.HK', 'HKEX', TRUE, NULL),
('NetEase Games', 'NetEase', 'NTES', 'NASDAQ', TRUE, NULL),
('miHoYo', 'miHoYo', NULL, NULL, FALSE, '비상장'),
('HoYoverse', 'miHoYo', NULL, NULL, FALSE, '비상장'),
('Nexon Games', '넥슨', '3659.T', 'TSE', TRUE, NULL),
('Neople', '넥슨', '3659.T', 'TSE', TRUE, NULL)
ON CONFLICT (developer_name) DO NOTHING;
