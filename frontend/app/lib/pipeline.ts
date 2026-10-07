import { PipelineRun } from './queries';

export type PipelineInfo =
  | { status: 'ok' | 'stale'; lastRun: string }
  | { status: 'unavailable' };

const STALE_THRESHOLD_H = 30;

export function computePipelineInfo(runs: PipelineRun[]): PipelineInfo {
  const lastSuccess = runs.find(r => r.status === 'success');
  if (!lastSuccess) return { status: 'unavailable' };

  const startedAt = (lastSuccess as any).started_at;
  if (!startedAt) return { status: 'unavailable' };

  const runTime = new Date(startedAt);
  const hoursSince = (Date.now() - runTime.getTime()) / (1000 * 60 * 60);

  // Shift UTC → KST (+9h) then format as "MM-DD HH:MM KST"
  const kst = new Date(runTime.getTime() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  const lastRun = iso.slice(5, 7) + '-' + iso.slice(8, 10) + ' ' + iso.slice(11, 16) + ' KST';

  return { status: hoursSince > STALE_THRESHOLD_H ? 'stale' : 'ok', lastRun };
}
