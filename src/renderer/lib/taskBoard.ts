import type { Task } from '../data';

export type TaskFlagState = {
  done?: boolean;
  blocked?: boolean;
  lastMovedAt?: string;
  lastMovedFrom?: string;
  lastMovedTo?: string;
};

export const isTaskBlocked = (task: Task, taskFlags: Record<string, TaskFlagState>): boolean => {
  return Boolean(taskFlags[task.id]?.blocked);
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
