import { getTodaySignals, getRecentSignals, getPipelineStatus, getTopGames, getSignalHistory, getCCUHistory, getSignalCounts } from '../lib/queries';
import { computePipelineInfo } from '../lib/pipeline';
import TerminalDashboard from '../components/TerminalDashboard';
import TerminalShell from '../components/TerminalShell';

export const revalidate = 0;

export default async function Home() {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = nowKST.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(nowKST.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [todaySignals, recentSignals, pipelineStatus, topGames, signalHistory] = await Promise.all([
    getTodaySignals().catch(() => []),
    getRecentSignals().catch(() => []),
    getPipelineStatus().catch(() => []),
    getTopGames().catch(() => []),
    getSignalHistory().catch(() => []),
  ]);

  const allSignals = todaySignals.length > 0 ? todaySignals : recentSignals;
  const isToday = todaySignals.length > 0;

  const pipelineInfo = computePipelineInfo(pipelineStatus);
  const pipelineLabel = pipelineInfo.status === 'unavailable' ? '—' : pipelineInfo.lastRun;

  const appIds = Array.from(new Set(allSignals.map((s: any) => s.app_id as number)));
  const signalDates = allSignals.map((s: any) => s.signal_date as string).sort();
  const minSignalDate = signalDates[0] ?? today;
  const maxSignalDate = signalDates[signalDates.length - 1] ?? today;
  const countDateFrom = isToday ? today : sevenDaysAgo;

  const [ccuHistory, signalCounts] = await Promise.all([
    appIds.length > 0
      ? getCCUHistory(appIds, minSignalDate, maxSignalDate).catch(() => [])
      : Promise.resolve([]),
    getSignalCounts(countDateFrom, today).catch(() => null),
  ]);

  return (
    <TerminalShell activeTab="dashboard">
      <TerminalDashboard
        signals={allSignals}
        topGames={topGames}
        pipelineStatus={pipelineStatus}
        signalHistory={signalHistory}
        pipelineLabel={pipelineLabel}
        isToday={isToday}
        ccuHistory={ccuHistory}
        signalCounts={signalCounts}
        today={today}
      />
    </TerminalShell>
  );
}
