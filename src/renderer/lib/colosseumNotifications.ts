import type { Task } from '../data';

export type ColosseumResponseSignal = {
  signature: string;
  title: string;
  detail: string;
  tone: 'muted' | 'good' | 'warning';
};

export type ColosseumNotificationBatch = {
  signatures: Map<string, string>;
  notifications: ColosseumResponseSignal[];
};

export function colosseumResponseSignal(task: Task): ColosseumResponseSignal | null {
  const active = task.colosseumConfig?.active_run;
  if (active) {
    const failed = active.status === 'failed';
    const progressed = active.status === 'validating' || active.status === 'publishing';
    return {
      signature: `active:${active.run_id}:${active.status}:${active.message}`,
      title: failed ? 'Colosseum needs attention' : progressed ? 'Colosseum update' : 'Colosseum is active',
      detail: `${task.title}: ${active.message}`,
      tone: failed ? 'warning' : 'muted',
    };
  }

  const runs = task.colosseumConfig?.runs ?? [];
  const latest = runs[runs.length - 1];
  if (!latest) return null;
  const failed = latest.status === 'failed' || latest.status === 'needs-input';
  return {
    signature: `run:${latest.run_id}:${latest.status}`,
    title: failed ? 'Colosseum needs attention' : 'Colosseum responded',
    detail: `${task.title}: ${latest.summary ?? `${latest.phase} ${latest.status}`}`,
    tone: failed ? 'warning' : 'good',
  };
}

export function collectColosseumResponseNotifications(
  tasks: Task[],
  previous: ReadonlyMap<string, string>,
  notify: boolean,
): ColosseumNotificationBatch {
  const signatures = new Map<string, string>();
  const notifications: ColosseumResponseSignal[] = [];
  tasks.forEach((task) => {
    const signal = colosseumResponseSignal(task);
    if (!signal) return;
    signatures.set(task.id, signal.signature);
    if (notify && previous.get(task.id) !== signal.signature) notifications.push(signal);
  });
  return { signatures, notifications };
}
