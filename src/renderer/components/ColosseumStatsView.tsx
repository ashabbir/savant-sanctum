import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Activity,
  Cpu,
  RefreshCw,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Terminal,
  Layers,
  Bot,
  Ban,
  FileText,
  ChevronRight,
  X,
  Search,
  ExternalLink,
  Flame,
  Zap,
} from 'lucide-react';
import type {
  WorkerRecord,
  ColosseumRegistry,
  SystemStats,
} from '../../../electron/colosseumStore';

export type ColosseumStatsViewProps = {
  pushToast: (title: string, detail: string, tone?: 'good' | 'warning' | 'muted') => void;
  serverUrl?: string;
  apiKey?: string;
  sessionList?: any[];
  onDeleteSession?: (sessionId: string) => Promise<void> | void;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSecs}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function calculateUptime(startedAt?: string | null, finishedAt?: string | null): string {
  if (!startedAt) return 'unavailable';
  const start = new Date(startedAt).getTime();
  if (isNaN(start)) return 'unavailable';
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const diffSec = Math.max(0, (end - start) / 1000);
  return formatDuration(diffSec);
}

export function ColosseumStatsView({
  pushToast,
  serverUrl = 'http://127.0.0.1:8090',
  apiKey,
  sessionList = [],
  onDeleteSession,
}: ColosseumStatsViewProps) {
  const [activeTab, setActiveTab] = useState<'fleet' | 'sessions'>('fleet');
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
  const [activeErrorIndex, setActiveErrorIndex] = useState<number>(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

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
      if (window.sanctum?.getColosseumWorkers) {
        const wList = await window.sanctum.getColosseumWorkers();
        setWorkers(wList);
      }

      if (window.sanctum?.getColosseumRegistry) {
        const reg = await window.sanctum.getColosseumRegistry();
        setRegistry(reg);
      }

      if (window.sanctum?.getSystemStats) {
        const stats = await window.sanctum.getSystemStats();
        setSystemStats(stats);
      }

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(`${serverUrl}/api/tasks`, { headers });
        const taskData = res.ok ? await res.json() : null;
        if (Array.isArray(taskData)) {
          setTasks(taskData);
        }
      } catch {
        // Server unreachable - keep existing tasks
      }

      setLastRefreshed(new Date());
    } catch {
      // ignore refresh errors
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

  // Keep selectedWorker reference updated with fresh data from worker list
  useEffect(() => {
    if (selectedWorker) {
      const fresh = workers.find((w) => w.worker_id === selectedWorker.worker_id);
      if (fresh) setSelectedWorker(fresh);
    }
  }, [workers]);

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
    setActiveErrorIndex(0);
  };

  // Find all error line indices in logContent
  const errorLines = useMemo(() => {
    if (!logContent) return [];
    const lines = logContent.split('\n');
    const indices: number[] = [];
    lines.forEach((line, idx) => {
      if (/\b(error|failed|fatal|exception|panicked)\b/i.test(line)) {
        indices.push(idx);
      }
    });
    return indices;
  }, [logContent]);

  const jumpToNextError = () => {
    if (errorLines.length === 0) return;
    setIsFollowMode(false);
    const nextIdx = (activeErrorIndex + 1) % errorLines.length;
    setActiveErrorIndex(nextIdx);

    const targetLine = errorLines[nextIdx];
    const el = document.getElementById(`log-line-${targetLine}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

  // Count active runs in worker workspace
  const getActiveRunsCount = useCallback(
    (workspaceId?: string | null) => {
      return tasks.filter((t) => {
        const matchesWs = !workspaceId || t.workspace_id === workspaceId;
        const isRunState = t.status === 'in-progress' || t.status === 'ready' || t.status === 'review';
        return matchesWs && isRunState;
      }).length;
    },
    [tasks]
  );

  // Actions with honest active-run counts in confirmations
  const handleRestart = (worker: WorkerRecord) => {
    const activeRuns = getActiveRunsCount(worker.workspace_id);
    const runInfo = activeRuns === 1 ? '1 active task execution' : `${activeRuns} active task executions`;
    setConfirmationState({
      isOpen: true,
      title: 'Restart Worker',
      description: `Restart worker "${worker.worker_id}"? The existing daemon will be stopped and a new worker daemon launched. Currently running: ${runInfo}.`,
      confirmLabel: 'Restart Worker',
      variant: 'warning',
      onConfirm: () => executeRestart(worker),
    });
  };

  const handleStop = (worker: WorkerRecord) => {
    const activeRuns = getActiveRunsCount(worker.workspace_id);
    const runInfo = activeRuns === 1 ? '1 active task execution' : `${activeRuns} active task executions`;
    setConfirmationState({
      isOpen: true,
      title: 'Stop Worker',
      description: `Terminate worker daemon "${worker.worker_id}"? Any currently active stage will be stopped. Currently running: ${runInfo}.`,
      confirmLabel: 'Stop Worker',
      variant: 'danger',
      onConfirm: () => executeStop(worker),
    });
  };

  const handlePurge = (worker: WorkerRecord, killFirst: boolean) => {
    const activeRuns = getActiveRunsCount(worker.workspace_id);
    const runInfo = activeRuns === 1 ? '1 active task run' : `${activeRuns} active task runs`;
    setConfirmationState({
      isOpen: true,
      title: killFirst ? 'Force-Kill & Purge Worker' : 'Delete / Purge Worker',
      description: killFirst
        ? `Force-kill worker "${worker.worker_id}" (PID ${worker.pid || '?'}) and delete its records? There are ${runInfo} in progress that will be terminated.`
        : `Remove worker "${worker.worker_id}" from registry and delete its log files?`,
      confirmLabel: killFirst ? 'Force-Kill & Purge' : 'Purge Worker',
      variant: 'danger',
      onConfirm: () => executePurge(worker, killFirst),
    });
  };

  const handleKillSession = (session: any) => {
    setConfirmationState({
      isOpen: true,
      title: 'Terminate Session',
      description: `Terminate session "${session.title || session.id}"? All unsaved context and session links will be removed.`,
      confirmLabel: 'Terminate Session',
      variant: 'danger',
      onConfirm: async () => {
        if (onDeleteSession) {
          await onDeleteSession(session.id);
        }
      },
    });
  };

  // Fleet overview calculations
  const totalWorkers = workers.length;
  const runningWorkers = workers.filter((w) => w.status === 'running' || w.status === 'starting').length;
  const failedWorkers = workers.filter((w) => w.status === 'failed').length;

  // Task & Run breakdown
  const tasksByStatus = useMemo(() => {
    return tasks.reduce((acc: Record<string, number>, t: any) => {
      const s = t.status || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
  }, [tasks]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const {
    totalRuns,
    passedRuns,
    failedRuns,
    runsCompletedToday,
    runsFailedToday,
    tasksBlockedToday,
    avgDurationFormatted,
    pipelineMetrics,
  } = useMemo(() => {
    let totRuns = 0;
    let passRuns = 0;
    let failRuns = 0;
    let passToday = 0;
    let failToday = 0;
    let blockedToday = 0;

    const durations: number[] = [];
    const pipeStats: Record<string, { runs: number; passed: number; durations: number[] }> = {};

    // Initialize pipeStats from registry
    for (const p of Object.values(registry.pipelines)) {
      pipeStats[p.id] = { runs: 0, passed: 0, durations: [] };
    }

    for (const t of tasks) {
      // Time-bound blocked today check
      if (t.status === 'blocked') {
        const updated = t.updatedAt || t.updated_at || t.createdAt || t.created_at;
        if (!updated || updated.startsWith(todayStr)) {
          blockedToday++;
        }
      }

      const runs = t.colosseum_config?.runs || t.colosseumConfig?.runs || [];
      const taskPipelineId =
        t.colosseum_config?.pipeline ||
        t.colosseumConfig?.pipeline ||
        t.colosseum_config?.pipeline_id ||
        t.colosseumConfig?.pipeline_id;

      for (const r of runs) {
        totRuns++;
        const isPassed = r.status === 'passed' || r.status === 'succeeded';
        const isFailed = r.status === 'failed' || r.status === 'rejected';

        if (isPassed) passRuns++;
        if (isFailed) failRuns++;

        const runDate = r.created_at || r.started_at;
        if (runDate && runDate.startsWith(todayStr)) {
          if (isPassed) passToday++;
          if (isFailed) failToday++;
        }

        const start = r.started_at || r.created_at;
        const finish = r.finished_at || r.completed_at;
        let durationSec: number | null = null;
        if (start && finish) {
          const diff = (new Date(finish).getTime() - new Date(start).getTime()) / 1000;
          if (diff >= 0 && !isNaN(diff)) {
            durationSec = diff;
            durations.push(diff);
          }
        }

        // Aggregate by pipeline
        const pipeKey = r.pipeline_id || r.pipeline || taskPipelineId;
        if (pipeKey && pipeStats[pipeKey]) {
          pipeStats[pipeKey].runs++;
          if (isPassed) pipeStats[pipeKey].passed++;
          if (durationSec !== null) pipeStats[pipeKey].durations.push(durationSec);
        }
      }
    }

    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    return {
      totalRuns: totRuns,
      passedRuns: passRuns,
      failedRuns: failRuns,
      runsCompletedToday: passToday,
      runsFailedToday: failToday,
      tasksBlockedToday: blockedToday,
      avgDurationFormatted: avgDuration !== null ? formatDuration(avgDuration) : 'unavailable',
      pipelineMetrics: pipeStats,
    };
  }, [tasks, registry, todayStr]);

  const overallSuccessRate =
    totalRuns > 0 ? `${((passedRuns / totalRuns) * 100).toFixed(1)}%` : 'unavailable';

  // Per-worker helper
  const getWorkerTelemetry = useCallback(
    (worker: WorkerRecord) => {
      // Find active task
      const activeTask = tasks.find((t) => {
        const matchesWs = !worker.workspace_id || t.workspace_id === worker.workspace_id;
        const matchesWorker = t.colosseum_config?.worker_id === worker.worker_id;
        const isRunningStatus = t.status === 'in-progress' || t.status === 'review';
        return matchesWorker || (matchesWs && isRunningStatus);
      });

      // Pipeline determination
      let boundPipelineName = 'unavailable';
      const pipeId =
        activeTask?.colosseum_config?.pipeline ||
        activeTask?.colosseumConfig?.pipeline ||
        Object.keys(registry.pipelines)[0];
      if (pipeId && registry.pipelines[pipeId]) {
        boundPipelineName = registry.pipelines[pipeId].name;
      }

      // Current task & stage
      let currentTaskStage = '—';
      if (worker.status === 'running' || worker.status === 'starting') {
        if (activeTask) {
          const stageName = activeTask.colosseum_config?.stage || activeTask.status;
          currentTaskStage = `#${activeTask.id || activeTask.task_id || 'task'}: ${stageName}`;
        } else {
          currentTaskStage = 'idle';
        }
      }

      // Heartbeat age
      let heartbeatAge = 'unavailable';
      if (worker.status === 'running' || worker.status === 'starting') {
        if (logMtime > 0 && logModalWorker?.worker_id === worker.worker_id) {
          const ageSec = Math.max(0, Math.round((Date.now() - logMtime) / 1000));
          heartbeatAge = `${ageSec}s ago`;
        } else if (worker.started_at) {
          const ageSec = Math.max(0, Math.round((Date.now() - new Date(worker.started_at).getTime()) / 1000));
          heartbeatAge = ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)}m ago`;
        }
      }

      // Provider and Model
      let providerModel = 'unavailable';
      if (activeTask?.colosseum_config?.provider) {
        const prov = activeTask.colosseum_config.provider;
        const mod = activeTask.colosseum_config.model || 'default';
        providerModel = `${prov} / ${mod}`;
      } else if (pipeId && registry.pipelines[pipeId]) {
        const firstAgentId = registry.pipelines[pipeId].agent_ids[0];
        const agent = registry.agents[firstAgentId];
        if (agent?.provider && agent?.model) {
          providerModel = `${agent.provider} / ${agent.model}`;
        }
      }

      return {
        activeTask,
        boundPipelineName,
        currentTaskStage,
        heartbeatAge,
        providerModel,
        uptime: calculateUptime(worker.started_at, worker.finished_at),
      };
    },
    [tasks, registry, logMtime, logModalWorker]
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity size={18} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-white tracking-wide">Colosseum Fleet & Telemetry</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Active Sessions: {sessionList.length}
              </span>
            </div>
            <p className="text-xs text-white/50">
              Live fleet telemetry • Refreshes every 5s • Last tick: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs mr-2">
            <button
              type="button"
              onClick={() => setActiveTab('fleet')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'fleet' ? 'bg-cyan-600 text-white shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Fleet & Throughput
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'sessions' ? 'bg-cyan-600 text-white shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Sessions ({sessionList.length})
            </button>
          </div>

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
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {activeTab === 'sessions' ? (
            /* Sessions Management View */
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Active Agentic Sessions ({sessionList.length})
                  </h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    View active Athena, Hermes, Codex, and external agent sessions. Terminate idle or failed sessions safely.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 font-mono uppercase text-[10px] text-white/50">
                      <th className="py-2.5 px-4">Provider</th>
                      <th className="py-2.5 px-4">Session Title</th>
                      <th className="py-2.5 px-4">Session ID</th>
                      <th className="py-2.5 px-4">Workspace</th>
                      <th className="py-2.5 px-4">Messages</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {sessionList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-white/40 italic">
                          No active sessions found. Start a conversation in the Athena rail or link an external session.
                        </td>
                      </tr>
                    ) : (
                      sessionList.map((session) => {
                        const provider = session.provider || 'savant';
                        const msgCount = Array.isArray(session.messages) ? session.messages.length : '—';
                        return (
                          <tr key={session.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/30">
                                <Bot size={11} /> {provider}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-white truncate max-w-xs">
                              {session.title || 'Untitled Session'}
                            </td>
                            <td className="py-2.5 px-4 text-white/50 text-[11px] truncate max-w-[140px]">
                              {session.id}
                            </td>
                            <td className="py-2.5 px-4 text-white/70">
                              {session.workspaceId || 'global'}
                            </td>
                            <td className="py-2.5 px-4 text-white/50">{msgCount}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleKillSession(session)}
                                className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 hover:text-white text-[11px] font-sans font-medium transition-colors"
                                title="Terminate and delete session"
                              >
                                Kill Session
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            /* Fleet Overview & Throughput View */
            <>
              {/* Fleet Overview Cards */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
                  Telemetry & Fleet Overview
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  {/* Card 1: Workers */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
                    <span className="text-xs text-white/50">Worker Fleet</span>
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

                  {/* Card 2: Real Pipeline Throughput */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
                    <span className="text-xs text-white/50">Pipeline Throughput</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-emerald-400">{overallSuccessRate}</span>
                      <span className="text-xs text-white/40">success rate</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono mt-1 text-white/50">
                      <span>{totalRuns} total runs</span>
                      <span>•</span>
                      <span>Avg: {avgDurationFormatted}</span>
                    </div>
                  </div>

                  {/* Card 3: Today's Time-Bound Execution */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
                    <span className="text-xs text-white/50">Runs Completed Today</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-cyan-300">{runsCompletedToday}</span>
                      <span className="text-xs text-white/40">passed stages</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono mt-1 text-white/50">
                      <span className="text-rose-400">{runsFailedToday} failed today</span>
                      <span>•</span>
                      <span className="text-amber-400">{tasksBlockedToday} blocked today</span>
                    </div>
                  </div>

                  {/* Card 4: Host System */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1">
                    <span className="text-xs text-white/50">Host System Resources</span>
                    {systemStats ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-cyan-300">
                            {systemStats.cpuUsagePercent}%
                          </span>
                          <span className="text-xs text-white/40">CPU</span>
                          <span className="text-lg font-bold font-mono text-white/80 ml-2">
                            {systemStats.memoryUsagePercent}%
                          </span>
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
                    Worker Fleet Detail ({workers.length})
                  </h2>
                  <span className="text-[11px] text-white/40">Click row to open detailed inspector drawer</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 font-mono uppercase text-[10px] text-white/50">
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Worker ID</th>
                        <th className="py-2.5 px-3">Workspace</th>
                        <th className="py-2.5 px-3">PID</th>
                        <th className="py-2.5 px-3">Bound Pipeline</th>
                        <th className="py-2.5 px-3">Current Task / Stage</th>
                        <th className="py-2.5 px-3">Uptime</th>
                        <th className="py-2.5 px-3">Heartbeat</th>
                        <th className="py-2.5 px-3">Provider / Model</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {workers.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-white/40 italic">
                            No Colosseum workers in registry. Start one from the workspace header or CLI.
                          </td>
                        </tr>
                      ) : (
                        workers.map((worker) => {
                          const isRunning = worker.status === 'running' || worker.status === 'starting';
                          const telemetry = getWorkerTelemetry(worker);
                          const isSelected = selectedWorker?.worker_id === worker.worker_id;

                          return (
                            <tr
                              key={worker.worker_id}
                              onClick={() => setSelectedWorker(worker)}
                              className={`hover:bg-white/5 cursor-pointer transition-colors ${
                                isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3">
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
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-current'
                                    }`}
                                  />
                                  {worker.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[120px]">
                                {worker.worker_id}
                              </td>
                              <td className="py-2.5 px-3 text-white/70 truncate max-w-[110px]">
                                {worker.workspace_id || 'all'}
                              </td>
                              <td className="py-2.5 px-3 text-white/50">{worker.pid ? String(worker.pid) : '—'}</td>
                              <td className="py-2.5 px-3 text-cyan-300 font-sans truncate max-w-[120px]">
                                {telemetry.boundPipelineName}
                              </td>
                              <td className="py-2.5 px-3 text-white/80 truncate max-w-[140px]">
                                {telemetry.currentTaskStage}
                              </td>
                              <td className="py-2.5 px-3 text-white/50">{telemetry.uptime}</td>
                              <td className="py-2.5 px-3 text-white/50">{telemetry.heartbeatAge}</td>
                              <td className="py-2.5 px-3 text-white/60 truncate max-w-[130px]">
                                {telemetry.providerModel}
                              </td>
                              <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                        title="Force-kill worker and purge registry"
                                      >
                                        Kill
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
                        const stats = pipelineMetrics[pipeline.id] || { runs: 0, passed: 0, durations: [] };
                        const successRate =
                          stats.runs > 0 ? `${((stats.passed / stats.runs) * 100).toFixed(1)}%` : 'unavailable';
                        const avgPipeDuration =
                          stats.durations.length > 0
                            ? formatDuration(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
                            : 'unavailable';

                        return (
                          <div
                            key={pipeline.id}
                            className="p-3.5 rounded-lg bg-white/5 border border-white/10 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white text-xs">{pipeline.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                                {pipeline.agent_ids.length} stages
                              </span>
                            </div>

                            {/* Throughput stats */}
                            <div className="flex items-center gap-4 text-xs font-mono py-1 border-y border-white/5 text-white/70">
                              <div>
                                <span className="text-[10px] uppercase text-white/40 block">Runs</span>
                                <span className="font-bold text-white">{stats.runs}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-white/40 block">Success Rate</span>
                                <span className="font-bold text-emerald-400">{successRate}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-white/40 block">Avg Duration</span>
                                <span className="font-bold text-cyan-300">{avgPipeDuration}</span>
                              </div>
                            </div>

                            {/* Stages sequence */}
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/60 overflow-x-auto">
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
            </>
          )}
        </div>

        {/* Worker Detail Drawer */}
        {selectedWorker && (
          <aside className="w-80 border-l border-white/10 bg-slate-900/90 backdrop-blur flex flex-col h-full overflow-hidden">
            <header className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-cyan-400" />
                <h3 className="text-xs font-bold font-mono text-white truncate max-w-[200px]">
                  {selectedWorker.worker_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="text-white/40 hover:text-white p-1 rounded"
              >
                <X size={15} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs font-sans">
              {/* Status & PID */}
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-[11px] uppercase font-mono">Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-semibold ${
                    selectedWorker.status === 'running'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                      : selectedWorker.status === 'starting'
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                      : selectedWorker.status === 'failed'
                      ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {selectedWorker.status}
                </span>
              </div>

              <div>
                <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">Process PID</span>
                <span className="font-mono text-white/90">{selectedWorker.pid || 'None (Finished)'}</span>
                {selectedWorker.process_identity && (
                  <p className="text-[10px] font-mono text-white/40 truncate mt-0.5">
                    ID: {selectedWorker.process_identity}
                  </p>
                )}
              </div>

              <div>
                <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">Workspace Scope</span>
                <span className="font-mono text-white/90">{selectedWorker.workspace_id || 'All Workspaces'}</span>
              </div>

              {/* Telemetry info */}
              {(() => {
                const tel = getWorkerTelemetry(selectedWorker);
                return (
                  <>
                    <div>
                      <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">
                        Bound Pipeline
                      </span>
                      <span className="font-mono text-cyan-300">{tel.boundPipelineName}</span>
                    </div>

                    <div>
                      <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">
                        Current Execution
                      </span>
                      <span className="font-mono text-white/90">{tel.currentTaskStage}</span>
                    </div>

                    <div>
                      <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">Provider & Model</span>
                      <span className="font-mono text-white/70">{tel.providerModel}</span>
                    </div>

                    <div>
                      <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">Uptime</span>
                      <span className="font-mono text-white/70">{tel.uptime}</span>
                    </div>

                    <div>
                      <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">Heartbeat Age</span>
                      <span className="font-mono text-white/70">{tel.heartbeatAge}</span>
                    </div>
                  </>
                );
              })()}

              <div>
                <span className="text-white/50 text-[11px] uppercase font-mono block mb-1">Log Location</span>
                <p className="font-mono text-[10px] text-white/40 break-all bg-black/40 p-2 rounded border border-white/5">
                  {selectedWorker.log_path}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openLogViewer(selectedWorker)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
                >
                  <Terminal size={13} /> View Live Logs
                </button>

                {selectedWorker.status === 'running' || selectedWorker.status === 'starting' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRestart(selectedWorker)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                    >
                      <RotateCcw size={13} /> Restart Worker
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStop(selectedWorker)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
                    >
                      <Ban size={13} /> Stop Worker
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge(selectedWorker, true)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-rose-950 hover:bg-rose-900 border border-rose-600 text-rose-200 text-xs font-medium transition-colors"
                    >
                      <Trash2 size={13} /> Force-Kill & Purge
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePurge(selectedWorker, false)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-white/5 hover:bg-rose-950 text-white/50 hover:text-rose-300 border border-white/10 text-xs font-medium transition-colors"
                  >
                    <Trash2 size={13} /> Delete Worker Record
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Log Viewer Modal with Jump to Error */}
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
                {/* Jump to Error Button */}
                {errorLines.length > 0 && (
                  <button
                    type="button"
                    onClick={jumpToNextError}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-sans font-medium transition-colors"
                    title="Jump to next error line in logs"
                  >
                    <AlertTriangle size={12} className="text-rose-400" />
                    Jump to Error ({activeErrorIndex + 1}/{errorLines.length})
                  </button>
                )}

                <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer font-sans">
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

            <div
              ref={logContainerRef}
              className="flex-1 p-4 overflow-y-auto bg-black/90 text-emerald-300 whitespace-pre-wrap leading-relaxed select-text"
            >
              {logContent ? (
                logContent.split('\n').map((line, idx) => {
                  const isError = /\b(error|failed|fatal|exception|panicked)\b/i.test(line);
                  return (
                    <div
                      key={idx}
                      id={`log-line-${idx}`}
                      className={`${
                        isError ? 'bg-rose-950/50 text-rose-300 px-1 rounded' : ''
                      } hover:bg-white/5`}
                    >
                      {line}
                    </div>
                  );
                })
              ) : (
                <span className="text-white/30 italic">Awaiting logs or empty file...</span>
              )}
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
