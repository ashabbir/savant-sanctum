import { type ReactNode } from 'react';
import { Bell, ChevronLeft, ChevronRight, Folder, Keyboard, LogOut, Plus, Settings } from 'lucide-react';
import type { Session, Workspace } from '../data';
import { BottomBar } from './BottomBar';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

type ToastLike = {
  id: string;
  title: string;
  detail: string;
  tone: 'good' | 'warning' | 'muted';
};

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  section: string;
  surfaceMode: string;
  workspaceIndex: number;
  sessionIndex: number;
};

type ShellChromeProps = {
  sanctumMark: string;
  navigation: NavItem[];
  sectionIcons: Record<string, ReactNode>;
  activeSection: string;
  activityCount: number;
  toasts: ToastLike[];
  workspaceList: Workspace[];
  isWorkspaceLoading?: boolean;
  workspaceSearch: string;
  onWorkspaceSearchChange: (value: string) => void;
  workspaceIndex: number;
  onWorkspaceSelect: (index: number) => void;
  isWorkspacePaneOpen: boolean;
  toggleWorkspacePane: () => void;
  workspaceSessions: Session[];
  onAlerts: () => void;
  onHelp: () => void;
  onLogout: () => void;
  onWorkspaceCreate: () => void;
  onWorkspaceSelected: () => void;
  onSettings: () => void;
  rightRailItems: { id: string; label: string; icon: ReactNode; active: boolean; action: () => void }[];
  children: ReactNode;
  footerItems: { label: string; status: string; detail: string }[];
};

