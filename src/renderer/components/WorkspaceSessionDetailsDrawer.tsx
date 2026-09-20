import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Cpu, FileCode, FileDiff, FileText, Gauge, HardDrive, Layers, Search, ShieldCheck } from 'lucide-react';
import type { Artifact, Note, Session, SessionFileStatus } from '../data';
import { SessionConversation } from './SessionConversation';
import type { SessionConversationMessage, SessionFileGroup } from '../services/sessionAdapters';

type SessionStat = {
  label: string;
  value: string | number;
};

type WorkspaceSessionDetailsDrawerProps = {
  open: boolean;
  workspaceName: string;
  session: Session | null;
  stats: SessionStat[];
  files?: SessionFileGroup;
  conversation: SessionConversationMessage[];
  notes: Note[];
  artifacts: Artifact[];
  onSelectNote: (note: Note) => void;
  onBack: () => void;
  onClose: () => void;
};

const MODEL_PALETTE = ['#22d3ee', '#a855f7', '#34d399', '#f59e0b', '#f43f5e', '#3b82f6'];

export function WorkspaceSessionDetailsDrawer({
  open,
  workspaceName,
  session,
  stats,
  files,
  conversation,
  notes,
  artifacts,
  onSelectNote,
  onBack,
  onClose,
}: WorkspaceSessionDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'files' | 'notes' | 'artifacts'>('overview');
  const [fileFilter, setFileFilter] = useState<'all' | 'modified' | 'created' | 'deleted' | 'transcript'>('all');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

  const toggleDiff = (path: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const selectedArtifactKinds = useMemo(
    () => ({
      file: artifacts.filter((artifact) => artifact.kind === 'file'),
      jira: artifacts.filter((artifact) => artifact.kind === 'jira'),
      mr: artifacts.filter((artifact) => artifact.kind === 'merge-request'),
    }),
    [artifacts],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (open) setActiveTab('overview');
  }, [open, session?.id]);

  // Merge all file sources (fileStats from rollout and files from fileGroup)
  const allFilesList = useMemo(() => {
    const map = new Map<string, SessionFileStatus>();

    // 1. Files from session.fileStats (parsed from patch_apply_end)
    (session?.fileStats ?? []).forEach((fs) => {
      map.set(fs.path, { ...fs });
    });

    // 2. Files from files prop (SessionFileGroup)
    (files?.files ?? []).forEach((f) => {
      const p = f.path ?? f.name ?? '';
      if (!p) return;
      if (!map.has(p)) {
        map.set(p, {
          path: p,
          name: f.name || p.split('/').pop() || p,
          status: (f.status as any) || (f.category === 'transcript' ? 'transcript' : 'read'),
          linesAdded: f.linesAdded,
          linesRemoved: f.linesRemoved,
          diff: f.diff,
          size: f.size,
        });
      }
    });

    return Array.from(map.values());
  }, [session?.fileStats, files?.files]);

  const fileMetrics = useMemo(() => {
    let modified = 0;
    let created = 0;
    let deleted = 0;
    let transcript = 0;
    let totalAdded = 0;
    let totalRemoved = 0;

    allFilesList.forEach((f) => {
      if (f.status === 'modified') modified++;
      else if (f.status === 'created') created++;
      else if (f.status === 'deleted') deleted++;
      else if (f.status === 'transcript') transcript++;

      totalAdded += f.linesAdded || 0;
      totalRemoved += f.linesRemoved || 0;
    });

    return {
      total: allFilesList.length,
      modified,
      created,
      deleted,
      transcript,
      totalAdded,
      totalRemoved,
    };
  }, [allFilesList]);

  const filteredFiles = useMemo(() => {
    return allFilesList.filter((f) => {
      if (fileFilter === 'modified' && f.status !== 'modified') return false;
      if (fileFilter === 'created' && f.status !== 'created') return false;
      if (fileFilter === 'deleted' && f.status !== 'deleted') return false;
      if (fileFilter === 'transcript' && f.status !== 'transcript') return false;

      if (fileSearchQuery.trim()) {
        const q = fileSearchQuery.toLowerCase();
        if (!f.path.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [allFilesList, fileFilter, fileSearchQuery]);

  // Models used calculation
  const modelsUsed = useMemo(() => {
    if (session?.modelsUsed && session.modelsUsed.length > 0) {
      return session.modelsUsed;
    }
    if (session?.model) {
      return [{ model: session.model, turns: 1, percent: 100 }];
    }
    return [];
  }, [session?.modelsUsed, session?.model]);

  // Conversation breakdown
  const conversationCounts = useMemo(() => {
    return conversation.reduce(
      (acc, message) => {
        acc[message.kind] = (acc[message.kind] ?? 0) + 1;
        return acc;
      },
      {} as Record<SessionConversationMessage['kind'], number>,
    );
  }, [conversation]);

  const totalConversation = conversation.length || 1;
  const chartItems = [
    { label: 'User', value: conversationCounts.user ?? 0, tone: 'yellow' },
    { label: 'Assistant', value: conversationCounts.assistant ?? 0, tone: 'green' },
    { label: 'Tool', value: conversationCounts.tool ?? 0, tone: 'cyan' },
    { label: 'System', value: conversationCounts.system ?? 0, tone: 'grey' },
  ] as const;

  if (!open || !session) return null;

  return (
    <div className="activity-drawer-backdrop" onClick={onClose}>
      <aside className="knowledge-drawer session-details-drawer" onClick={(event) => event.stopPropagation()} aria-label="Workspace session details">
        {/* Head */}
        <div className="workspace-drawer-head">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="ghost-btn icon-only"
              aria-label="Back to sessions"
              title="Back to sessions"
              onClick={onBack}
            >
              <span aria-hidden="true">←</span>
            </button>
            <div className="min-w-0">
              <h2 className="brand-title !text-base !tracking-wider truncate">{session.title}</h2>
              <div className="workspace-drawer-subtitle truncate">
                {workspaceName} · {session.provider} · {session.model} · {session.agentType || 'cli'}
              </div>
            </div>
          </div>
          <button className="text-btn action-close icon-only" aria-label="Close" title="Close" onClick={onClose}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Tabbar */}
        <div className="session-tabbar">
          {[
            ['overview', 'Overview'],
            ['chat', `Chat (${conversation.length})`],
            ['files', `Files (${allFilesList.length})`],
            ['notes', `Notes (${notes.length})`],
            ['artifacts', `Artifacts (${artifacts.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`session-tab ${activeTab === id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(id as typeof activeTab)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={`workspace-drawer-body session-details-drawer-body session-details-tab-${activeTab}`}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' ? (
            <div className="session-overview-layout space-y-4">
              {/* 1. Different Models & Percent Used */}
              <section className="session-detail-card p-4 rounded-md border border-cyan-500/20 bg-slate-900/60">
                <div className="eyebrow flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Cpu size={14} /> Different Models & Usage Breakdown
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {modelsUsed.length} model{modelsUsed.length === 1 ? '' : 's'} recorded
                  </span>
                </div>

                {/* Stacked multi-model percentage bar */}
                {modelsUsed.length > 0 && (
                  <div className="mt-3 mb-3">
                    <div className="h-3.5 w-full bg-black/50 rounded-full overflow-hidden flex border border-white/10">
                      {modelsUsed.map((mu, i) => {
                        const color = MODEL_PALETTE[i % MODEL_PALETTE.length];
                        return (
                          <div
                            key={mu.model}
                            style={{ width: `${Math.max(4, mu.percent)}%`, backgroundColor: color }}
                            className="h-full transition-all relative group"
                            title={`${mu.model}: ${mu.percent}% (${mu.turns} turns)`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Individual Model Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-2">
                  {modelsUsed.map((mu, i) => {
                    const color = MODEL_PALETTE[i % MODEL_PALETTE.length];
                    return (
                      <div
                        key={mu.model}
                        className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col justify-between gap-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-mono font-bold text-slate-200 truncate" title={mu.model}>
                              {mu.model}
                            </span>
                          </div>
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ backgroundColor: `${color}22`, color }}
                          >
                            {mu.percent}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>Usage share</span>
                          <span>{mu.turns} turn{mu.turns === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2. Token Count & Context Window Usage */}
              {session.tokenUsage && (
                <section className="session-detail-card p-4 rounded-md border border-cyan-500/20 bg-slate-900/60">
                  <div className="eyebrow flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Gauge size={14} /> Token Count & Context Window
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                      {session.tokenUsage.contextPercentUsed}% Context Used
                    </span>
                  </div>

                  {/* Context Window Progress Bar */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Context Window Capacity</span>
                      <span className="text-slate-200 font-bold">
                        {(session.tokenUsage.inputTokens + session.tokenUsage.outputTokens).toLocaleString()} / {session.tokenUsage.contextWindow.toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all ${
                          session.tokenUsage.contextPercentUsed > 80
                            ? 'bg-rose-500'
                            : session.tokenUsage.contextPercentUsed > 50
                            ? 'bg-amber-500'
                            : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, session.tokenUsage.contextPercentUsed))}%` }}
                      />
                    </div>
                  </div>

                  {/* Token Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                    <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Total Tokens</span>
                      <strong className="text-sm font-mono text-cyan-300 mt-1">
                        {session.tokenUsage.totalTokens.toLocaleString()}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Input Tokens</span>
                      <strong className="text-sm font-mono text-slate-200 mt-1">
                        {session.tokenUsage.inputTokens.toLocaleString()}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Cached Input</span>
                      <strong className="text-sm font-mono text-emerald-300 mt-1">
                        {session.tokenUsage.cachedInputTokens.toLocaleString()}
                        {session.tokenUsage.inputTokens > 0 && (
                          <span className="text-[10px] text-emerald-400/80 ml-1 font-normal">
                            ({Math.round((session.tokenUsage.cachedInputTokens / session.tokenUsage.inputTokens) * 100)}%)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Output / Reasoning</span>
                      <strong className="text-sm font-mono text-indigo-300 mt-1">
                        {session.tokenUsage.outputTokens.toLocaleString()}
                        {session.tokenUsage.reasoningTokens > 0 && (
                          <span className="text-[10px] text-indigo-400/80 ml-1 font-normal">
                            ({session.tokenUsage.reasoningTokens.toLocaleString()} rsn)
                          </span>
                        )}
                      </strong>
                    </div>
                  </div>

                  {/* Rate Limits if present */}
                  {session.rateLimits && (
                    <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-2 bg-black/40 border border-white/10 rounded flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-slate-400">5-Hour Rate Limit Window</span>
                          <span className="text-xs font-mono font-bold text-slate-200">{session.rateLimits.primaryPercent}% Used</span>
                        </div>
                        <div className="w-20 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-cyan-400"
                            style={{ width: `${Math.min(100, Math.max(3, session.rateLimits.primaryPercent))}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-2 bg-black/40 border border-white/10 rounded flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-slate-400">7-Day Rate Limit Window</span>
                          <span className="text-xs font-mono font-bold text-slate-200">{session.rateLimits.secondaryPercent}% Used</span>
                        </div>
                        <div className="w-20 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-purple-400"
                            style={{ width: `${Math.min(100, Math.max(3, session.rateLimits.secondaryPercent))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 3. Files Status & Usage Summary */}
              <section className="session-detail-card p-4 rounded-md border border-cyan-500/20 bg-slate-900/60">
                <div className="eyebrow flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <FileDiff size={14} /> Files Status & Usage
                  </span>
                  <button
                    type="button"
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
                    onClick={() => setActiveTab('files')}
                  >
                    View all {fileMetrics.total} files →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                    <span className="text-[10px] font-mono text-amber-400 uppercase">Modified</span>
                    <strong className="text-sm font-mono text-amber-300 mt-1">{fileMetrics.modified}</strong>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">Created</span>
                    <strong className="text-sm font-mono text-emerald-300 mt-1">{fileMetrics.created}</strong>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                    <span className="text-[10px] font-mono text-rose-400 uppercase">Deleted</span>
                    <strong className="text-sm font-mono text-rose-300 mt-1">{fileMetrics.deleted}</strong>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 flex flex-col">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase">Lines Changed</span>
                    <strong className="text-sm font-mono text-slate-200 mt-1">
                      +{fileMetrics.totalAdded} / -{fileMetrics.totalRemoved}
                    </strong>
                  </div>
                </div>
              </section>

              {/* Session Stats */}
              <section className="session-detail-card p-4 rounded-md border border-cyan-500/20 bg-slate-900/60">
                <div className="eyebrow mb-2">Session stats</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {stats.map((stat) => (
                    <div key={stat.label} className="p-2 rounded bg-black/40 border border-white/10 flex flex-col">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{stat.label}</span>
                      <strong className="text-sm font-mono text-cyan-300 mt-1">{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Conversation Mix */}
              <section className="session-detail-card">
                <div className="eyebrow">Conversation mix</div>
                <div className="session-chart-stack">
                  {chartItems.map((item) => {
                    const width = `${Math.max(8, Math.round((item.value / totalConversation) * 100))}%`;
                    return (
                      <div key={item.label} className="session-chart-row">
                        <div className="session-chart-label">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                        <div className={`session-chart-track session-chart-${item.tone}`}>
                          <div className="session-chart-fill" style={{ width }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 5. Session Map & Info */}
              <section className="session-detail-card">
                <div className="eyebrow">Session map</div>
                <div className="session-tree-view">
                  <div className="session-tree-node is-root">{workspaceName}</div>
                  <div className="session-tree-connector" />
                  <div className="session-tree-node">{session.provider}</div>
                  <div className="session-tree-connector" />
                  <div className="session-tree-node">{session.model}</div>
                  <div className="session-tree-connector" />
                  <div className="session-tree-node">{session.tree}</div>
                </div>
              </section>

              <section className="session-detail-card">
                <div className="eyebrow">Session info</div>
                <div className="session-detail-grid">
                  <div><span>ID</span><strong>{session.id}</strong></div>
                  <div><span>Workspace</span><strong>{session.workspaceId}</strong></div>
                  <div><span>Updated</span><strong>{session.updated || session.updatedAt || 'server'}</strong></div>
                  <div><span>Created</span><strong>{session.createdAt || 'server'}</strong></div>
                  <div><span>Provider</span><strong>{session.provider}</strong></div>
                  <div><span>Agent type</span><strong>{session.agentType || 'not reported'}</strong></div>
                  <div><span>Tokens</span><strong>{session.tokenUsage ? session.tokenUsage.totalTokens.toLocaleString() : 'not reported'}</strong></div>
                  <div><span>Context Used</span><strong>{session.tokenUsage ? `${session.tokenUsage.contextPercentUsed}%` : '0%'}</strong></div>
                </div>
              </section>
            </div>
          ) : null}

          {/* CHAT TAB */}
          {activeTab === 'chat' ? (
            <section className="session-detail-card session-scroll-card p-4">
              <div className="eyebrow mb-3 flex items-center justify-between">
                <span>Full Chat Transcript</span>
                <span className="font-mono text-xs text-slate-400">{conversation.length} message{conversation.length === 1 ? '' : 's'}</span>
              </div>
              <SessionConversation messages={conversation} />
            </section>
          ) : null}

          {/* FILES TAB */}
          {activeTab === 'files' ? (
            <section className="session-detail-card session-scroll-card p-4 flex flex-col gap-3">
              {/* Filter & Search Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {(
                    [
                      ['all', `All (${fileMetrics.total})`],
                      ['modified', `Modified (${fileMetrics.modified})`],
                      ['created', `Created (${fileMetrics.created})`],
                      ['deleted', `Deleted (${fileMetrics.deleted})`],
                      ['transcript', `Transcript (${fileMetrics.transcript})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                        fileFilter === key
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
                      }`}
                      onClick={() => setFileFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filter files..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="px-2.5 py-1 bg-black/40 border border-white/10 rounded text-xs text-slate-200 placeholder:text-slate-500 font-mono w-48 focus:outline-none focus:border-cyan-500/50"
                  />
                  {fileSearchQuery && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-200 font-mono"
                      onClick={() => setFileSearchQuery('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Files List with Status & Diffs */}
              <div className="space-y-2.5 mt-1">
                {filteredFiles.length === 0 ? (
                  <div className="activity-empty py-8 text-center text-slate-500 font-mono text-xs">
                    {allFilesList.length === 0 ? 'No session files recorded.' : 'No files matched your filter.'}
                  </div>
                ) : (
                  filteredFiles.map((file) => {
                    const isExpanded = expandedDiffs[file.path] ?? false;
                    const hasDiff = Boolean(file.diff);

                    return (
                      <div
                        key={file.path}
                        className="p-3 bg-black/40 border border-white/10 rounded-md flex flex-col gap-2 transition-colors hover:border-white/20"
                      >
                        {/* File Row Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCode size={14} className="text-cyan-400 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-mono font-semibold text-slate-200 truncate" title={file.path}>
                                {file.name || file.path}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 truncate" title={file.path}>
                                {file.path}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status Badge */}
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                                file.status === 'created'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                  : file.status === 'deleted'
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                                  : file.status === 'modified'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                                  : 'bg-purple-950/60 text-purple-300 border border-purple-500/40'
                              }`}
                            >
                              {file.status}
                            </span>

                            {/* Lines added/removed */}
                            {(Boolean(file.linesAdded) || Boolean(file.linesRemoved)) && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-slate-300 border border-white/10">
                                <span className="text-emerald-400">+{file.linesAdded || 0}</span>
                                <span className="text-slate-500 mx-1">/</span>
                                <span className="text-rose-400">-{file.linesRemoved || 0}</span>
                              </span>
                            )}

                            {/* Diff toggle button */}
                            {hasDiff && (
                              <button
                                type="button"
                                className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 transition-colors"
                                onClick={() => toggleDiff(file.path)}
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span>{isExpanded ? 'Hide Diff' : 'View Diff'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Diff Content Preview */}
                        {hasDiff && isExpanded && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <pre className="p-3 bg-black/70 border border-cyan-500/20 rounded text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96 leading-snug whitespace-pre">
                              {file.diff!.split('\n').map((line, li) => {
                                const isAdd = line.startsWith('+') && !line.startsWith('+++');
                                const isRem = line.startsWith('-') && !line.startsWith('---');
                                const isHead = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                                return (
                                  <div
                                    key={li}
                                    className={
                                      isAdd
                                        ? 'bg-emerald-950/40 text-emerald-300'
                                        : isRem
                                        ? 'bg-rose-950/40 text-rose-300'
                                        : isHead
                                        ? 'text-cyan-400 font-semibold'
                                        : 'text-slate-300'
                                    }
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {/* NOTES TAB */}
          {activeTab === 'notes' ? (
            <section className="session-detail-card session-scroll-card">
              <div className="workspace-drawer-head session-tab-head">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-cyan-400" />
                  <div>
                    <div className="eyebrow">Notes</div>
                    <div className="workspace-drawer-subtitle">{notes.length} notes · session scope</div>
                  </div>
                </div>
              </div>
              {notes.length > 0 ? (
                <div className="notes-drawer-grid">
                  {notes.map((note) => (
                    <button key={note.id} type="button" className="note-drawer-card" onClick={() => onSelectNote(note)}>
                      <div className="note-drawer-title">{note.title}</div>
                      <div className="note-drawer-meta">{note.createdAt || 'server'}</div>
                      <p>{note.body}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-empty">No notes found for this session.</div>
              )}
            </section>
          ) : null}

          {/* ARTIFACTS TAB */}
          {activeTab === 'artifacts' ? (
            <section className="session-detail-card session-scroll-card">
              <div className="eyebrow">Artifacts</div>
              <div className="session-detail-grid">
                <div><span>Total</span><strong>{artifacts.length}</strong></div>
                <div><span>Files</span><strong>{selectedArtifactKinds.file.length}</strong></div>
                <div><span>Jira</span><strong>{selectedArtifactKinds.jira.length}</strong></div>
                <div><span>Merge requests</span><strong>{selectedArtifactKinds.mr.length}</strong></div>
              </div>
              {artifacts.length > 0 ? (
                <div className="session-detail-stack">
                  {artifacts.map((artifact) => (
                    <div key={artifact.id} className="management-drawer-row">
                      <div className="flex flex-col min-w-0 flex-1">
                        <strong className="truncate">{artifact.title}</strong>
                        <span className="text-xs opacity-60 truncate">{artifact.kind}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="activity-empty">No artifacts linked to this session.</div>
              )}
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
