import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Play,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Layers,
  Bot,
  Ban,
  FileText,
  ChevronRight,
  X
} from 'lucide-react';
import type {
  WorkerRecord,
  ColosseumRegistry,
  SystemStats
} from '../../../electron/colosseumStore';

type ColosseumStatsViewProps = {
  pushToast: (title: string, detail: string, tone?: 'good' | 'warning' | 'muted') => void;
  serverUrl?: string;
  apiKey?: string;
};

export function ColosseumStatsView({ pushToast, serverUrl = 'http://127.0.0.1:8090', apiKey }: ColosseumStatsViewProps) {
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [registry, setRegistry] = useState<ColosseumRegistry>({ agents: {}, pipelines: {} });
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Selected worker for detail drawer
  const [selectedWorker, setSelectedWorker] = useState<WorkerRecord | null>(null);

  // Log viewer state
  const [logModalWorker, setLogModalWorker] = useState<WorkerRecord | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [logLength, setLogLength] = useState<number>(0);
  const [logMtime, setLogMtime] = useState<number>(0);
  const [isFollowMode, setIsFollowMode] = useState<boolean>(true);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Destructive action confirmation modal
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    variant: 'danger',
    onConfirm: async () => {},
  });

  // Data fetching
  const refreshAll = useCallback(async () => {
    try {
      // 1. Workers from local registry
      if (window.sanctum?.getColosseumWorkers) {
        const wList = await window.sanctum.getColosseumWorkers();
        setWorkers(wList);
      }

      // 2. Pipelines registry
      if (window.sanctum?.getColosseumRegistry) {
        const reg = await window.sanctum.getColosseumRegistry();
        setRegistry(reg);
      }

      // 3. System stats from node:os
      if (window.sanctum?.getSystemStats) {
        const stats = await window.sanctum.getSystemStats();
        setSystemStats(stats);
      }

      // 4. Tasks from server REST
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(`${serverUrl}/api/tasks`, { headers });
        const taskData = res.ok ? await res.json() : null;
        if (Array.isArray(taskData)) {
          setTasks(taskData);
        }
      } catch {
        // Server unreachable - leave as unavailable
      }

      setLastRefreshed(new Date());
    } catch (err: any) {
      // Error
    } finally {
      setLoading(false);
    }
  }, [serverUrl, apiKey]);

  // 5s refresh tick
  useEffect(() => {
    void refreshAll();
    const interval = setInterval(refreshAll, 5000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Log tailing polling
  useEffect(() => {
    if (!logModalWorker || !window.sanctum?.tailColosseumLog) return;

    let active = true;
    const fetchLogChunk = async () => {
      try {
        const res = await window.sanctum.tailColosseumLog(
          logModalWorker.log_path,
          logLength,
          logMtime
        );
        if (!active) return;
        if (res.chunk) {
          setLogContent((prev) => prev + res.chunk);
          setLogLength(res.len);
          setLogMtime(res.mtime);
        }
      } catch {
        // ignore
      }
    };

    void fetchLogChunk();
    const tailInterval = setInterval(fetchLogChunk, 1500);

    return () => {
      active = false;
      clearInterval(tailInterval);
    };
  }, [logModalWorker, logLength, logMtime]);

  // Scroll to bottom when log updates in follow mode
  useEffect(() => {
    if (isFollowMode && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logContent, isFollowMode]);

  const openLogViewer = (worker: WorkerRecord) => {
    setLogModalWorker(worker);
    setLogContent('');
    setLogLength(0);
    setLogMtime(0);
    setIsFollowMode(true);
  };

  // Action Executions
  const executeRestart = async (worker: WorkerRecord) => {
    try {
      pushToast('Restarting...', `Stopping worker ${worker.worker_id} and relaunching...`, 'muted');
      const res = await window.sanctum.restartColosseumWorker(worker.worker_id);
      if (!res.success) {
        pushToast('Restart Failed', res.error || 'Could not restart worker', 'warning');
        return;
      }
      pushToast('Worker Restarted', `New worker launched: ${res.worker?.worker_id || 'active'}`, 'good');
      await refreshAll();
    } catch (err: any) {
      pushToast('Restart Error', err?.message || 'Failed to restart worker', 'warning');
    }
  };

  const executeStop = async (worker: WorkerRecord) => {
    try {
      const res = await window.sanctum.stopColosseumWorker(worker.worker_id);
      if (!res.success) {
        pushToast('Stop Failed', res.error || 'Could not stop worker', 'warning');
        return;
      }
      pushToast('Worker Stopped', `Worker ${worker.worker_id} terminated.`, 'good');
      await refreshAll();
    } catch (err: any) {
      pushToast('Stop Error', err?.message || 'Failed to stop worker', 'warning');
    }
  };

  const executePurge = async (worker: WorkerRecord, killFirst: boolean) => {
    try {
      const res = await window.sanctum.purgeColosseumWorker(worker.worker_id, killFirst);
      if (!res.success) {
        pushToast('Purge Failed', res.error || 'Could not purge worker', 'warning');
        return;
      }
      pushToast('Worker Purged', `Worker ${worker.worker_id} removed from registry.`, 'good');
      if (selectedWorker?.worker_id === worker.worker_id) {
        setSelectedWorker(null);
      }
      await refreshAll();
    } catch (err: any) {
      pushToast('Purge Error', err?.message || 'Failed to purge worker', 'warning');
    }
  };

  // Actions
  const handleRestart = (worker: WorkerRecord) => {
    setConfirmationState({
      isOpen: true,
      title: 'Restart Worker',
      description: `Restart worker "${worker.worker_id}"? The existing daemon will be stopped and a new worker daemon will be launched.`,
      confirmLabel: 'Restart Worker',
      variant: 'warning',
      onConfirm: () => executeRestart(worker),
    });
  };

  const handleStop = (worker: WorkerRecord) => {
    setConfirmationState({
      isOpen: true,
      title: 'Stop Worker',
      description: `Terminate worker daemon "${worker.worker_id}"? Any currently active stage will be stopped.`,
      confirmLabel: 'Stop Worker',
      variant: 'danger',
      onConfirm: () => executeStop(worker),
    });
  };

  const handlePurge = (worker: WorkerRecord, killFirst: boolean) => {
    setConfirmationState({
      isOpen: true,
      title: killFirst ? 'Kill & Purge Worker' : 'Delete / Purge Worker',
      description: killFirst
        ? `Force-kill worker "${worker.worker_id}" and delete all its records and logs permanently? [y/N]`
        : `Remove worker "${worker.worker_id}" and delete its log files? [y/N]`,
      confirmLabel: killFirst ? 'Kill & Purge' : 'Purge Worker',
      variant: 'danger',
      onConfirm: () => executePurge(worker, killFirst),
    });
  };

  // Fleet overview calculations
  const totalWorkers = workers.length;
  const runningWorkers = workers.filter((w) => w.status === 'running' || w.status === 'starting').length;
  const idleWorkers = workers.filter((w) => w.status === 'succeeded' || w.status === 'stopped').length;
  const failedWorkers = workers.filter((w) => w.status === 'failed').length;

  // Task breakdown
  const tasksByStatus = tasks.reduce((acc: Record<string, number>, t: any) => {
    const s = t.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // Runs completed / failed / blocked today
  const todayStr = new Date().toISOString().slice(0, 10);
  let runsCompletedToday = 0;
  let runsFailedToday = 0;
  let tasksBlockedToday = 0;

  for (const t of tasks) {
    if (t.status === 'blocked') tasksBlockedToday++;
    const runs = t.colosseum_config?.runs || [];
    for (const r of runs) {
      if (r.created_at && r.created_at.startsWith(todayStr)) {
        if (r.status === 'passed' || r.status === 'succeeded') runsCompletedToday++;
        if (r.status === 'failed') runsFailedToday++;
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-wide">Colosseum Fleet & System Statistics</h1>
            <p className="text-xs text-white/50">
              Live fleet telemetry • Refreshes every 5s • Last tick: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {/* Main content body */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Fleet Overview Cards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Fleet Overview</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
              <span className="text-xs text-white/50">Total Workers</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">{totalWorkers}</span>
                <span className="text-xs text-white/40">registered</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono mt-1 text-white/50">
                <span className="text-emerald-400">● {runningWorkers} active</span>
                <span>•</span>
                <span className="text-rose-400">▲ {failedWorkers} failed</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
              <span className="text-xs text-white/50">Runs Completed Today</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-400">{runsCompletedToday}</span>
                <span className="text-xs text-white/40">passed stages</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono mt-1 text-white/50">
                <span className="text-rose-400">{runsFailedToday} failed</span>
                <span>•</span>
                <span className="text-amber-400">{tasksBlockedToday} blocked cards</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
              <span className="text-xs text-white/50">Task Queue Status</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-cyan-400">{tasksByStatus['ready'] || 0}</span>
                <span className="text-xs text-white/40">ready to claim</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono mt-1 text-white/50 truncate">
                <span>{tasksByStatus['in-progress'] || 0} in-prog</span>
                <span>•</span>
                <span>{tasksByStatus['review'] || 0} review</span>
                <span>•</span>
                <span>{tasksByStatus['approved'] || 0} appr</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
              <span className="text-xs text-white/50">Host System Resources</span>
              {systemStats ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-cyan-300">{systemStats.cpuUsagePercent}%</span>
                    <span className="text-xs text-white/40">CPU</span>
                    <span className="text-lg font-bold font-mono text-white/80 ml-2">{systemStats.memoryUsagePercent}%</span>
                    <span className="text-xs text-white/40">RAM</span>
                  </div>
                  <div className="text-[11px] font-mono mt-1 text-white/50 truncate">
                    Load: {systemStats.loadAvg.join(', ')} • Up: {Math.floor(systemStats.uptimeSeconds / 3600)}h
                  </div>
                </>
              ) : (
                <div className="text-xs text-white/40 italic py-2">unavailable</div>
              )}
            </div>
          </div>
        </section>

        {/* Per-Worker Table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Worker Fleet Records ({workers.length})
            </h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 font-mono uppercase text-[10px] text-white/50">
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Worker ID</th>
                  <th className="py-2.5 px-4">Workspace</th>
                  <th className="py-2.5 px-4">PID</th>
                  <th className="py-2.5 px-4">Started At</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-white/40 italic">
                      No Colosseum workers in registry. Start one from the workspace header or CLI.
                    </td>
                  </tr>
                ) : (
                  workers.map((worker) => {
                    const isRunning = worker.status === 'running' || worker.status === 'starting';
                    return (
                      <tr
                        key={worker.worker_id}
                        onClick={() => setSelectedWorker(worker)}
                        className={`hover:bg-white/5 cursor-pointer transition-colors ${
                          selectedWorker?.worker_id === worker.worker_id ? 'bg-cyan-950/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${
                              worker.status === 'running'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : worker.status === 'starting'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                                : worker.status === 'failed'
                                ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                                : 'bg-white/5 text-white/40 border border-white/10'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`} />
                            {worker.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-white">{worker.worker_id}</td>
                        <td className="py-2.5 px-4 text-white/70">{worker.workspace_id || 'all-workspaces'}</td>
                        <td className="py-2.5 px-4 text-white/50">{worker.pid ? String(worker.pid) : '—'}</td>
                        <td className="py-2.5 px-4 text-white/50">
                          {worker.started_at ? new Date(worker.started_at).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openLogViewer(worker)}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px]"
                              title="Tail worker logs"
                            >
                              <Terminal size={12} />
                            </button>
                            {isRunning ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRestart(worker)}
                                  className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-[11px]"
                                  title="Restart worker safely"
                                >
                                  <RotateCcw size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStop(worker)}
                                  className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[11px]"
                                  title="Stop worker"
                                >
                                  Stop
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePurge(worker, true)}
                                  className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-600 text-rose-200 text-[11px]"
                                  title="Kill and purge worker"
                                >
                                  Kill+Purge
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePurge(worker, false)}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-rose-950/60 text-white/40 hover:text-rose-300 text-[11px]"
                                title="Delete worker record and logs"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pipeline Throughput Table */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
            Pipeline Throughput & Performance
          </h2>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            {Object.keys(registry.pipelines).length === 0 ? (
              <div className="text-xs text-white/40 italic text-center py-4">No pipelines defined.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {Object.values(registry.pipelines).map((pipeline) => {
                  return (
                    <div key={pipeline.id} className="p-3.5 rounded-lg bg-white/5 border border-white/10 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-xs">{pipeline.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                          {pipeline.agent_ids.length} stages
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/60">
                        {pipeline.agent_ids.map((id, idx) => {
                          const ag = registry.agents[id];
                          return (
                            <React.Fragment key={id}>
                              <span className="text-white/80">{ag?.name || id}</span>
                              {idx < pipeline.agent_ids.length - 1 && <span className="text-white/30">→</span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Log Viewer Modal */}
      {logModalWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-slate-950 border border-white/20 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            <header className="px-4 py-3 bg-slate-900 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-cyan-400" />
                <span className="text-white font-semibold">Worker Logs: {logModalWorker.worker_id}</span>
                <span className="text-[11px] text-white/40">({logModalWorker.log_path})</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFollowMode}
                    onChange={(e) => setIsFollowMode(e.target.checked)}
                    className="rounded bg-black/40 border-white/20 text-cyan-500"
                  />
                  <span>Follow Mode</span>
                </label>
                <button
                  type="button"
                  onClick={() => setLogModalWorker(null)}
                  className="text-white/40 hover:text-white p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            <div className="flex-1 p-4 overflow-y-auto bg-black/90 text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {logContent ? logContent : <span className="text-white/30 italic">Awaiting logs or empty file...</span>}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/15 rounded-xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle size={22} className="shrink-0" />
              <h3 className="text-sm font-semibold text-white">{confirmationState.title}</h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed font-sans">{confirmationState.description}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmationState((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmationState((prev) => ({ ...prev, isOpen: false }));
                  await confirmationState.onConfirm();
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold text-white ${
                  confirmationState.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {confirmationState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
