import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Bot,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  X,
  Workflow
} from 'lucide-react';
import {
  COLOSSEUM_PROVIDERS,
  validatePipelineChain,
  type AgentConfig,
  type Pipeline,
  type ColosseumRegistry,
} from '../../../electron/colosseumStore';

type ColosseumPipelinesViewProps = {
  pushToast: (title: string, detail: string, tone?: 'good' | 'warning' | 'muted') => void;
};

export function ColosseumPipelinesView({ pushToast }: ColosseumPipelinesViewProps) {
  const [registry, setRegistry] = useState<ColosseumRegistry>({ agents: {}, pipelines: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected pipeline for editing/viewing
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // Agent editing modal
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentDraft, setAgentDraft] = useState<AgentConfig>({
    id: '',
    name: '',
    prompt: '',
    persona: 'coder',
    tag: 'v1',
    provider: 'codex',
    model: 'gpt-4o',
    pickup_location: 'ready',
    working_location: 'in-progress',
    drop_location: 'review',
  });

  // Pipeline editing modal / form
  const [pipelineDraft, setPipelineDraft] = useState<Pipeline | null>(null);

  const loadRegistry = async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.sanctum?.getColosseumRegistry) {
        const data = await window.sanctum.getColosseumRegistry();
        setRegistry(data);
        if (!selectedPipelineId && Object.keys(data.pipelines).length > 0) {
          const firstId = Object.keys(data.pipelines)[0];
          setSelectedPipelineId(firstId);
          setPipelineDraft(data.pipelines[firstId]);
        }
      } else {
        setError('Colosseum IPC not available in this environment');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Colosseum registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegistry();
  }, []);

  const selectPipeline = (id: string) => {
    setSelectedPipelineId(id);
    setPipelineDraft(registry.pipelines[id] ? JSON.parse(JSON.stringify(registry.pipelines[id])) : null);
  };

  const openNewPipeline = () => {
    const newId = `pipeline-${Date.now().toString(36)}`;
    const newPipe: Pipeline = {
      id: newId,
      name: 'New Pipeline',
      agent_ids: [],
    };
    setSelectedPipelineId(newId);
    setPipelineDraft(newPipe);
  };

  const openNewAgent = () => {
    setAgentDraft({
      id: `agent-${Date.now().toString(36)}`,
      name: '',
      prompt: '',
      persona: 'coder',
      tag: 'v1',
      provider: 'codex',
      model: 'gpt-4o',
      pickup_location: 'ready',
      working_location: 'in-progress',
      drop_location: 'review',
    });
    setIsAgentModalOpen(true);
  };

  const editAgent = (agent: AgentConfig) => {
    setAgentDraft({ ...agent });
    setIsAgentModalOpen(true);
  };

  const cloneAgent = (agent: AgentConfig) => {
    const cloneId = `${agent.id}-clone-${Date.now().toString(36).slice(-4)}`;
    setAgentDraft({
      ...agent,
      id: cloneId,
      name: `${agent.name} (Copy)`,
    });
    setIsAgentModalOpen(true);
  };

  const deleteAgent = async (agentId: string) => {
    // Check if agent is attached to any pipeline
    const attachedPipelines = Object.values(registry.pipelines).filter((p) =>
      p.agent_ids.includes(agentId)
    );
    if (attachedPipelines.length > 0) {
      pushToast(
        'Cannot Delete Agent',
        `Agent is attached to pipeline(s): ${attachedPipelines.map((p) => p.name).join(', ')}. Remove from pipeline first.`,
        'warning'
      );
      return;
    }

    const updatedAgents = { ...registry.agents };
    delete updatedAgents[agentId];
    const newRegistry = { ...registry, agents: updatedAgents };

    try {
      const res = await window.sanctum.saveColosseumRegistry(newRegistry);
      if (res.success) {
        setRegistry(newRegistry);
        pushToast('Agent Deleted', `Agent ${agentId} removed from registry.`, 'good');
      } else {
        pushToast('Delete Failed', res.errors?.join('; ') || 'Could not delete agent', 'warning');
      }
    } catch (err: any) {
      pushToast('Error', err?.message || 'Failed to delete agent', 'warning');
    }
  };

  const saveAgent = async () => {
    if (!agentDraft.name.trim()) {
      pushToast('Validation Error', 'Agent name is required.', 'warning');
      return;
    }
    if (!agentDraft.pickup_location.trim() || !agentDraft.drop_location.trim()) {
      pushToast('Validation Error', 'Pickup and drop locations are required.', 'warning');
      return;
    }

    const updatedAgents = {
      ...registry.agents,
      [agentDraft.id]: { ...agentDraft },
    };
    const newRegistry = { ...registry, agents: updatedAgents };

    try {
      const res = await window.sanctum.saveColosseumRegistry(newRegistry);
      if (res.success) {
        setRegistry(newRegistry);
        setIsAgentModalOpen(false);
        pushToast('Agent Saved', `Agent "${agentDraft.name}" saved to library.`, 'good');
      } else {
        pushToast('Save Failed', res.errors?.join('; ') || 'Validation error', 'warning');
      }
    } catch (err: any) {
      pushToast('Save Error', err?.message || 'Could not save agent', 'warning');
    }
  };

  // Pipeline builder actions
  const addAgentToPipeline = (agentId: string) => {
    if (!pipelineDraft) return;
    setPipelineDraft({
      ...pipelineDraft,
      agent_ids: [...pipelineDraft.agent_ids, agentId],
    });
  };

  const removeAgentFromPipeline = (index: number) => {
    if (!pipelineDraft) return;
    const nextIds = [...pipelineDraft.agent_ids];
    nextIds.splice(index, 1);
    setPipelineDraft({
      ...pipelineDraft,
      agent_ids: nextIds,
    });
  };

  const moveAgent = (index: number, direction: 'up' | 'down') => {
    if (!pipelineDraft) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pipelineDraft.agent_ids.length) return;
    const nextIds = [...pipelineDraft.agent_ids];
    const temp = nextIds[index];
    nextIds[index] = nextIds[targetIndex];
    nextIds[targetIndex] = temp;
    setPipelineDraft({
      ...pipelineDraft,
      agent_ids: nextIds,
    });
  };

  // Live chain validation for the pipeline draft
  const chainValidation = useMemo(() => {
    if (!pipelineDraft) return { valid: true, errors: [] };
    return validatePipelineChain(pipelineDraft, registry.agents);
  }, [pipelineDraft, registry.agents]);

  const savePipeline = async () => {
    if (!pipelineDraft) return;
    if (!pipelineDraft.name.trim()) {
      pushToast('Validation Error', 'Pipeline name is required.', 'warning');
      return;
    }
    if (pipelineDraft.agent_ids.length === 0) {
      pushToast('Validation Error', 'Pipeline must contain at least one agent.', 'warning');
      return;
    }

    if (!chainValidation.valid) {
      pushToast('Invalid Pipeline Chain', chainValidation.errors.join('; '), 'warning');
      return;
    }

    const updatedPipelines = {
      ...registry.pipelines,
      [pipelineDraft.id]: { ...pipelineDraft },
    };
    const newRegistry = { ...registry, pipelines: updatedPipelines };

    try {
      const res = await window.sanctum.saveColosseumRegistry(newRegistry);
      if (res.success) {
        setRegistry(newRegistry);
        setSelectedPipelineId(pipelineDraft.id);
        pushToast('Pipeline Saved', `Pipeline "${pipelineDraft.name}" saved to registry.`, 'good');
      } else {
        pushToast('Save Failed', res.errors?.join('; ') || 'Validation error', 'warning');
      }
    } catch (err: any) {
      pushToast('Save Error', err?.message || 'Could not save pipeline', 'warning');
    }
  };

  const deletePipeline = async (id: string) => {
    const pipelineName = registry.pipelines[id]?.name || id;
    if (!window.confirm(`Are you sure you want to delete pipeline "${pipelineName}"?`)) {
      return;
    }

    const updatedPipelines = { ...registry.pipelines };
    delete updatedPipelines[id];
    const newRegistry = { ...registry, pipelines: updatedPipelines };

    try {
      const res = await window.sanctum.saveColosseumRegistry(newRegistry);
      if (res.success) {
        setRegistry(newRegistry);
        if (selectedPipelineId === id) {
          const remainingIds = Object.keys(updatedPipelines);
          setSelectedPipelineId(remainingIds[0] || null);
          setPipelineDraft(remainingIds[0] ? updatedPipelines[remainingIds[0]] : null);
        }
        pushToast('Pipeline Deleted', `Pipeline "${pipelineName}" removed.`, 'good');
      } else {
        pushToast('Delete Failed', res.errors?.join('; ') || 'Could not delete pipeline', 'warning');
      }
    } catch (err: any) {
      pushToast('Error', err?.message || 'Failed to delete pipeline', 'warning');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Workflow size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-wide">Colosseum Pipeline Designer</h1>
            <p className="text-xs text-white/50">Author agent pipelines with automatic chain validation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRegistry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={openNewAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 rounded-md border border-cyan-500/30 transition-colors"
          >
            <Bot size={13} /> New Agent
          </button>
          <button
            type="button"
            onClick={openNewPipeline}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 rounded-md border border-emerald-500/30 transition-colors"
          >
            <Plus size={13} /> New Pipeline
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-rose-950/50 border border-rose-500/40 rounded-lg text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main split grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Pipelines list and Agent library */}
        <div className="col-span-4 border-r border-white/10 flex flex-col h-full overflow-hidden bg-slate-900/30">
          {/* Pipelines tab */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Pipelines ({Object.keys(registry.pipelines).length})</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
              {Object.keys(registry.pipelines).length === 0 ? (
                <div className="text-xs text-white/40 italic p-2 border border-dashed border-white/10 rounded">No pipelines created yet. Click "+ New Pipeline" above.</div>
              ) : (
                Object.values(registry.pipelines).map((p) => {
                  const isSelected = selectedPipelineId === p.id;
                  const validation = validatePipelineChain(p, registry.agents);
                  return (
                    <div
                      key={p.id}
                      onClick={() => selectPipeline(p.id)}
                      className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors border ${
                        isSelected
                          ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-200 font-medium'
                          : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers size={13} className={isSelected ? 'text-cyan-400' : 'text-white/40'} />
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-white/40 font-mono">({p.agent_ids.length} stages)</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {validation.valid ? (
                          <CheckCircle2 size={12} className="text-emerald-400" title="Valid chain" />
                        ) : (
                          <AlertTriangle size={12} className="text-amber-400" title="Broken chain or validation error" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deletePipeline(p.id);
                          }}
                          className="text-white/30 hover:text-rose-400 p-0.5 rounded transition-colors"
                          title="Delete pipeline"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Agent Library */}
          <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Agent Library ({Object.keys(registry.agents).length})</span>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              {Object.keys(registry.agents).length === 0 ? (
                <div className="text-xs text-white/40 italic p-2 border border-dashed border-white/10 rounded">No agents registered. Click "+ New Agent" above.</div>
              ) : (
                Object.values(registry.agents).map((agent) => (
                  <div
                    key={agent.id}
                    className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs flex flex-col gap-1.5 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot size={13} className="text-cyan-400" />
                        <span className="font-semibold text-white">{agent.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-white/10 rounded text-cyan-300">
                          {agent.provider}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => cloneAgent(agent)}
                          className="p-1 text-white/40 hover:text-white rounded"
                          title="Clone agent"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editAgent(agent)}
                          className="p-1 text-white/40 hover:text-cyan-300 rounded"
                          title="Edit agent"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteAgent(agent.id)}
                          className="p-1 text-white/40 hover:text-rose-400 rounded"
                          title="Delete agent"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-white/50 font-mono">
                      <span>Model: {agent.model}</span>
                      <span>•</span>
                      <span>Persona: {agent.persona}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-300/80 bg-black/30 p-1.5 rounded">
                      <span>{agent.pickup_location}</span>
                      <ArrowRight size={10} className="text-white/30" />
                      <span>{agent.drop_location}</span>
                    </div>

                    {pipelineDraft && (
                      <button
                        type="button"
                        onClick={() => addAgentToPipeline(agent.id)}
                        className="mt-1 w-full py-1 text-[11px] text-center bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 rounded border border-cyan-500/20 font-medium transition-colors"
                      >
                        + Add to pipeline
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Pipeline Builder & Chain Inspector */}
        <div className="col-span-8 flex flex-col h-full overflow-hidden bg-slate-950">
          {pipelineDraft ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Pipeline header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-white/50">Pipeline Name:</label>
                  <input
                    type="text"
                    value={pipelineDraft.name}
                    onChange={(e) => setPipelineDraft({ ...pipelineDraft, name: e.target.value })}
                    className="px-3 py-1 bg-black/40 border border-white/15 rounded text-sm text-white font-medium focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. Full Feature Development"
                  />
                  <span className="text-[10px] text-white/40 font-mono">ID: {pipelineDraft.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={savePipeline}
                    disabled={!chainValidation.valid}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                      chainValidation.valid
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 cursor-pointer shadow-sm'
                        : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                    }`}
                  >
                    Save Pipeline
                  </button>
                </div>
              </div>

              {/* Chain validation banner */}
              {!chainValidation.valid && (
                <div className="mx-6 mt-4 p-3 bg-amber-950/50 border border-amber-500/40 rounded-lg text-amber-200 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                    <AlertTriangle size={14} /> Chain Validation Errors (Must fix before saving)
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 font-mono text-[11px]">
                    {chainValidation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Visual Chain Flow */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                  Pipeline Execution Stages ({pipelineDraft.agent_ids.length})
                </div>

                {pipelineDraft.agent_ids.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-white/10 rounded-xl text-center text-xs text-white/40 flex flex-col items-center justify-center gap-2">
                    <Layers size={24} className="text-white/20" />
                    <span>No agents in this pipeline yet.</span>
                    <span>Click "+ Add to pipeline" on any agent from the library on the left.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {pipelineDraft.agent_ids.map((agentId, index) => {
                      const agent = registry.agents[agentId];
                      const nextAgentId = pipelineDraft.agent_ids[index + 1];
                      const nextAgent = nextAgentId ? registry.agents[nextAgentId] : null;

                      const isChainBroken =
                        nextAgent &&
                        agent &&
                        agent.drop_location.trim().toLowerCase() !== nextAgent.pickup_location.trim().toLowerCase();

                      return (
                        <React.Fragment key={`${agentId}-${index}`}>
                          {/* Stage Card */}
                          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-mono font-bold text-xs">
                                {index + 1}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white text-sm">{agent ? agent.name : agentId}</span>
                                  {agent && (
                                    <span className="text-[10px] font-mono uppercase bg-cyan-950 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded">
                                      {agent.provider} / {agent.model}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-white/50 mt-1">
                                  Persona: <span className="text-white/80 font-mono">{agent?.persona || 'none'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Node routing pill */}
                            {agent && (
                              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 font-mono text-xs">
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] uppercase text-white/40">Pickup</span>
                                  <span className="text-cyan-400 font-semibold">{agent.pickup_location}</span>
                                </div>
                                <ArrowRight size={14} className="text-white/30 mx-1" />
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] uppercase text-white/40">Drop</span>
                                  <span className="text-emerald-400 font-semibold">{agent.drop_location}</span>
                                </div>
                              </div>
                            )}

                            {/* Reorder and remove buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveAgent(index, 'up')}
                                className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 rounded"
                                title="Move stage up"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={index === pipelineDraft.agent_ids.length - 1}
                                onClick={() => moveAgent(index, 'down')}
                                className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 rounded"
                                title="Move stage down"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAgentFromPipeline(index)}
                                className="p-1.5 text-white/40 hover:text-rose-400 rounded"
                                title="Remove stage from pipeline"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Inter-stage connection indicator */}
                          {nextAgent && (
                            <div className="flex items-center justify-center py-1">
                              {isChainBroken ? (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono">
                                  <AlertTriangle size={12} className="text-rose-400 animate-pulse" />
                                  <span>Broken Chain: '{agent.drop_location}' ≠ '{nextAgent.pickup_location}'</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
                                  <span>Connected: '{agent.drop_location}'</span>
                                </div>
                              )}
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-xs gap-2">
              <Layers size={32} className="text-white/20" />
              <span>Select a pipeline from the list on the left or create a new one.</span>
            </div>
          )}
        </div>
      </div>

      {/* Agent Editing Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/15 rounded-xl w-full max-w-xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Bot size={16} className="text-cyan-400" />
                {agentDraft.id in registry.agents ? 'Edit Agent' : 'Create Agent'}
              </h2>
              <button
                type="button"
                onClick={() => setIsAgentModalOpen(false)}
                className="text-white/40 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-white/60">Agent Name *</span>
                <input
                  type="text"
                  value={agentDraft.name}
                  onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })}
                  placeholder="e.g. Coder Specialist"
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-white/60">Provider *</span>
                <select
                  value={agentDraft.provider}
                  onChange={(e) => setAgentDraft({ ...agentDraft, provider: e.target.value })}
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {COLOSSEUM_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-white/60">Model *</span>
                <input
                  type="text"
                  value={agentDraft.model}
                  onChange={(e) => setAgentDraft({ ...agentDraft, model: e.target.value })}
                  placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-white/60">Persona</span>
                <input
                  type="text"
                  value={agentDraft.persona}
                  onChange={(e) => setAgentDraft({ ...agentDraft, persona: e.target.value })}
                  placeholder="coder, reviewer, merger"
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-white/60">Tag</span>
                <input
                  type="text"
                  value={agentDraft.tag}
                  onChange={(e) => setAgentDraft({ ...agentDraft, tag: e.target.value })}
                  placeholder="v1, beta"
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-white/60">Pickup Location *</span>
                <input
                  type="text"
                  value={agentDraft.pickup_location}
                  onChange={(e) => setAgentDraft({ ...agentDraft, pickup_location: e.target.value })}
                  placeholder="ready, review, approved"
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-white/60">Drop Location *</span>
                <input
                  type="text"
                  value={agentDraft.drop_location}
                  onChange={(e) => setAgentDraft({ ...agentDraft, drop_location: e.target.value })}
                  placeholder="review, approved, done"
                  className="px-3 py-1.5 bg-black/40 border border-white/15 rounded text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-white/60">Prompt *</span>
                <textarea
                  rows={4}
                  value={agentDraft.prompt}
                  onChange={(e) => setAgentDraft({ ...agentDraft, prompt: e.target.value })}
                  placeholder="Describe agent responsibilities and execution instructions..."
                  className="px-3 py-2 bg-black/40 border border-white/15 rounded text-white font-mono focus:outline-none focus:border-cyan-500 resize-none text-[11px]"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setIsAgentModalOpen(false)}
                className="px-4 py-1.5 rounded text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAgent}
                className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
              >
                Save Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
