import type { Task } from '../data';

export type TaskFlagState = {
  done?: boolean;
  blocked?: boolean;
  lastMovedAt?: string;
  lastMovedFrom?: string;
  lastMovedTo?: string;
};

export const isTaskBlocked = (task: Task, taskFlags: Record<string, TaskFlagState>): boolean => {
  return task.status === 'blocked' || Boolean(taskFlags[task.id]?.blocked);
};

export const getTaskBlockReason = (task: Task): string | null => {
  if (!task.comments || task.comments.length === 0) return null;
  const colosseumComments = task.comments.filter(c => {
    if (typeof c === 'string') return false;
    return c.author === 'Colosseum';
  });
  if (colosseumComments.length === 0) return null;
  const latest = colosseumComments[colosseumComments.length - 1];
  if (typeof latest === 'string') return null;
  const text = latest.text;
  const reasonMarker = '**Reason**';
  const reasonIndex = text.indexOf(reasonMarker);
  if (reasonIndex !== -1) {
    return text.substring(reasonIndex + reasonMarker.length).trim();
  }
  return text;
};

export const taskWorkflowState = (
  task: Task,
  taskFlags: Record<string, TaskFlagState>,
): Task['state'] => {
  return task.state;
};

export const taskBoardState = (
  task: Task,
  taskFlags: Record<string, TaskFlagState>,
): Task['state'] => {
  if (taskFlags[task.id]?.done) return 'done';
  return task.state;
};

export const canMoveTask = (
  task: Task,
  targetState: Task['state'],
  taskFlags: Record<string, TaskFlagState>,
): boolean => {
  if (!isTaskBlocked(task, taskFlags)) return true;
  return targetState === task.state;
};

export const COLOSSEUM_PHASES: Task['state'][] = [
  'backlog',
  'grooming',
  'ready',
  'in-progress',
  'review',
  'human-review',
  'approved',
  'done',
];

export const canSubmitForGrooming = (task: Task): boolean => {
  if (task.state !== 'backlog' && task.state !== 'grooming') return false;
  if (task.colosseumConfig?.work_type !== 'development') return true;
  return Boolean(task.colosseumConfig.repository?.trim());
};

export const isAwaitingHumanReview = (task: Task): boolean => task.state === 'human-review';
