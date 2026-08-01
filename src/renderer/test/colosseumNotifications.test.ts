import { describe, expect, it } from 'vitest';
import type { Task } from '../data';
import { collectColosseumResponseNotifications, colosseumResponseSignal } from '../lib/colosseumNotifications';

const task: Task = {
  id: 'task-1',
  workspaceId: 'ws-1',
  title: 'Ship heartbeat',
  priority: 'high',
  state: 'in-progress',
  owner: 'ahmed',
};

describe('Colosseum toast signals', () => {
  it('does not change its signature for routine heartbeat sequences', () => {
    const active = {
      run_id: 'run-1',
      phase: 'work' as const,
      status: 'running' as const,
      started_at: '2026-08-01T20:00:00Z',
      heartbeat_at: '2026-08-01T20:00:15Z',
      message: 'Coder is working.',
      sequence: 1,
    };
    const first = colosseumResponseSignal({ ...task, colosseumConfig: { active_run: active } });
    const second = colosseumResponseSignal({
      ...task,
      colosseumConfig: { active_run: { ...active, heartbeat_at: '2026-08-01T20:00:30Z', sequence: 2 } },
    });
    expect(first?.signature).toBe(second?.signature);
  });

  it('creates a new signal when Colosseum changes milestone', () => {
    const signal = colosseumResponseSignal({
      ...task,
      colosseumConfig: { active_run: {
        run_id: 'run-1', phase: 'work', status: 'validating',
        started_at: '2026-08-01T20:00:00Z', heartbeat_at: '2026-08-01T20:01:00Z',
        message: 'Agent finished; running independent validation checks.',
      } },
    });
    expect(signal?.title).toBe('Colosseum update');
    expect(signal?.detail).toContain('running independent validation');
  });

  it('toasts a durable completed response', () => {
    const signal = colosseumResponseSignal({
      ...task,
      colosseumConfig: { runs: [{
        run_id: 'run-1', phase: 'review', status: 'passed', summary: 'Review passed.',
      }] },
    });
    expect(signal).toMatchObject({ title: 'Colosseum responded', tone: 'good' });
  });

  it('seeds silently then emits only a changed response', () => {
    const firstTask = { ...task, colosseumConfig: { runs: [{ run_id: 'run-1', phase: 'work' as const, status: 'passed' }] } };
    const initial = collectColosseumResponseNotifications([firstTask], new Map(), false);
    expect(initial.notifications).toEqual([]);

    const unchanged = collectColosseumResponseNotifications([firstTask], initial.signatures, true);
    expect(unchanged.notifications).toEqual([]);

    const changedTask = { ...task, colosseumConfig: { runs: [
      ...firstTask.colosseumConfig.runs,
      { run_id: 'run-2', phase: 'review' as const, status: 'passed', summary: 'Review passed.' },
    ] } };
    const changed = collectColosseumResponseNotifications([changedTask], unchanged.signatures, true);
    expect(changed.notifications).toHaveLength(1);
    expect(changed.notifications[0].detail).toContain('Review passed.');
  });
});
