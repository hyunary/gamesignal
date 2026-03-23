const pool = require('../db/pool');
async function emitSignal(appId, today, signalType, priority, payload, compositeTypes = null) {
  try {
    await pool.query(`
      INSERT INTO signals
        (app_id, signal_date, signal_type, priority, payload, composite_types)
      VALUES ($1, $2, $3::signal_type, $4, $5, $6)
      ON CONFLICT (app_id, signal_date, signal_type) DO NOTHING
    `, [
      appId, today, signalType, priority,
      JSON.stringify(payload),
      compositeTypes
    ]);
    return true;
  } catch (err) {
    console.error(`  ⚠️ signal INSERT 실패 (${signalType}/${appId}): ${err.message}`);
    return false;
  }
}
module.exports = { emitSignal };
