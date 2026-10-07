import { getTodaySignals, getRecentSignals, getPipelineStatus, getTopGames, getSignalHistory } from '../lib/queries';
import { computePipelineInfo } from '../lib/pipeline';
import TerminalDashboard from '../components/TerminalDashboard';
import TerminalShell from '../components/TerminalShell';

export const revalidate = 0;

export default async function Home() {
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

  const successCount = pipelineStatus.filter((p: any) => p.status === 'success').length;
  const pipeline = `${successCount}/${pipelineStatus.length}`;

  return (
    <TerminalShell activeTab="dashboard">
      <TerminalDashboard
        signals={allSignals}
        topGames={topGames}
        pipelineStatus={pipelineStatus}
        signalHistory={signalHistory}
        pipelineLabel={pipelineLabel}
        pipeline={pipeline}
        isToday={isToday}
      />
    </TerminalShell>
  );
}
