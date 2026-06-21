type WorkspaceHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  workspaceColor?: string | null;
  workspacePriority?: string;
  workspaceStatus?: string;
  facts: string[];
  showFacts?: boolean;
  showActions?: boolean;
  onEdit?: () => void;
  onAddNote: () => void;
  onOpenKnowledge: () => void;
  onOpenActivity: () => void;
};

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  workspaceColor,
  workspacePriority,
  workspaceStatus,
  facts,
  showFacts = true,
  showActions = true,
  onEdit,
  onAddNote,
  onOpenKnowledge,
  onOpenActivity,
}: WorkspaceHeaderProps) {
  const priorityTone = (workspacePriority ?? '').toLowerCase();
  const statusTone = (workspaceStatus ?? '').toLowerCase();
  return (
    <section className="hero-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="workspace-header-title-row">
            <h1 style={workspaceColor ? { color: workspaceColor } : undefined}>{title}</h1>
            {(workspacePriority || workspaceStatus) ? (
              <div className="workspace-header-meta">
                {workspacePriority ? <span className={`workspace-header-pill workspace-header-pill-${priorityTone}`}>{workspacePriority}</span> : null}
                {workspaceStatus ? <span className={`workspace-header-pill workspace-header-pill-${statusTone}`}>{workspaceStatus}</span> : null}
              </div>
            ) : null}
          </div>
          {subtitle ? <p className="hero-copy">{subtitle}</p> : null}
        </div>
        {(onEdit || showActions) ? (
          <div className="panel-actions">
            {onEdit ? (
              <button className="ghost-btn icon-only" aria-label="Edit workspace" title="Edit workspace" onClick={onEdit}>
                <span aria-hidden="true">✎</span>
              </button>
            ) : null}
            {showActions ? (
              <>
                <button className="ghost-btn icon-only" aria-label="Add note" title="Add note" onClick={onAddNote}>
                  <span aria-hidden="true">+</span>
                </button>
                <button className="ghost-btn" onClick={onOpenKnowledge}>Knowledge</button>
                <button className="ghost-btn" onClick={onOpenActivity}>Activity</button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {showFacts && facts.length > 0 && <div className="fact-strip">{facts.map((fact) => <span key={fact} className="fact-pill">{fact}</span>)}</div>}
    </section>
  );
}
