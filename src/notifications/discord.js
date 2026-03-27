const axios = require('axios');
const pool = require('../db/pool');
const { retryWithBackoff } = require('../utils/retry');
require('dotenv').config();
// 신호 타입별 이모지 + 색상
const SIGNAL_CONFIG = {
  new_entry_mp:    { emoji: '🎮', label: 'Most Played 신규 진입', color: 0x3de87a },
  new_entry_wl:    { emoji: '⭐', label: 'Wishlist 신규 진입',    color: 0x5ba3f5 },
  traffic_revival: { emoji: '🔥', label: '트래픽 부활',           color: 0xf5a623 },
  wishlist_surge:  { emoji: '📈', label: '위시리스트 급등',        color: 0x5ba3f5 },
  review_spike:    { emoji: '💬', label: '리뷰 급증',             color: 0xf580b0 },
  composite:       { emoji: '⚡', label: '복합 신호',             color: 0xc880f0 },
};
// Discord 웹훅으로 메시지 전송
async function sendDiscordMessage(webhookUrl, payload) {
  await retryWithBackoff(
    () => axios.post(webhookUrl, payload, { timeout: 10000 }),
    { label: 'discord', maxRetries: 3, baseMs: 1000 }
  );
}
// 신호 알림 (P0 → ALERT 채널)
async function sendSignalAlert(signal, game) {
  if (signal.notified_at) return; // 중복 발송 방지
  const cfg = SIGNAL_CONFIG[signal.signal_type] || { emoji: '📊', label: signal.signal_type, color: 0x888780 };
  const payload = signal.payload || {};
  // Discord Embed 메시지
  const embed = {
    title: `${cfg.emoji} ${game.title}`,
    description: buildDescription(signal.signal_type, payload),
    color: signal.priority === 'P0' ? cfg.color : 0x888780,
    fields: buildFields(signal.signal_type, payload, game),
    footer: {
      text: `GameSignal • ${signal.signal_date} • ${signal.priority}`
    },
    timestamp: new Date().toISOString()
  };
  console.log('Discord 웹훅 URL 확인:', process.env.DISCORD_WEBHOOK_ALERT ? '설정됨' : '미설정');
  console.log('Discord embed 내용:', JSON.stringify(embed).slice(0, 200));
  await sendDiscordMessage(process.env.DISCORD_WEBHOOK_ALERT, { embeds: [embed] });
  // notified_at 업데이트
  await pool.query(
    'UPDATE signals SET notified_at = NOW() WHERE signal_id = $1',
    [signal.signal_id]
  );
  // notifications_log 기록
  await pool.query(`
    INSERT INTO notifications_log
      (app_id, signal_id, notification_date, channel, recipient, status, payload)
    VALUES ($1, $2, CURRENT_DATE, 'discord', 'gamesignal-alerts', 'sent', $3)
    ON CONFLICT (app_id, notification_date, channel, recipient) DO NOTHING
  `, [signal.app_id, signal.signal_id, JSON.stringify(embed)]);
}
// 신호 타입별 설명 문구
function buildDescription(signalType, payload) {
  switch (signalType) {
    case 'new_entry_mp':
      return `Steam Most Played Top 100에 **${payload.rank}위**로 첫 진입했습니다.\n동시접속자 **${(payload.concurrent_users || 0).toLocaleString()}명** 기록.`;
    case 'new_entry_wl':
      return `Steam Wishlist Top 50 **${payload.wishlist_rank}위**에 처음 등장했습니다.`;
    case 'traffic_revival':
      return `**${payload.absent_days}일** 차트 이탈 후 오늘 복귀!\n7일 평균 대비 CCU **+${payload.ccu_pct}%** 급반등.`;
    case 'wishlist_surge':
      return `위시리스트 순위 **${payload.prev_rank}위 → ${payload.curr_rank}위**\n**+${payload.change}계단** 급등!`;
    case 'review_spike':
      return `최근 30일 리뷰 **+${payload.review_pct}%** 급증\n긍정률 **${payload.pos_pct}%**`;
    case 'composite':
      return `**${payload.signal_count}개** 신호 동시 발동!\n${payload.composite_types?.join(' + ')}\n\n⚠️ 투자 판단 전 추가 검토를 권장합니다.`;
    default:
      return '신호가 감지됐습니다.';
  }
}
// 신호 타입별 필드
function buildFields(signalType, payload, game) {
  const fields = [];
  if (game.genres?.length > 0) {
    fields.push({ name: '장르', value: game.genres.slice(0, 3).join(', '), inline: true });
  }
  if (payload.concurrent_users) {
    fields.push({ name: 'CCU', value: payload.concurrent_users.toLocaleString() + '명', inline: true });
  }
  return fields;
}
// 파이프라인 완료 알림
async function sendPipelineSuccess(stats) {
  const embed = {
    title: '✅ GameSignal 파이프라인 완료',
    color: 0x3de87a,
    fields: [
      { name: '수집 게임', value: `${stats.games}개`, inline: true },
      { name: '감지 신호', value: `${stats.signals}개`, inline: true },
      { name: '소요 시간', value: `${stats.duration}초`, inline: true },
    ],
    footer: { text: `GameSignal • ${new Date().toLocaleDateString('ko-KR')} 배치 완료` },
    timestamp: new Date().toISOString()
  };
  await sendDiscordMessage(process.env.DISCORD_WEBHOOK_PIPELINE, { embeds: [embed] });
}
// 파이프라인 실패 알림
async function sendPipelineAlert(source, errorMessage) {
  const embed = {
    title: '🚨 GameSignal 파이프라인 오류',
    description: `**소스:** ${source}\n**에러:** ${errorMessage}`,
    color: 0xe24b4a,
    footer: { text: 'GameSignal • 즉시 확인 필요' },
    timestamp: new Date().toISOString()
  };
  await sendDiscordMessage(process.env.DISCORD_WEBHOOK_ALERT, { embeds: [embed] });
}
module.exports = { sendSignalAlert, sendPipelineSuccess, sendPipelineAlert };
