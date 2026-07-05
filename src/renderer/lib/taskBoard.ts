import type { Task } from '../data';

export type TaskFlagState = {
  done?: boolean;
  blocked?: boolean;
  lastMovedAt?: string;
  lastMovedFrom?: string;
  lastMovedTo?: string;
};

export const isTaskBlocked = (task: Task, taskFlags: Record<string, TaskFlagState>): boolean => {
  return Boolean(taskFlags[task.id]?.blocked || task.state === 'blocked');
};

export const taskWorkflowState = (
  task: Task,
  taskFlags: Record<string, TaskFlagState>,
): Exclude<Task['state'], 'blocked'> => {
  if (task.state !== 'blocked') return task.state;
  const fallbackState = taskFlags[task.id]?.lastMovedFrom;
  return fallbackState === 'todo' || fallbackState === 'in-progress' || fallbackState === 'review'
    ? fallbackState
    : 'todo';
};

export const taskBoardState = (
  task: Task,
  taskFlags: Record<string, TaskFlagState>,
): Exclude<Task['state'], 'blocked'> => {
  if (taskFlags[task.id]?.done) return 'done';
  return taskWorkflowState(task, taskFlags);
};

export const canMoveTask = (
  task: Task,
  targetState: Task['state'],
  taskFlags: Record<string, TaskFlagState>,
): boolean => {
  if (!isTaskBlocked(task, taskFlags)) return true;
  return targetState === taskWorkflowState(task, taskFlags);
};