export function ShellChrome({
  sanctumMark,
  navigation,
  sectionIcons,
  activeSection,
  activityCount,
  toasts,
  workspaceList,
  isWorkspaceLoading = false,
  workspaceSearch,
  onWorkspaceSearchChange,
  workspaceIndex,
  onWorkspaceSelect,
  isWorkspacePaneOpen,
  toggleWorkspacePane,
  workspaceSessions,
  onAlerts,
  onHelp,
  onLogout,
  onWorkspaceCreate,
  onWorkspaceSelected,
  onSettings,
  rightRailItems,
  children,
  footerItems,
}: ShellChromeProps) {
  const filteredWorkspaces = workspaceList.filter((ws) => ws.name.toLowerCase().includes(workspaceSearch.toLowerCase()));

  return (
    <div className="app-shell">
      <header className="topbar-shell">
        <div style={{ background: 'var(--cp-bg-1)', borderBottom: '1px solid var(--cp-border)', boxShadow: '0 1px 0 rgba(0,229,255,0.08)' }} className="flex items-center justify-between px-3 h-10 w-full shrink-0">
          <div className="w-24" />
          <div className="flex items-center gap-2">
            <div style={{ background: 'linear-gradient(135deg, var(--cp-cyan), var(--cp-purple))', boxShadow: 'var(--cp-glow-cyan)' }} className="w-6 h-6 flex items-center justify-center overflow-hidden">
              <img src={sanctumMark} alt="Savant" className="w-full h-full object-contain" />
            </div>
            <span style={{ fontFamily: "'Orbitron', monospace", color: 'var(--cp-cyan)', textShadow: 'var(--cp-glow-cyan)', letterSpacing: '0.15em' }} className="text-sm font-bold uppercase tracking-widest">sanctum</span>
          </div>
          <div className="flex items-center gap-2 w-24 justify-end"><span className="text-[10px] opacity-40 font-mono">OP_CON</span></div>
        </div>
      </header>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
        ))}
      </div>

      <div className={`shell-body ${isWorkspacePaneOpen ? 'left-pane-open' : 'left-pane-collapsed'}`}>
        <aside className="rail rail-left">
          <div className="rail-group">
            {[...navigation.filter((item) => item.id === 'workspace'), ...navigation.filter((item) => item.id === 'manage')].map((item) => (
              <button key={item.id} className={`nav-item ${activeSection === item.id ? 'is-active' : ''}`} onClick={item.id === 'workspace' ? toggleWorkspacePane : onWorkspaceSelected} title={item.label} aria-label={item.label}>
                <span className="nav-icon" aria-hidden="true">{sectionIcons[item.id] || item.icon}</span>
              </button>
            ))}
          </div>
          <div className="rail-spacer" />
          <div className="rail-group rail-group-bottom">
            <button className="nav-item" onClick={onAlerts} title="Alerts" aria-label="Alerts"><span className="nav-icon" aria-hidden="true"><Bell size={14} /></span><span className="nav-count">{Math.max(activityCount, toasts.length)}</span></button>
            <button className="nav-item" onClick={onHelp} title="Shortcuts" aria-label="Shortcuts"><span className="nav-icon" aria-hidden="true"><Keyboard size={14} /></span></button>
            <button className={`nav-item ${activeSection === 'settings' ? 'is-active' : ''}`} onClick={onSettings} title="Preferences" aria-label="Preferences"><span className="nav-icon" aria-hidden="true"><Settings size={14} /></span></button>
            <button className="nav-item" onClick={onLogout} title="Logout" aria-label="Logout"><span className="nav-icon" aria-hidden="true"><LogOut size={14} /></span></button>
          </div>
        </aside>

        <aside className={`workspace-pane ${isWorkspacePaneOpen ? 'is-open' : 'is-closed'}`}>
          <div className="workspace-pane-head">
            <div>
              <div className="eyebrow">Workspaces</div>
              <h2>Workspaces</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="text-btn flex items-center justify-center w-6 h-6 p-0"
                onClick={toggleWorkspacePane}
                title={isWorkspacePaneOpen ? 'Collapse panel' : 'Expand panel'}
                aria-label={isWorkspacePaneOpen ? 'Collapse workspace panel' : 'Expand workspace panel'}
              >
                {isWorkspacePaneOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
              <button className="text-btn flex items-center justify-center w-6 h-6 p-0" onClick={onWorkspaceCreate} title="New Workspace"><Plus size={16} /></button>
            </div>
          </div>
          <div className="workspace-search-container">
            <input type="text" placeholder="Search workspaces..." className="workspace-search-input" value={workspaceSearch} onChange={(e) => onWorkspaceSearchChange(e.target.value)} />
          </div>
          <div className="workspace-pane-list">
            {filteredWorkspaces.length > 0 ? filteredWorkspaces.map((workspace) => {
              const index = workspaceList.findIndex((ws) => ws.id === workspace.id);
              const count = workspace.counts?.total ?? workspace.sessions ?? 0;
              return (
                <button key={workspace.id} className={`workspace-pane-item ${index === workspaceIndex ? 'is-active' : ''}`} onClick={() => onWorkspaceSelect(index)}>
                  <div className="workspace-tree-node">
                    <ChevronRight size={12} className="tree-chevron" />
                    <Folder size={14} className="tree-icon" />
                    <span className="workspace-pane-name">{workspace.name}</span>
                    <span className="workspace-count-badge">{count}</span>
                  </div>
                </button>
              );
            }) : (
              <div className="workspace-pane-empty">
                <div className="eyebrow">Server data</div>
                <div className="text-sm opacity-70">
                  {isWorkspaceLoading ? 'Loading workspaces from server...' : workspaceSearch ? 'No workspaces match this search.' : 'No workspaces returned from the server.'}
                </div>
              </div>
            )}
          </div>
        </aside>

        {children}

        <aside className="rail rail-right">
          <div className="rail-group">{rightRailItems.map((item) => (<button key={item.id} type="button" className={`nav-item ${item.active ? 'is-active' : ''}`} onClick={item.action} title={item.label} aria-label={item.label}><span className="nav-icon">{item.icon}</span></button>))}</div>
          <div className="rail-spacer" />
        </aside>
      </div>

      <BottomBar workspaces={workspaceList} sessions={workspaceSessions} />
    </div>
  );
}
