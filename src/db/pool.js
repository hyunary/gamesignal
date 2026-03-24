const { Pool } = require('pg');
// GitHub Actions에서는 환경변수가 이미 주입됨
// 로컬에서는 .env 파일에서 읽음
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});
module.exports = pool;
