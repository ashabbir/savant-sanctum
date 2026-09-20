import { useMemo, useState } from 'react';
import { Bot, Check, ChevronDown, ChevronRight, Copy, Cpu, FileDiff, MessageSquare, Sparkles, Terminal, User, Wrench } from 'lucide-react';
import type { SessionConversationMessage } from '../services/sessionAdapters';

type SessionConversationProps = {
  messages: SessionConversationMessage[];
};

type FilterKind = 'all' | 'user' | 'assistant' | 'tool' | 'patch' | 'reasoning' | 'system';

export function SessionConversation({ messages }: SessionConversationProps) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleOutput = (id: string) => {
    setExpandedOutputs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure in restricted web contexts
    }
  };

  const counts = useMemo(() => {
    const result = {
      all: messages.length,
      user: 0,
      assistant: 0,
      tool: 0,
      patch: 0,
      reasoning: 0,
      system: 0,
    };
    messages.forEach((m) => {
      if (m.kind === 'user') result.user++;
      else if (m.kind === 'assistant') result.assistant++;
      else if (m.role === 'patch') result.patch++;
      else if (m.kind === 'tool') result.tool++;
      else if (m.role === 'reasoning') result.reasoning++;
      else result.system++;
    });
    return result;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filter === 'user' && m.kind !== 'user') return false;
      if (filter === 'assistant' && m.kind !== 'assistant') return false;
      if (filter === 'tool' && (m.kind !== 'tool' || m.role === 'patch')) return false;
      if (filter === 'patch' && m.role !== 'patch') return false;
      if (filter === 'reasoning' && m.role !== 'reasoning') return false;
      if (filter === 'system' && (m.kind !== 'system' || m.role === 'reasoning')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inDetail = (m.detail || '').toLowerCase().includes(q);
        const inTitle = (m.title || '').toLowerCase().includes(q);
        const inTool = (m.toolName || '').toLowerCase().includes(q);
        const inDiff = (m.diff || '').toLowerCase().includes(q);
        if (!inDetail && !inTitle && !inTool && !inDiff) return false;
      }
      return true;
    });
  }, [messages, filter, searchQuery]);

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ['all', `All (${counts.all})`],
              ['user', `User (${counts.user})`],
              ['assistant', `Assistant (${counts.assistant})`],
              ['tool', `Tools (${counts.tool})`],
              ['patch', `Patches (${counts.patch})`],
              ['reasoning', `Reasoning (${counts.reasoning})`],
              ['system', `System (${counts.system})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                filter === key
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2.5 py-1 bg-black/40 border border-white/10 rounded text-xs text-slate-200 placeholder:text-slate-500 font-mono w-44 focus:outline-none focus:border-cyan-500/50"
          />
          {searchQuery && (
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-200 font-mono"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages List */}
      <div className="chat-transcript space-y-3 pr-1 max-h-[600px] overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="activity-empty py-8 text-center text-slate-500 font-mono text-xs">
            {messages.length === 0 ? 'No conversation history available for this session.' : 'No messages matched your filter.'}
          </div>
        ) : (
          filteredMessages.map((message) => {
            const isTool = message.kind === 'tool';
            const isPatch = message.role === 'patch';
            const isReasoning = message.role === 'reasoning';
            const isUser = message.kind === 'user';
            const isAssistant = message.kind === 'assistant';
            const isTokenCount = message.role === 'token_count';
            const isExpanded = expandedOutputs[message.id] ?? false;

            return (
              <article
                key={message.id}
                className={`chat-transcript-item chat-transcript-${message.kind} rounded-md border p-3 transition-colors ${
                  isUser
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : isAssistant
                    ? 'bg-emerald-950/20 border-emerald-500/25'
                    : isPatch
                    ? 'bg-indigo-950/25 border-indigo-500/30'
                    : isTool
                    ? 'bg-cyan-950/20 border-cyan-500/25'
                    : isReasoning
                    ? 'bg-purple-950/20 border-purple-500/25'
                    : 'bg-slate-900/40 border-white/10'
                }`}
              >
                {/* Message Header */}
                <div className="chat-transcript-head flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    {isUser && <User size={13} className="text-amber-400 shrink-0" />}
                    {isAssistant && <Bot size={13} className="text-emerald-400 shrink-0" />}
                    {isPatch && <FileDiff size={13} className="text-indigo-400 shrink-0" />}
                    {isTool && !isPatch && <Terminal size={13} className="text-cyan-400 shrink-0" />}
                    {isReasoning && <Sparkles size={13} className="text-purple-400 shrink-0" />}
                    {isTokenCount && <Cpu size={13} className="text-cyan-300 shrink-0" />}

                    <span className="font-semibold text-xs text-slate-200 truncate">{message.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
                      {message.role || message.kind}
                    </span>
                    {message.model && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                        {message.model}
                      </span>
                    )}
                    {message.status && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        message.status === 'success' || message.status === 'completed'
                          ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-950/50 text-rose-300 border border-rose-500/30'
                      }`}>
                        {message.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400">{message.time || message.provider}</span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                      title="Copy message text"
                      aria-label="Copy message text"
                      onClick={() => handleCopy(message.id, message.diff || message.detail)}
                    >
                      {copiedId === message.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                {isPatch ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">{message.detail}</div>
                    {message.diff && (
                      <div className="mt-1">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                          onClick={() => toggleOutput(message.id)}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>{isExpanded ? 'Hide unified diff' : 'Show unified diff'}</span>
                        </button>
                        {isExpanded && (
                          <pre className="mt-1.5 p-2.5 bg-black/50 border border-indigo-500/30 rounded text-[11px] font-mono text-slate-300 overflow-x-auto max-h-80 leading-snug whitespace-pre">
                            {message.diff.split('\n').map((line, li) => {
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
                        )}
                      </div>
                    )}
                  </div>
                ) : isTool ? (
                  <div className="flex flex-col gap-2 mt-1">
                    {/* Tool Input/Command */}
                    <div className="p-2 bg-black/40 border border-white/5 rounded">
                      <div className="text-[10px] font-mono uppercase text-cyan-400 font-semibold mb-1 flex items-center gap-1">
                        <Wrench size={10} /> Tool Invocation
                      </div>
                      <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-48">
                        {message.toolInput || message.detail}
                      </pre>
                    </div>

                    {/* Tool Output if available */}
                    {message.toolOutput && (
                      <div>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                          onClick={() => toggleOutput(message.id)}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>{isExpanded ? 'Hide output' : 'Show output'}</span>
                        </button>
                        {isExpanded && (
                          <pre className="mt-1.5 p-2.5 bg-black/60 border border-cyan-500/25 rounded text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 leading-snug whitespace-pre-wrap">
                            {message.toolOutput}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ) : isReasoning ? (
                  <div className="mt-1">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-[11px] font-mono text-purple-400 hover:text-purple-300 transition-colors mb-1"
                      onClick={() => toggleOutput(message.id)}
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>{isExpanded ? 'Hide thought process' : 'View thought process'}</span>
                    </button>
                    {isExpanded && (
                      <div className="p-2.5 bg-purple-950/30 border border-purple-500/25 rounded text-xs font-mono text-purple-200 whitespace-pre-wrap leading-relaxed">
                        {message.detail}
                      </div>
                    )}
                  </div>
                ) : isTokenCount ? (
                  <div className="p-2 bg-cyan-950/20 border border-cyan-500/20 rounded font-mono text-xs text-cyan-200 leading-relaxed flex items-center gap-2">
                    <Cpu size={14} className="text-cyan-400 shrink-0" />
                    <span>{message.detail}</span>
                  </div>
                ) : (
                  <p className="chat-transcript-detail text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                    {message.detail}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
