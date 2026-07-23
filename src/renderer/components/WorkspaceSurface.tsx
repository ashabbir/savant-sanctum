import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Ban, BarChart3, Check, ChevronDown, ListChecks, Network, Trash2, X } from 'lucide-react';
import { apiSurface, localSetup, mcpSurface, type Artifact, type Provider, type Reminder, type Session, type SurfaceMode, type Task, type Workspace } from '../data';
import { canMoveTask, isTaskBlocked, taskWorkflowState, type TaskFlagState } from '../lib/taskBoard';
import { PanelHeader } from './WorkspacePrimitives';
import { WorkspaceOverview } from './WorkspaceOverview';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceManagePanel, WorkspaceSessionPanel } from './WorkspacePanels';
import { buildSavantHeaders } from '../services/httpClient';

type SessionFileGroup = {
  session_id?: string;
  id?: string;
  provider?: string;
  summary?: string;
  file_count?: number;
  files?: { path?: string; name?: string; category?: string; size?: number }[];
};

type SectionHero = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

type WorkspaceSurfaceProps = {
  hero: SectionHero;
  heroFacts: string[];
  workspaceSessions: Session[];
  workspaceTasks: Task[];
  allTasks: Task[];
  workspaceReminders: Reminder[];
  workspaceNotes: { id: string; sessionId: string; title: string; body: string }[];
  workspaceArtifacts: Artifact[];
  workspaceSessionFiles: Record<string, SessionFileGroup>;
  workspaceMergeRequests: { id: string; title: string; status: string; mrId: string; createdAt?: string; updatedAt?: string }[];
  workspaceJiraTickets: { id: string; title: string; status: string; ticketKey: string; createdAt?: string; updatedAt?: string }[];
  activeWorkspace?: Workspace;
  workspaceSummary: {
    knowledgeNodes: number;
    knowledgeEdges: number;
    knowledgeCommittedNodes: number;
    knowledgeStagedNodes: number;
    knowledgeCommittedEdges: number;
    knowledgeStagedEdges: number;
  };
  manageSummary: { todayTasks: number; todayReminders: number; openTasks: number; pendingReminders: number };
  todayTasks: Task[];
  todayReminders: Reminder[];
  activeSection: string;
  onEdit: () => void;
  surfaceMode: SurfaceMode;
  setSurfaceMode: (mode: SurfaceMode) => void;
  activeModeLabel: string;
  surfaceTitle: string;
  workspaceList: Workspace[];
  workspaceIndex: number;
  setWorkspaceIndex: (value: number) => void;
  setSessionIndex: (value: number) => void;
  activeSession: Session;
  workspaceTasks: Task[];
  workspaceReminders: Reminder[];
  sessionNotes: { id: string; title: string; body: string }[];
  sessionArtifacts: Artifact[];
  sessionTimeline: { id: string; time: string; title: string; detail: string; kind: string }[];
  sessionConversation: { id: string; time: string; title: string; detail: string; kind: 'user' | 'assistant' | 'tool' | 'system'; role: string; provider: string }[];
  sessionStats: { label: string; value: string | number }[];
  sessionCheckpoints: string[];
  activeProvider: Provider;
  providers: Provider[];
  setSessionProvider: (providerName: string) => void;
  localSetup: typeof localSetup;
  pushToast: (title: string, detail: string, tone?: 'good' | 'warning' | 'muted') => void;
  setActiveSection: (section: string) => void;
  setManagementDrawer: (drawer: 'tasks' | 'reminders' | null) => void;
  setNoteList: Dispatch<SetStateAction<{ id: string; sessionId: string; title: string; body: string }[]>>;
  onCreateSessionNote: (text: string) => Promise<void> | void;
  setTaskList: Dispatch<SetStateAction<Task[]>>;
  setReminderList: Dispatch<SetStateAction<Reminder[]>>;
  taskFlags: Record<string, TaskFlagState>;
  reminderFlags: Record<string, { done?: boolean }>;
  setTaskFlags: Dispatch<SetStateAction<Record<string, TaskFlagState>>>;
  setReminderFlags: Dispatch<SetStateAction<Record<string, { done?: boolean }>>>;
  workspaceSearch: string;
  setWorkspaceSearch: (value: string) => void;
  setIsTaskDrawerOpen: (value: boolean) => void;
  setIsNotesDrawerOpen: (value: boolean) => void;
  setIsMergeRequestsDrawerOpen: (value: boolean) => void;
  setIsJiraDrawerOpen: (value: boolean) => void;
  setIsArtifactsDrawerOpen: (value: boolean) => void;
  isKnowledgeOpen: boolean;
  setIsKnowledgeOpen: (value: boolean) => void;
  isActivityOpen: boolean;
  setIsActivityOpen: (value: boolean) => void;
  serverBaseUrl: string;
  apiKey: string;
  onOpenTasks: () => void;
  onEditGlobalTask: (task: Task) => void;
  workspaceActivitySummary: {
    total: number;
    detail: string;
    latest: string;
  };
  restoreActivityContext: (item: { section: string; surfaceMode: string; workspaceIndex: number; sessionIndex: number }) => void;
  activeWorkspaceId: string;
  onOpenSessions: () => void;
  rightRailSlot?: ReactNode;
};

