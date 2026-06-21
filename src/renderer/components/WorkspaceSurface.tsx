import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { apiSurface, localSetup, mcpSurface, type Artifact, type Provider, type Reminder, type Session, type SurfaceMode, type Task, type Workspace } from '../data';
import { PanelHeader } from './WorkspacePrimitives';
import { WorkspaceOverview } from './WorkspaceOverview';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceManagePanel, WorkspaceSessionPanel } from './WorkspacePanels';

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
  taskFlags: Record<string, { done?: boolean }>;
  reminderFlags: Record<string, { done?: boolean }>;
  setTaskFlags: Dispatch<SetStateAction<Record<string, { done?: boolean }>>>;
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
    workspaceActivitySummary,
    restoreActivityContext,
    activeWorkspaceId,
    onOpenSessions,
  } = props;
  return (
    <main className="workspace">
      <WorkspaceHeader
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
      />
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
      {activeSection === 'manage' && <WorkspaceManagePanel manageSummary={manageSummary} />}
    </main>
  );
}
