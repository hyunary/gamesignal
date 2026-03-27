interface Run {
  run_date: string;
  source: string;
  status: string;
  duration_sec: number;
  rows_collected: number;
  error_message: string;
}

export default function PipelineStatus({ runs }: { runs: Run[] }) {
  const statusColor: Record<string, string> = {
    success: 'text-green-400',
    failed:  'text-red-400',
    partial: 'text-yellow-400',
    running: 'text-blue-400',
  };

  const latestBySource = runs.reduce((acc, run) => {
    if (!acc[run.source]) acc[run.source] = run;
    return acc;
  }, {} as Record<string, Run>);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-3">
        파이프라인 상태
      </h3>
      <div className="space-y-2">
        {Object.values(latestBySource).map(run => (
          <div key={run.source} className="flex items-center justify-between text-sm">
            <span className="text-gray-300 font-mono">{run.source}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs">
                {run.duration_sec ? `${run.duration_sec}초` : '-'}
              </span>
              <span className="text-gray-500 text-xs">
                {run.rows_collected ? `${run.rows_collected}개` : ''}
              </span>
              <span className={`font-mono text-xs ${statusColor[run.status] || 'text-gray-400'}`}>
                {run.status === 'success' ? '✅' : run.status === 'failed' ? '❌' : '⏳'} {run.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
