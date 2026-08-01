import { Activity, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ColosseumHeartbeat, ColosseumRun, Task } from '../data';
import { COLOSSEUM_PHASES } from '../lib/taskBoard';

export function ColosseumPhaseLedger({ state }: { state: Task['state'] }) {
  const currentIndex = COLOSSEUM_PHASES.indexOf(state);
  return (
    <div className="colosseum-phase-ledger" aria-label="Colosseum lifecycle">
      {COLOSSEUM_PHASES.map((phase, index) => {
        const phaseState = index < currentIndex ? 'complete' : index === currentIndex ? 'active' : 'pending';
        return (
          <div key={phase} className={`colosseum-phase colosseum-phase-${phaseState}`}>
            <span>{index + 1}</span>
            <strong>{phase.replace('-', ' ')}</strong>
          </div>
        );
      })}
    </div>
  );
}

function RunCard({ run }: { run: ColosseumRun }) {
  return (
    <article className="colosseum-run-card">
      <header>
        <span className={`colosseum-run-phase colosseum-run-phase-${run.phase}`}>{run.phase}</span>
        <strong>{run.status}</strong>
        <time>{run.created_at ? new Date(run.created_at).toLocaleString() : 'time unavailable'}</time>
      </header>
      {run.summary && <p>{run.summary}</p>}
      {run.rationale && (
        <div className="colosseum-run-rationale"><strong>Why</strong><span>{run.rationale}</span></div>
      )}
      {(run.questions ?? []).length > 0 && (
        <div className="colosseum-run-rationale">
          <strong>Questions</strong><span>{run.questions?.join('\n')}</span>
        </div>
      )}
      <footer>
        {run.persona && <span>persona {run.persona.replace('persona.', '')}</span>}
        {run.provider && <span>provider {run.provider}</span>}
        {run.model && <span>model {run.model}</span>}
        {run.branch && <span>branch {run.branch}</span>}
        {run.commit && <span>commit {run.commit.slice(0, 10)}</span>}
        {run.mr_id && <span>MR {run.mr_id}</span>}
        {run.log_path && <span title={run.log_path}>log available</span>}
      </footer>
    </article>
  );
}

export const COLOSSEUM_HEARTBEAT_QUIET_AFTER_MS = 30_000;
export const COLOSSEUM_HEARTBEAT_STALE_AFTER_MS = 45_000;

export function classifyColosseumHeartbeat(heartbeatAt: string, now = Date.now()) {
  const heartbeatTime = Date.parse(heartbeatAt);
  const ageMs = Number.isFinite(heartbeatTime) ? Math.max(0, now - heartbeatTime) : Number.POSITIVE_INFINITY;
  if (ageMs > COLOSSEUM_HEARTBEAT_STALE_AFTER_MS) return { state: 'stale' as const, ageMs };
  if (ageMs > COLOSSEUM_HEARTBEAT_QUIET_AFTER_MS) return { state: 'quiet' as const, ageMs };
  return { state: 'live' as const, ageMs };
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return 'unknown';
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s ago`;
}

export function ColosseumLivePulse({ heartbeat, now }: { heartbeat: ColosseumHeartbeat; now?: number }) {
  const [clock, setClock] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) return undefined;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [now]);

  const signal = classifyColosseumHeartbeat(heartbeat.heartbeat_at, now ?? clock);
  const signalLabel = signal.state === 'live' ? 'Running' : signal.state === 'quiet' ? 'Quiet' : 'Signal stale';
  const persona = heartbeat.persona?.replace('persona.', '') ?? 'agent';
  const startedAt = Date.parse(heartbeat.started_at);

  return (
    <section className={`colosseum-live-pulse colosseum-live-pulse-${signal.state}`} aria-label={`Colosseum ${signalLabel.toLowerCase()}`}>
      <div className="colosseum-live-pulse-signal" aria-hidden="true"><Activity size={14} /><span /></div>
      <div className="colosseum-live-pulse-copy">
        <div><strong>{signalLabel}</strong><span>{heartbeat.phase}</span><span>{persona}</span></div>
        <p>{heartbeat.message}</p>
      </div>
      <div className="colosseum-live-pulse-time">
        <strong>{Number.isFinite(startedAt) ? formatDuration((now ?? clock) - startedAt).replace(' ago', '') : 'unknown'}</strong>
        <span>last signal {formatDuration(signal.ageMs)}</span>
      </div>
    </section>
  );
}

export function ColosseumRunLedger({ runs }: { runs: ColosseumRun[] }) {
  return (
    <div className="colosseum-run-ledger">
      <div className="colosseum-run-ledger-head">
        <div><span>Execution evidence</span><strong>{runs.length} recorded runs</strong></div>
        <small>Every grooming, work, review, and merge decision remains attached to this ticket.</small>
      </div>
      <div className="colosseum-run-list">
        {runs.length === 0 ? (
          <div className="colosseum-run-empty">
            <History size={24} /><strong>No Colosseum runs yet</strong>
            <span>Send this ticket to grooming to begin the execution record.</span>
          </div>
        ) : [...runs].reverse().map((run) => <RunCard key={run.run_id} run={run} />)}
      </div>
    </div>
  );
}
