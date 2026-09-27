import React, { useEffect, useState, useCallback } from 'react';
import { Play, Square, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import type { WorkerRecord, ColosseumRegistry } from '../../../electron/colosseumStore';

export function getWorkspaceBoundPipelineId(workspaceId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`savant.colosseum.pipeline.${workspaceId}`);
}

export function setWorkspaceBoundPipelineId(workspaceId: string, pipelineId: string | null): void {
  if (typeof window === 'undefined') return;
  const key = `savant.colosseum.pipeline.${workspaceId}`;
  if (pipelineId) {
    localStorage.setItem(key, pipelineId);
  } else {
    localStorage.removeItem(key);
  }
}

type ColosseumWorkerControlsProps = {
  workspaceId?: string;
  pushToast: (title: string, detail: string, tone?: 'good' | 'warning' | 'muted') => void;
  onNavigateToPipelines?: () => void;
};

export function ColosseumWorkerControls({
  workspaceId,
  pushToast,
  onNavigateToPipelines,
}: ColosseumWorkerControlsProps) {
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [registry, setRegistry] = useState<ColosseumRegistry>({ agents: {}, pipelines: {} });
  const [boundPipelineId, setBoundPipelineId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [stoppingWorker, setStoppingWorker] = useState<WorkerRecord | null>(null);
  const [activeRunCount, setActiveRunCount] = useState<number>(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Hydrate bound pipeline for current workspace
  useEffect(() => {
    if (workspaceId) {
      setBoundPipelineId(getWorkspaceBoundPipelineId(workspaceId));
    } else {
      setBoundPipelineId(null);
    }
  }, [workspaceId]);

  // Load registry for pipeline names
  const loadRegistry = useCallback(async () => {
    try {
      if (window.sanctum?.getColosseumRegistry) {
        const reg = await window.sanctum.getColosseumRegistry();
        setRegistry(reg);
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll workers
  const refreshWorkers = useCallback(async () => {
    try {
      if (window.sanctum?.getColosseumWorkers) {
        const list = await window.sanctum.getColosseumWorkers();
        setWorkers(list);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadRegistry();
    void refreshWorkers();

    const interval = setInterval(refreshWorkers, 5000);
    const handleFocus = () => {
      void refreshWorkers();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadRegistry, refreshWorkers]);

  // Find active worker for this workspace (or any worker if workspaceId is not specified)
  const activeWorker = workers.find((w) =>
    (!workspaceId || w.workspace_id === workspaceId) &&
    (w.status === 'running' || w.status === 'starting')
  );

  const isRunning = Boolean(activeWorker);

  const handleStart = async () => {
    setIsBusy(true);
    try {
      if (!window.sanctum?.startColosseumWorker) {
        pushToast('Error', 'Colosseum IPC not available', 'warning');
        return;
      }
      const res = await window.sanctum.startColosseumWorker(workspaceId);
      if (res.success) {
        pushToast('Worker Started', `Colosseum daemon launched${res.workerId ? ` (${res.workerId})` : ''}.`, 'good');
        await refreshWorkers();
      } else {
        pushToast('Launch Failed', res.error || 'Could not start worker', 'warning');
      }
    } catch (err: any) {
      pushToast('Start Error', err?.message || 'Could not start worker daemon', 'warning');
    } finally {
      setIsBusy(false);
    }
  };

  const initiateStop = (worker: WorkerRecord) => {
    // Check if there are active runs or tasks
    // If worker has runs in log or active, show confirmation
    setStoppingWorker(worker);
    // Active run count could be estimated or fetched; default to 0 or 1 if active
    setActiveRunCount(1);
    setIsConfirmModalOpen(true);
  };

  const confirmStop = async () => {
    if (!stoppingWorker) return;
    setIsBusy(true);
    setIsConfirmModalOpen(false);
    try {
      const res = await window.sanctum.stopColosseumWorker(stoppingWorker.worker_id);
      if (res.success) {
        pushToast('Worker Stopped', `Worker ${stoppingWorker.worker_id} terminated.`, 'good');
        await refreshWorkers();
      } else {
        pushToast('Stop Failed', res.error || 'Could not stop worker', 'warning');
      }
    } catch (err: any) {
      pushToast('Stop Error', err?.message || 'Could not stop worker', 'warning');
    } finally {
      setStoppingWorker(null);
      setIsBusy(false);
    }
  };

  const boundPipelineName = boundPipelineId && registry.pipelines[boundPipelineId]
    ? registry.pipelines[boundPipelineId].name
    : null;

  return (
    <div className="flex items-center gap-2">
      {/* Bound pipeline indicator */}
      {workspaceId && (
        <div
          onClick={onNavigateToPipelines}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white cursor-pointer transition-colors"
          title="Click to view or edit pipelines"
        >
          <Layers size={12} className="text-cyan-400" />
          <span className="font-mono text-[11px]">
            {boundPipelineName ? `Pipeline: ${boundPipelineName}` : 'No pipeline attached'}
          </span>
        </div>
      )}

      {/* Status Pill (●/○) */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors ${
          isRunning
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
            : 'bg-white/5 border-white/10 text-white/40'
        }`}
        title={isRunning ? `Worker running: ${activeWorker?.worker_id}` : 'No active Colosseum worker'}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
        <span>{isRunning ? 'Worker: Running' : 'Worker: Stopped'}</span>
      </div>

      {/* Start / Stop daemon button */}
      {isRunning ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => activeWorker && initiateStop(activeWorker)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors disabled:opacity-50"
          title="Stop Colosseum daemon"
        >
          <Square size={11} className="fill-current" />
          <span>Stop</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={isBusy}
          onClick={handleStart}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors disabled:opacity-50"
          title="Start Colosseum worker daemon"
        >
          <Play size={11} className="fill-current" />
          <span>Start worker</span>
        </button>
      )}

      {/* Confirmation Modal for stopping worker */}
      {isConfirmModalOpen && stoppingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/15 rounded-xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle size={22} className="shrink-0" />
              <h3 className="text-sm font-semibold text-white">Confirm Stop Worker</h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Worker <span className="font-mono text-cyan-300">{stoppingWorker.worker_id}</span> is currently running
              {activeRunCount > 0 ? ` and may have ${activeRunCount} active run in progress` : ''}.
              Stopping it will interrupt any unfinished pipeline stage.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStop}
                className="px-3 py-1.5 rounded text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500"
              >
                Stop Worker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
