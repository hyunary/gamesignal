const { Pool } = require('pg');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
// Supabase Transaction Pooler URL 파싱
// GitHub Actions에서 IPv6 문제를 우회하기 위해
// host를 직접 지정하고 port를 6543으로 고정
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // IPv4 강제 설정
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.cyihmrtldkhkqdtdosds',
});
module.exports = pool;