export function WorkspaceSurface(props: WorkspaceSurfaceProps) {
  const {
    hero,
    heroFacts,
    workspaceSessions,
    workspaceTasks,
    allTasks,
    workspaceReminders,
    workspaceNotes,
    workspaceArtifacts,
    workspaceSessionFiles,
    workspaceMergeRequests,
    workspaceJiraTickets,
    activeWorkspace,
    workspaceSummary,
    manageSummary,
    todayTasks,
    todayReminders,
    activeSection,
    onEdit,
    surfaceMode,
    setSurfaceMode,
    activeModeLabel,
    surfaceTitle,
    workspaceList,
    workspaceIndex,
    setWorkspaceIndex,
    setSessionIndex,
    activeSession,
    sessionNotes,
    sessionArtifacts,
    sessionTimeline,
    sessionConversation,
    sessionStats,
    sessionCheckpoints,
    activeProvider,
    providers,
    setSessionProvider,
    localSetup,
    pushToast,
    setActiveSection,
    setManagementDrawer,
    setNoteList,
    onCreateSessionNote,
    setTaskList,
    setReminderList,
    taskFlags,
    reminderFlags,
    setTaskFlags,
    setReminderFlags,
    workspaceSearch,
    setWorkspaceSearch,
    setIsTaskDrawerOpen,
    setIsNotesDrawerOpen,
    setIsMergeRequestsDrawerOpen,
    setIsJiraDrawerOpen,
    setIsArtifactsDrawerOpen,
    isKnowledgeOpen,
    setIsKnowledgeOpen,
    isActivityOpen,
    setIsActivityOpen,
    serverBaseUrl,
    apiKey,
    onOpenTasks,
    onEditGlobalTask,
    workspaceActivitySummary,
    restoreActivityContext,
    activeWorkspaceId,
    onOpenSessions,
  } = props;
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<'overview' | 'visualization' | 'analytics'>('overview');
  const [isGlobalTaskCreateOpen, setIsGlobalTaskCreateOpen] = useState(false);
  const [taskWorkspaceFilter, setTaskWorkspaceFilter] = useState<string>('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('');
  const [taskTextFilter, setTaskTextFilter] = useState('');
  const [globalTaskDraft, setGlobalTaskDraft] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    state: 'todo' as Task['state'],
    due: '',
    workspaceId: '',
  });
  const headers = buildSavantHeaders(apiKey, true);
  const normalizeTaskFromServer = (task: any, fallback: Task): Task => ({
    ...fallback,
    id: task.task_id ?? task.id ?? fallback.id,
    workspaceId: task.workspace_id ?? fallback.workspaceId,
    title: task.title ?? fallback.title,
    description: task.description ?? fallback.description ?? '',
    priority: task.priority ?? fallback.priority,
    state: task.status ?? fallback.state,
    due: task.date ?? fallback.due,
    dependsOn: task.depends_on ?? task.dependencies ?? fallback.dependsOn ?? [],
    createdAt: task.created_at ?? task.createdAt ?? fallback.createdAt,
    updatedAt: task.updated_at ?? task.updatedAt ?? fallback.updatedAt,
  });
  const moveGlobalTask = (taskId: string, state: Task['state']) => {
    const currentTask = allTasks.find((task) => task.id === taskId);
    if (currentTask && !canMoveTask(currentTask, state, taskFlags)) {
      pushToast('Task blocked', `${currentTask.title} must be unblocked before changing status.`, 'warning');
      setDraggingTaskId(null);
      return;
    }
    const previousState = currentTask ? taskWorkflowState(currentTask, taskFlags) : 'todo';
    const movedAt = new Date().toISOString();
    setTaskList((current) => current.map((task) => (task.id === taskId ? { ...task, state } : task)));
    setTaskFlags((current) => ({ ...current, [taskId]: { ...(current[taskId] ?? {}), done: state === 'done', lastMovedAt: movedAt, lastMovedFrom: previousState, lastMovedTo: state } }));
    setDraggingTaskId(null);
    pushToast('Task moved', `Task moved to ${state}.`, 'good');
    void fetch(`${serverBaseUrl.replace(/\/+$/, '')}/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: state }),
    }).catch(() => undefined);
  };
  const toggleTaskBlocked = (task: Task) => {
    const blocked = !isTaskBlocked(task, taskFlags);
    const workflowState = taskWorkflowState(task, taskFlags);
    setTaskFlags((current) => ({ ...current, [task.id]: { ...(current[task.id] ?? {}), blocked } }));
    if (task.state === 'blocked') {
      setTaskList((current) => current.map((item) => item.id === task.id ? { ...item, state: workflowState } : item));
    }
    pushToast(blocked ? 'Task blocked' : 'Task unblocked', `${task.title} remains in ${workflowState}.`, blocked ? 'warning' : 'good');
  };
  const removeGlobalTask = (taskId: string) => {
    const task = allTasks.find((item) => item.id === taskId);
    setTaskList((current) => current.filter((item) => item.id !== taskId));
    setTaskFlags((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    pushToast('Task removed', task ? `${task.title} removed from the global board.` : 'Task removed.', 'warning');
    void fetch(`${serverBaseUrl.replace(/\/+$/, '')}/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => undefined);
  };
  const filteredGlobalTasks = useMemo(() => {
    return allTasks.filter((task) => {
      const doneState = taskFlags[task.id]?.done ? 'done' : task.state;
      const searchText = taskTextFilter.trim().toLowerCase();
      if (searchText && !`${task.title} ${task.description ?? ''}`.toLowerCase().includes(searchText)) return false;
      if (taskWorkspaceFilter && task.workspaceId !== taskWorkspaceFilter) return false;
      if (taskStatusFilter && doneState !== taskStatusFilter) return false;
      if (taskPriorityFilter && task.priority !== taskPriorityFilter) return false;
      return true;
    });
  }, [allTasks, taskFlags, taskPriorityFilter, taskStatusFilter, taskTextFilter, taskWorkspaceFilter]);
  const filteredTaskColumns = useMemo(() => {
    return (['todo', 'in-progress', 'review', 'done'] as const).map((state) => ({
      state,
      tasks: filteredGlobalTasks.filter((task) => (taskFlags[task.id]?.done ? 'done' : task.state) === state),
    }));
  }, [filteredGlobalTasks, taskFlags]);
  const globalTaskStats = useMemo(() => {
    const completed = filteredGlobalTasks.filter((task) => (taskFlags[task.id]?.done ? 'done' : task.state) === 'done').length;
    const blocked = filteredGlobalTasks.filter((task) => isTaskBlocked(task, taskFlags) && !taskFlags[task.id]?.done).length;
    const active = filteredGlobalTasks.filter((task) => taskWorkflowState(task, taskFlags) === 'in-progress' && !taskFlags[task.id]?.done).length;
    const todo = filteredGlobalTasks.filter((task) => taskWorkflowState(task, taskFlags) === 'todo' && !taskFlags[task.id]?.done).length;
    const review = filteredGlobalTasks.filter((task) => taskWorkflowState(task, taskFlags) === 'review' && !taskFlags[task.id]?.done).length;
    const critical = filteredGlobalTasks.filter((task) => task.priority === 'critical' && !taskFlags[task.id]?.done && task.state !== 'done').length;
    const workspaceCount = new Set(filteredGlobalTasks.map((task) => task.workspaceId).filter(Boolean)).size;
    const completionRate = filteredGlobalTasks.length ? Math.round((completed / filteredGlobalTasks.length) * 100) : 0;
    return { total: filteredGlobalTasks.length, todo, active, review, blocked, critical, completed, workspaceCount, completionRate };
  }, [filteredGlobalTasks, taskFlags]);
  const globalTaskWorkflow = useMemo(() => {
    const tasksById = new Map(filteredGlobalTasks.map((task) => [task.id, task]));
    const parents = new Map<string, string[]>();
    filteredGlobalTasks.forEach((task) => {
      parents.set(task.id, (task.dependsOn ?? []).filter((id) => tasksById.has(id)));
    });

    const levelCache = new Map<string, number>();
    const getLevel = (taskId: string, seen = new Set<string>()): number => {
      if (levelCache.has(taskId)) return levelCache.get(taskId)!;
      if (seen.has(taskId)) return 0;
      const nextSeen = new Set(seen).add(taskId);
      const taskParents = parents.get(taskId) ?? [];
      const level = taskParents.length ? Math.max(...taskParents.map((id) => getLevel(id, nextSeen))) + 1 : 0;
      levelCache.set(taskId, level);
      return level;
    };

    const groups = new Map<number, Task[]>();
    filteredGlobalTasks.forEach((task) => {
      const level = getLevel(task.id);
      groups.set(level, [...(groups.get(level) ?? []), task]);
    });
    const widestLevel = Math.max(1, ...Array.from(groups.values()).map((tasks) => tasks.length));
    const width = Math.max(1000, widestLevel * 210 + 180);
    const nodes = Array.from(groups.entries()).flatMap(([level, levelTasks]) => {
      const sorted = levelTasks.slice().sort((a, b) => a.title.localeCompare(b.title));
      const spacing = 210;
      const startX = width / 2 - ((sorted.length - 1) * spacing) / 2;
      return sorted.map((task, index) => ({ task, x: startX + index * spacing, y: 80 + level * 130 }));
    });
    const placement = new Map(nodes.map((node) => [node.task.id, node]));
    const edges = filteredGlobalTasks.flatMap((task) => (parents.get(task.id) ?? []).map((parentId) => ({
      id: `${parentId}->${task.id}`,
      source: placement.get(parentId),
      target: placement.get(task.id),
    }))).filter((edge): edge is { id: string; source: NonNullable<typeof edge.source>; target: NonNullable<typeof edge.target> } => Boolean(edge.source && edge.target));
    const depth = Math.max(0, ...nodes.map((node) => getLevel(node.task.id)));
    return { nodes, edges, width, height: Math.max(380, depth * 130 + 170) };
  }, [filteredGlobalTasks]);
  const visualTimeStats = useMemo(() => {
    const tasksWithTime = filteredGlobalTasks.filter(t => t.timeSpent !== undefined && t.timeSpent > 0);
    if (tasksWithTime.length === 0) {
      return { total: 0, average: 0, max: 0 };
    }
    const times = tasksWithTime.map(t => t.timeSpent!);
    const total = times.reduce((sum, t) => sum + t, 0);
    const average = Math.round((total / times.length) * 10) / 10;
    const max = Math.max(...times);
    return { total, average, max };
  }, [filteredGlobalTasks]);
  const workspaceTaskAnalytics = useMemo(() => workspaceList.map((workspace) => {
    const scoped = filteredGlobalTasks.filter((task) => task.workspaceId === workspace.id);
    const statusCounts = (['todo', 'in-progress', 'review', 'done'] as const).map((status) => ({
      status,
      count: scoped.filter((task) => (taskFlags[task.id]?.done ? 'done' : taskWorkflowState(task, taskFlags)) === status).length,
    }));
    const createdTimes = scoped.map((task) => Date.parse(task.createdAt ?? '')).filter(Number.isFinite);
    const latestActivity = scoped
      .map((task) => ({ task, timestamp: taskFlags[task.id]?.lastMovedAt ?? task.updatedAt ?? task.createdAt ?? '' }))
      .filter((item) => item.timestamp)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    const times = scoped.map(t => t.timeSpent!).filter(t => typeof t === 'number' && t > 0);
    const totalTimeSpent = times.reduce((sum, t) => sum + t, 0);
    const averageTimeSpent = times.length ? Math.round((totalTimeSpent / times.length) * 10) / 10 : 0;
    const maxTimeSpent = times.length ? Math.max(...times) : 0;

    const complexityCounts = {
      simple: scoped.filter(t => t.complexity === 'simple').length,
      moderate: scoped.filter(t => t.complexity === 'moderate').length,
      complex: scoped.filter(t => t.complexity === 'complex').length,
      extreme: scoped.filter(t => t.complexity === 'extreme').length,
    };

    return {
      workspace,
      tasks: scoped,
      statusCounts,
      blocked: scoped.filter(isTaskBlocked).length,
      firstCreated: createdTimes.length ? new Date(Math.min(...createdTimes)).toLocaleDateString() : 'No timestamp',
      latestActivity,
      totalTimeSpent,
      averageTimeSpent,
      maxTimeSpent,
      complexityCounts,
    };
  }).filter((item) => item.tasks.length > 0), [filteredGlobalTasks, taskFlags, workspaceList]);
  const openGlobalTaskCreator = () => {
    setGlobalTaskDraft({
      title: '',
      description: '',
      priority: 'medium',
      state: 'todo',
      due: '',
      workspaceId: '',
    });
    setIsGlobalTaskCreateOpen(true);
  };
  const createGlobalTask = async () => {
    const title = globalTaskDraft.title.trim();
    if (!title || !globalTaskDraft.workspaceId) return;
    const localTask: Task = {
      id: `task-${Date.now().toString(36)}`,
      workspaceId: globalTaskDraft.workspaceId,
      title,
      description: globalTaskDraft.description,
      priority: globalTaskDraft.priority,
      state: globalTaskDraft.state,
      owner: 'operator',
      due: globalTaskDraft.due || undefined,
      dependsOn: [],
      comments: [],
    };
    let task = localTask;
    try {
      const response = await fetch(`${serverBaseUrl.replace(/\/+$/, '')}/api/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          task_id: localTask.id,
          workspace_id: localTask.workspaceId,
          title,
          description: globalTaskDraft.description,
          status: globalTaskDraft.state,
          priority: globalTaskDraft.priority,
          date: globalTaskDraft.due || undefined,
        }),
      });
      if (response.ok) task = normalizeTaskFromServer(await response.json(), localTask);
    } catch {
      // Keep the local optimistic task when the server is unavailable.
    }
    setTaskList((current) => [task, ...current.filter((item) => item.id !== task.id)]);
    pushToast('Task created', `${title} added to ${workspaceList.find((workspace) => workspace.id === task.workspaceId)?.name ?? task.workspaceId}.`, 'good');
    setIsGlobalTaskCreateOpen(false);
  };
  return (
    <main className="workspace">
      {activeSection !== 'tasks' && <WorkspaceHeader
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        workspaceColor={activeWorkspace?.color}
        workspacePriority={activeWorkspace?.priority}
        workspaceStatus={activeWorkspace?.status}
        facts={heroFacts}
        showFacts={activeSection !== 'workspace'}
        showActions={activeSection !== 'workspace'}
        onEdit={onEdit}
        onAddNote={() => {
          void onCreateSessionNote('Session note captured from the Sanctum shell.');
          setActiveSection('notes');
        }}
        onOpenKnowledge={() => setIsKnowledgeOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
        workspaceId={activeWorkspaceId}
      />}
      {activeSection === 'workspace' ? (
        <WorkspaceOverview
          workspaceSessions={workspaceSessions}
          workspaceTasks={workspaceTasks}
          workspaceNotes={workspaceNotes}
          workspaceArtifacts={workspaceArtifacts}
          workspaceMergeRequests={workspaceMergeRequests}
          workspaceJiraTickets={workspaceJiraTickets}
          workspaceSummary={workspaceSummary}
        workspaceActivitySummary={workspaceActivitySummary}
        taskFlags={taskFlags}
        onTaskSelect={(task) => pushToast('Task selected', `${task.title} · ${task.state}.`, task.state === 'in-progress' ? 'good' : 'muted')}
        onOpenSessions={onOpenSessions}
        onOpenTasks={() => setIsTaskDrawerOpen(true)}
        onOpenNotes={() => setIsNotesDrawerOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
        onOpenArtifacts={() => setIsArtifactsDrawerOpen(true)}
        onOpenKnowledge={() => setIsKnowledgeOpen(true)}
        onOpenMergeRequests={() => setIsMergeRequestsDrawerOpen(true)}
        onOpenJira={() => setIsJiraDrawerOpen(true)}
        />
      ) : activeSection === 'tasks' ? (
        <section className="task-manager-shell" style={{ paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '10px 14px', border: '1px solid rgba(0,229,255,0.18)', background: 'rgba(0,229,255,0.03)' }}>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--cyan)', fontSize: 10 }}>Task Manager</div>
              <h2 style={{ margin: '4px 0 0', fontFamily: "'Orbitron', monospace", fontSize: 18, color: 'var(--text)' }}>Cross-workspace board</h2>
            </div>
          </div>
          <section className="panel panel-spanning task-manager-panel" style={{ minHeight: 'calc(100vh - 220px)' }}>
            <div className="task-dashboard-filters mb-4">
              <label className="task-editor-field">
                <span>Search</span>
                <input
                  type="search"
                  value={taskTextFilter}
                  onChange={(event) => setTaskTextFilter(event.target.value)}
                  placeholder="Title or description..."
                />
              </label>
              <label className="task-editor-field">
                <span>Workspace</span>
                <select value={taskWorkspaceFilter} onChange={(event) => setTaskWorkspaceFilter(event.target.value)}>
                  <option value="">All workspaces</option>
                  {workspaceList.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </select>
              </label>
              <label className="task-editor-field">
                <span>Status</span>
                <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {(['todo', 'in-progress', 'review', 'done'] as const).map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
              <label className="task-editor-field">
                <span>Priority</span>
                <select value={taskPriorityFilter} onChange={(event) => setTaskPriorityFilter(event.target.value)}>
                  <option value="">All priorities</option>
                  {(['critical', 'high', 'medium', 'low'] as const).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
            </div>
            <div className="task-view-toggle mb-4" role="tablist" aria-label="Task view">
              <button type="button" className={taskViewMode === 'overview' ? 'is-active' : ''} onClick={() => setTaskViewMode('overview')}><ListChecks size={13} /> Overview</button>
              <button type="button" className={taskViewMode === 'analytics' ? 'is-active' : ''} onClick={() => setTaskViewMode('analytics')}><BarChart3 size={13} /> Analytics</button>
              <button type="button" className={taskViewMode === 'visualization' ? 'is-active' : ''} onClick={() => setTaskViewMode('visualization')}><Network size={13} /> Visual</button>
            </div>
            {taskViewMode === 'overview' ? (
              <div className="task-kanban-grid task-manager-kanban-grid">
                {filteredTaskColumns.map((column) => (
                  <section key={column.state} className="task-kanban-column">
                    <div className="task-kanban-head">
                      <span>{column.state}</span>
                      <strong>{column.tasks.length}</strong>
                    </div>
                    <div
                      className={`task-kanban-list ${draggingTaskId ? 'is-drop-ready' : ''}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
                        if (taskId) moveGlobalTask(taskId, column.state);
                      }}
                    >
                      {column.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="task-kanban-card"
                          draggable={!isTaskBlocked(task, taskFlags)}
                          onDragStart={(event) => {
                            if (isTaskBlocked(task, taskFlags)) {
                              event.preventDefault();
                              return;
                            }
                            setDraggingTaskId(task.id);
                            event.dataTransfer.setData('text/plain', task.id);
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => setDraggingTaskId(null)}
                          onClick={() => onEditGlobalTask(task)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="task-card-title">{task.title}</div>
                          <div className="task-card-description">{task.description || 'No description.'}</div>
                          <div className="task-card-meta">
                            <span>{task.priority}</span>
                            <span>{workspaceList.find((workspace) => workspace.id === task.workspaceId)?.name ?? task.workspaceId}</span>
                          </div>
                          <div className="task-card-footer">
                            <div className="task-card-footer-state">
                              <div className="task-card-state">{taskFlags[task.id]?.done ? 'done' : taskWorkflowState(task, taskFlags)}</div>
                              {isTaskBlocked(task, taskFlags) && <div className="task-blocked-badge"><Ban size={11} /> Blocked</div>}
                            </div>
                            <div className="task-card-actions">
                              <button
                                type="button"
                                className={`task-card-block ${isTaskBlocked(task, taskFlags) ? 'is-blocked' : ''}`}
                                aria-label={`${isTaskBlocked(task, taskFlags) ? 'Unblock' : 'Block'} ${task.title}`}
                                title={isTaskBlocked(task, taskFlags) ? 'Unblock task' : 'Block task'}
                                onClick={(event) => { event.stopPropagation(); toggleTaskBlocked(task); }}
                              >
                                <Ban size={14} />
                              </button>
                              <button
                                type="button"
                                className="task-card-remove"
                                aria-label={`Delete ${task.title}`}
                                title="Delete task"
                                onClick={(event) => { event.stopPropagation(); removeGlobalTask(task.id); }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : taskViewMode === 'visualization' ? (
              <div className="task-workflow-shell">
                {filteredGlobalTasks.length === 0 ? (
                  <div className="activity-empty">No tasks to visualize.</div>
                ) : (
                  <>
                    <div className="task-dashboard-stats" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                      <div className="task-dashboard-stat task-dashboard-stat-active">
                        <span>Total Time Spent</span>
                        <strong>{visualTimeStats.total} hrs</strong>
                      </div>
                      <div className="task-dashboard-stat task-dashboard-stat-review">
                        <span>Average Time Spent</span>
                        <strong>{visualTimeStats.average} hrs</strong>
                      </div>
                      <div className="task-dashboard-stat task-dashboard-stat-critical">
                        <span>Max Time Spent</span>
                        <strong>{visualTimeStats.max} hrs</strong>
                      </div>
                    </div>
                    <svg
                      className="task-workflow-svg task-workflow-svg-contained"
                      viewBox={`0 0 ${globalTaskWorkflow.width} ${globalTaskWorkflow.height}`}
                      preserveAspectRatio="xMidYMin meet"
                      role="img"
                      aria-label="Global task dependency map"
                    >
                      <defs>
                        <marker id="task-arrow-global" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                          <path d="M0,0 L0,6 L9,3 z" fill="rgba(0,229,255,0.7)" />
                        </marker>
                      </defs>
                      {globalTaskWorkflow.edges.map((edge) => (
                        <path
                          key={edge.id}
                          className="task-workflow-edge"
                          markerEnd="url(#task-arrow-global)"
                          d={`M${edge.source.x},${edge.source.y + 30} C${edge.source.x},${edge.source.y + 58} ${edge.target.x},${edge.target.y - 58} ${edge.target.x},${edge.target.y - 30}`}
                        />
                      ))}
                      {globalTaskWorkflow.nodes.map(({ task, x, y }) => (
                          <g key={task.id} className="task-workflow-node" role="button" tabIndex={0} onClick={() => pushToast('Task selected', `${task.title} · ${workspaceList.find((workspace) => workspace.id === task.workspaceId)?.name ?? task.workspaceId}.`, 'muted')}>
                            <rect x={x - 84} y={y - 28} width="168" height="56" rx="0" className={`task-workflow-card priority-${task.priority}`} />
                            <text x={x} y={y - 7} textAnchor="middle" className="task-workflow-title">{task.title.length > 28 ? `${task.title.slice(0, 27)}…` : task.title}</text>
                            <text x={x} y={y + 13} textAnchor="middle" className="task-workflow-meta">{task.priority} · {workspaceList.find((workspace) => workspace.id === task.workspaceId)?.name ?? task.workspaceId}</text>
                            
                            {/* Complexity Badge */}
                            {task.complexity && (
                              <g>
                                <rect
                                  x={x + 35}
                                  y={y - 24}
                                  width="45"
                                  height="12"
                                  rx="2"
                                  fill={
                                    task.complexity === 'extreme' ? 'rgba(255, 0, 85, 0.15)' :
                                    task.complexity === 'complex' ? 'rgba(255, 170, 0, 0.15)' :
                                    task.complexity === 'moderate' ? 'rgba(0, 229, 255, 0.15)' :
                                    'rgba(0, 230, 118, 0.15)'
                                  }
                                  stroke={
                                    task.complexity === 'extreme' ? '#ff0055' :
                                    task.complexity === 'complex' ? '#ffaa00' :
                                    task.complexity === 'moderate' ? '#00e5ff' :
                                    '#00e676'
                                  }
                                  strokeWidth="0.5"
                                />
                                <text
                                  x={x + 57.5}
                                  y={y - 15}
                                  textAnchor="middle"
                                  style={{
                                    fontSize: '7px',
                                    fill: '#fff',
                                    fontWeight: 'bold',
                                    fontFamily: "'Share Tech Mono', monospace",
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}
                                >
                                  {task.complexity}
                                </text>
                              </g>
                            )}

                            {(task.dependsOn ?? []).some((id) => filteredGlobalTasks.some((candidate) => candidate.id === id)) && <circle cx={x + 70} cy={y + 15} r="4" className="task-workflow-link-dot" />}
                          </g>
                      ))}
                    </svg>
                  </>
                )}
              </div>
            ) : (
              <>
                <section className="task-status-overview" aria-label="Task Status Overview" style={{ marginBottom: 20 }}>
                  <div className="task-status-overview-head">
                    <div>
                      <div className="eyebrow">Overview</div>
                      <h3>Task Status Overview</h3>
                    </div>
                    <div className="task-overview-summary">
                      <span>{globalTaskStats.workspaceCount} workspaces</span>
                      <strong>{globalTaskStats.completionRate}% complete</strong>
                    </div>
                  </div>
                  <div className="task-dashboard-stats">
                    {[
                      ['All tasks', globalTaskStats.total, 'all'],
                      ['To do', globalTaskStats.todo, 'todo'],
                      ['In progress', globalTaskStats.active, 'active'],
                      ['Review', globalTaskStats.review, 'review'],
                      ['Blocked', globalTaskStats.blocked, 'blocked'],
                      ['Done', globalTaskStats.completed, 'done'],
                      ['Critical open', globalTaskStats.critical, 'critical'],
                    ].map(([label, value, tone]) => (
                      <div key={label} className={`task-dashboard-stat task-dashboard-stat-${tone}`}><span>{label}</span><strong>{value}</strong></div>
                    ))}
                  </div>
                </section>
                <div className="task-analytics-grid" aria-label="Tasks by workspace analytics">
                {workspaceTaskAnalytics.map(({ workspace, tasks: scopedTasks, statusCounts, blocked, firstCreated, latestActivity, totalTimeSpent, averageTimeSpent, maxTimeSpent, complexityCounts }) => (
                  <section key={workspace.id} className="task-analytics-card">
                    <div className="task-analytics-card-head">
                      <div><span>Workspace</span><h3>{workspace.name}</h3></div>
                      <strong>{scopedTasks.length}</strong>
                    </div>
                    <div className="task-analytics-bars">
                      {statusCounts.map(({ status, count }) => (
                        <div key={status} className="task-analytics-bar-row">
                          <span>{status}</span>
                          <div><i style={{ width: `${scopedTasks.length ? (count / scopedTasks.length) * 100 : 0}%` }} /></div>
                          <strong>{count}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="task-analytics-facts">
                      <span>Blocked <strong>{blocked}</strong></span>
                      <span>First created <strong>{firstCreated}</strong></span>
                    </div>

                    {/* Time Spent Stats */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                      <div className="eyebrow" style={{ marginBottom: 6, fontSize: 9 }}>Time Metrics</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                          <strong style={{ color: 'var(--cyan)' }}>{totalTimeSpent}h</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg</span>
                          <strong style={{ color: 'var(--violet)' }}>{averageTimeSpent}h</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max</span>
                          <strong style={{ color: 'var(--pink)' }}>{maxTimeSpent}h</strong>
                        </div>
                      </div>
                    </div>

                    {/* Complexity Metrics */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                      <div className="eyebrow" style={{ marginBottom: 6, fontSize: 9 }}>Complexity Distribution</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0, 230, 118, 0.03)', border: '1px solid rgba(0, 230, 118, 0.12)', padding: '4px 2px', borderRadius: 2 }}>
                          <span style={{ color: '#00e676', fontSize: 7, textTransform: 'uppercase', fontWeight: 'bold' }}>Simple</span>
                          <strong style={{ fontSize: 11, marginTop: 2 }}>{complexityCounts.simple}</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.12)', padding: '4px 2px', borderRadius: 2 }}>
                          <span style={{ color: '#00e5ff', fontSize: 7, textTransform: 'uppercase', fontWeight: 'bold' }}>Mod</span>
                          <strong style={{ fontSize: 11, marginTop: 2 }}>{complexityCounts.moderate}</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255, 170, 0, 0.03)', border: '1px solid rgba(255, 170, 0, 0.12)', padding: '4px 2px', borderRadius: 2 }}>
                          <span style={{ color: '#ffaa00', fontSize: 7, textTransform: 'uppercase', fontWeight: 'bold' }}>Comp</span>
                          <strong style={{ fontSize: 11, marginTop: 2 }}>{complexityCounts.complex}</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255, 0, 85, 0.03)', border: '1px solid rgba(255, 0, 85, 0.12)', padding: '4px 2px', borderRadius: 2 }}>
                          <span style={{ color: '#ff0055', fontSize: 7, textTransform: 'uppercase', fontWeight: 'bold' }}>Extr</span>
                          <strong style={{ fontSize: 11, marginTop: 2 }}>{complexityCounts.extreme}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="task-analytics-activity">
                      <span>Latest lifecycle event</span>
                      {latestActivity ? (
                        <div>
                          <strong>{latestActivity.task.title}</strong>
                          <small>
                            {taskFlags[latestActivity.task.id]?.lastMovedAt
                              ? `Moved ${taskFlags[latestActivity.task.id]?.lastMovedFrom} → ${taskFlags[latestActivity.task.id]?.lastMovedTo}`
                              : latestActivity.task.updatedAt ? 'Last updated' : 'Created'}
                            {' · '}{new Date(latestActivity.timestamp).toLocaleString()}
                          </small>
                        </div>
                      ) : <em>No lifecycle timestamp available</em>}
                    </div>
                  </section>
                ))}
                {workspaceTaskAnalytics.length === 0 && <div className="activity-empty">No workspace task statistics match these filters.</div>}
              </div>
            </>
          )}
          </section>
        </section>
      ) : (
        <section className="content-grid">
          <WorkspaceSessionPanel
            surfaceTitle={surfaceTitle}
            activeModeLabel={activeModeLabel}
            activeSection={activeSection}
            activeSession={activeSession}
            workspaceList={workspaceList}
            workspaceIndex={workspaceIndex}
            setWorkspaceIndex={setWorkspaceIndex}
            setSessionIndex={setSessionIndex}
            workspaceSessions={workspaceSessions}
            sessionStats={sessionStats}
            sessionCheckpoints={sessionCheckpoints}
            sessionTimeline={sessionTimeline}
            sessionNotes={sessionNotes}
            sessionArtifacts={sessionArtifacts}
            sessionFileGroup={workspaceSessionFiles[activeSession.id]}
            sessionConversation={sessionConversation}
            setActiveSection={setActiveSection}
            pushToast={pushToast}
            taskFlags={taskFlags}
          />
          <section className="panel">
            <PanelHeader title="Tasks" action="Prioritize" />
            <div className="list">{workspaceTasks.map((task) => <button key={task.id} type="button" className="row row-button" onClick={() => pushToast('Task selected', `${task.title} · ${task.state}.`, task.state === 'in-progress' ? 'good' : 'muted')}><div><div className="row-title">{task.title}</div><div className="row-meta">{`${task.priority} · ${task.owner}`}</div></div><div className="row-detail">{taskFlags[task.id]?.done ? 'done' : task.state}</div></button>)}</div>
          </section>
        </section>
      )}

      {isGlobalTaskCreateOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsGlobalTaskCreateOpen(false)}>
          <form className="modal-card task-info-modal" role="dialog" aria-modal="true" aria-labelledby="global-task-title" onSubmit={(event) => { event.preventDefault(); void createGlobalTask(); }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">Add task</div>
                <h2 id="global-task-title">New cross-workspace task</h2>
              </div>
              <button type="button" className="text-btn action-close icon-only" aria-label="Close" title="Close" onClick={() => setIsGlobalTaskCreateOpen(false)}><X size={14} /></button>
            </div>

            <div className="task-editor-grid">
              <div className="task-editor-main">
                <label className="task-editor-field">
                  <span>Title</span>
                  <input value={globalTaskDraft.title} onChange={(event) => setGlobalTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" />
                </label>
                <label className="task-editor-field">
                  <span>Detail</span>
                  <textarea value={globalTaskDraft.description} onChange={(event) => setGlobalTaskDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Task detail, acceptance notes, or implementation context." />
                </label>
              </div>
              <aside className="task-editor-side">
                <label className="task-editor-field">
                  <span>Workspace</span>
                  <select required value={globalTaskDraft.workspaceId} onChange={(event) => setGlobalTaskDraft((current) => ({ ...current, workspaceId: event.target.value }))}>
                    <option value="">Select workspace...</option>
                    {workspaceList.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                  </select>
                </label>
                <label className="task-editor-field">
                  <span>Status</span>
                  <select value={globalTaskDraft.state} onChange={(event) => setGlobalTaskDraft((current) => ({ ...current, state: event.target.value as Task['state'] }))}>
                    <option value="todo">to do</option>
                    <option value="in-progress">in progress</option>
                    <option value="review">review</option>
                    <option value="done">done</option>
                  </select>
                </label>
                <label className="task-editor-field">
                  <span>Priority</span>
                  <select value={globalTaskDraft.priority} onChange={(event) => setGlobalTaskDraft((current) => ({ ...current, priority: event.target.value as Task['priority'] }))}>
                    <option value="critical">critical</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </label>
                <label className="task-editor-field">
                  <span>Date</span>
                  <input type="date" value={globalTaskDraft.due} onChange={(event) => setGlobalTaskDraft((current) => ({ ...current, due: event.target.value }))} />
                </label>
              </aside>
            </div>

            <div className="modal-actions">
              <button type="submit" className="ghost-btn action-save icon-only" aria-label="Create task" title="Create task"><Check size={14} /></button>
              <button type="button" className="ghost-btn action-close icon-only" aria-label="Cancel" title="Cancel" onClick={() => setIsGlobalTaskCreateOpen(false)}><X size={14} /></button>
            </div>
          </form>
        </div>
      )}
      {activeSection === 'manage' && <WorkspaceManagePanel manageSummary={manageSummary} />}
    </main>
  );
}
