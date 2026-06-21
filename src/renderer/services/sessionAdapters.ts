import type { Session } from '../data';

export type SessionFileGroup = {
  session_id?: string;
  id?: string;
  provider?: string;
  summary?: string;
  file_count?: number;
  filePath?: string;
  file_path?: string;
  files?: { path?: string; name?: string; category?: string; size?: number }[];
};

export type ServerSession = Record<string, any>;

export type SessionConversationMessage = {
  id: string;
  time: string;
  kind: 'user' | 'assistant' | 'tool' | 'system';
  role: string;
  title: string;
  detail: string;
  provider: string;
};

type NormalizedSession = Session;

type SessionAdapter = {
  provider: string;
  displayName: string;
  normalizeSession: (raw: ServerSession, workspaceId: string, fileGroup?: SessionFileGroup) => NormalizedSession | null;
  conversationPath: (sessionId: string) => string | null;
  normalizeConversation: (payload: unknown, sessionId: string) => SessionConversationMessage[];
  transcriptPath: (raw: ServerSession, fileGroup?: SessionFileGroup) => string | null;
  normalizeConversationText: (rawText: string, sessionId: string) => SessionConversationMessage[];
};

const providerDisplayNames: Record<string, string> = {
  copilot: 'Copilot',
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  agy: 'AGY',
  savant: 'Savant',
};

function formatSessionUpdated(value?: string) {
  if (!value) return 'server';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function readText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => readText(item)).filter(Boolean).join('\n');
  }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return String(record.text ?? record.content ?? record.message ?? record.value ?? record.output ?? '').trim();
}

function readTimestamp(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  if (!text) return '';
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? text : new Date(timestamp).toISOString();
}

function buildSessionTree(provider: string, sessionId: string, fileGroup?: SessionFileGroup) {
  const files = (fileGroup?.files ?? [])
    .slice(0, provider === 'savant' ? 4 : 3)
    .map((file) => file.path ?? file.name)
    .filter(Boolean);

  if (files.length > 0) {
    if (provider === 'codex') return files.join(' -> ');
    if (provider === 'claude') return files.join(' / ');
    if (provider === 'gemini') return files.join(' • ');
    if (provider === 'savant') return files.join(' · ');
    return files.join(' -> ');
  }

  return `${provider} -> ${sessionId}`;
}

function buildConversationPath(provider: string, sessionId: string) {
  return `/api/${provider}/session/${encodeURIComponent(sessionId)}/conversation`;
}

function cleanPath(value?: string) {
  return String(value ?? '').trim();
}

function normalizeProviderKey(value?: string) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeProviderAlias(value?: string) {
  const key = normalizeProviderKey(value);
  if (key === 'agt') return 'agy';
  if (key === 'copilot-chat' || key === 'github-copilot') return 'copilot';
  if (key === 'claude-code' || key === 'anthropic') return 'claude';
  return key;
}

function inferProviderFromFiles(raw: ServerSession, fileGroup?: SessionFileGroup) {
  const files = [
    raw.filePath,
    raw.file_path,
    raw.path,
    fileGroup?.filePath,
    fileGroup?.file_path,
    ...(fileGroup?.files ?? []).flatMap((file) => [file.path, file.name]),
  ]
    .map(cleanPath)
    .filter(Boolean);

  if (files.some((file) => /rollout-.*\.jsonl$/i.test(file))) return 'codex';
  if (files.some((file) => /events\.jsonl$/i.test(file))) return 'copilot';
  if (files.some((file) => /session_[^/]+\.json$/i.test(file))) return 'savant';
  if (files.some((file) => /session-.*\.json$/i.test(file))) return 'gemini';
  if (files.some((file) => /claude/i.test(file))) return 'claude';
  if (files.some((file) => /agy/i.test(file))) return 'agy';

  return '';
}

export function inferSessionProvider(provider: string, raw: ServerSession, fileGroup?: SessionFileGroup) {
  const fileInference = inferProviderFromFiles(raw, fileGroup);
  if (fileInference) return fileInference;

  const explicit = normalizeProviderAlias(raw.provider ?? fileGroup?.provider ?? provider);
  if (explicit === 'copilot' || explicit === 'claude' || explicit === 'codex' || explicit === 'gemini' || explicit === 'savant' || explicit === 'agy' || explicit === 'agt') {
    return explicit;
  }

  return normalizeProviderAlias(provider) || 'savant';
}

function pickTranscriptPath(provider: string, raw: ServerSession, fileGroup?: SessionFileGroup) {
  const rawPath = cleanPath(raw.filePath ?? raw.file_path ?? raw.path ?? fileGroup?.filePath ?? fileGroup?.file_path);
  if (rawPath) return rawPath;
  const files = (fileGroup?.files ?? [])
    .map((file) => cleanPath(file.path ?? file.name))
    .filter(Boolean);
  if (files.length === 0) return null;

  const matches = (pattern: RegExp) => files.find((file) => pattern.test(file));
  if (provider === 'savant') {
    return matches(/^session_[^/]+\.json$/) ?? matches(/session_[^/]+\.json$/) ?? files[0];
  }
  if (provider === 'codex') {
    return matches(/rollout-.*\.jsonl$/) ?? matches(/\.jsonl$/) ?? files[0];
  }
  if (provider === 'claude') {
    return matches(/\.jsonl$/) ?? files[0];
  }
  if (provider === 'gemini') {
    return matches(/session-.*\.json$/) ?? matches(/\.jsonl$/) ?? matches(/\.json$/) ?? files[0];
  }
  if (provider === 'copilot') {
    return matches(/events\.jsonl$/) ?? matches(/\.jsonl$/) ?? files[0];
  }
  // agy/agt fallback
  return matches(/agy/i) ?? matches(/session-.*\.(jsonl|json|db)$/i) ?? matches(/\.(jsonl|json|db)$/i) ?? files[0];
}

function getConversationItems(payload: unknown): Record<string, any>[] {
  if (Array.isArray(payload)) return payload as Record<string, any>[];
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, any>;
  if (Array.isArray(record.conversation)) return record.conversation as Record<string, any>[];
  if (Array.isArray(record.messages)) return record.messages as Record<string, any>[];
  if (Array.isArray(record.entries)) return record.entries as Record<string, any>[];
  if (Array.isArray(record.data)) return record.data as Record<string, any>[];
  return [];
}

function readBlocksText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => readBlocksText(item)).filter(Boolean).join('\n');
  }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return String(record.text ?? record.content ?? record.message ?? record.output ?? record.result ?? '').trim();
}

function parseJSONL(rawText: string) {
  return rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line) as Record<string, any>;
    } catch {
      return null;
    }
  }).filter((value): value is Record<string, any> => Boolean(value));
}

function normalizeTranscriptEvents(provider: string, items: Record<string, any>[], sessionId: string) {
  const messages: SessionConversationMessage[] = [];
  items.forEach((entry, index) => {
    const rawType = String(entry.type ?? entry.kind ?? entry.event ?? entry.role ?? '').toLowerCase();
    const rawRole = String(entry.role ?? entry.data?.role ?? '').toLowerCase();
    const role = rawType.includes('user') || rawType === 'human' || rawRole === 'user' || rawRole === 'human' ? 'user'
      : rawType.includes('tool') || rawType.includes('function') || rawRole === 'tool' ? 'tool'
      : rawType.includes('system') || rawType.includes('meta') || rawRole === 'system' ? 'system'
      : rawType === 'message' && rawRole === 'user' ? 'user'
      : 'assistant';
    const kind = role === 'tool' ? 'tool' : role === 'system' ? 'system' : role === 'user' ? 'user' : 'assistant';
    const text = readBlocksText(
      entry.content ?? entry.text ?? entry.message ?? entry.output ?? entry.result ?? entry.data?.content ?? entry.data?.text ?? entry.data?.output ?? entry.data?.result,
    );
    const toolSources = [
      entry.toolRequests,
      entry.tool_requests,
      entry.toolCalls,
      entry.tool_calls,
      entry.data?.toolRequests,
      entry.data?.tool_requests,
      entry.data?.toolCalls,
      entry.data?.tool_calls,
    ];
    const toolNames = [
      ...(Array.isArray(toolSources[0]) ? toolSources[0] : []),
      ...(Array.isArray(toolSources[1]) ? toolSources[1] : []),
      ...(Array.isArray(toolSources[2]) ? toolSources[2] : []),
      ...(Array.isArray(toolSources[3]) ? toolSources[3] : []),
      ...(Array.isArray(toolSources[4]) ? toolSources[4] : []),
      ...(Array.isArray(toolSources[5]) ? toolSources[5] : []),
      ...(Array.isArray(toolSources[6]) ? toolSources[6] : []),
      ...(Array.isArray(toolSources[7]) ? toolSources[7] : []),
    ].map((request: any) => String(request.displayName ?? request.name ?? request.tool_name ?? request.toolName ?? '').trim()).filter(Boolean);
    const detail = [
      text,
      toolNames.length ? toolNames.join(' · ') : '',
      readBlocksText(entry.reasoning ?? entry.thoughts ?? entry.data?.reasoning),
    ].filter(Boolean).join('\n').trim();
    const id = String(entry.id ?? entry.messageID ?? entry.message_id ?? entry.call_id ?? `${sessionId}-${index}`);
    if (!detail && !text && kind === 'system') return;
    messages.push({
      id,
      time: readTimestamp(entry.timestamp ?? entry.createdAt ?? entry.created_at ?? entry.time ?? entry.date),
      kind,
      role,
      title: String(entry.title ?? entry.subject ?? entry.name ?? (kind === 'user' ? 'User' : kind === 'assistant' ? 'Assistant' : 'Tool')).trim() || 'Message',
      detail: detail || text || 'Message',
      provider,
    });
  });
  return messages;
}

function normalizeTranscriptText(provider: string, rawText: string, sessionId: string) {
  const text = rawText.trim();
  if (!text) return [];
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return normalizeTranscriptEvents(provider, parsed as Record<string, any>[], sessionId);
      }
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, any>;
        if (Array.isArray(record.messages)) return normalizeTranscriptEvents(provider, record.messages as Record<string, any>[], sessionId);
        if (Array.isArray(record.events)) return normalizeTranscriptEvents(provider, record.events as Record<string, any>[], sessionId);
        if (Array.isArray(record.conversation)) return normalizeTranscriptEvents(provider, record.conversation as Record<string, any>[], sessionId);
        if (Array.isArray(record.data)) return normalizeTranscriptEvents(provider, record.data as Record<string, any>[], sessionId);
        return normalizeTranscriptEvents(provider, [record], sessionId);
      }
    } catch {
      // fall through to JSONL parsing
    }
  }
  return normalizeTranscriptEvents(provider, parseJSONL(text), sessionId);
}

function normalizeConversationItem(provider: string, entry: Record<string, any>, index: number): SessionConversationMessage | null {
  const rawType = String(entry.type ?? entry.role ?? entry.kind ?? '').toLowerCase();
  const role = rawType.includes('user') || rawType === 'human' ? 'user' : rawType.includes('tool') ? 'tool' : rawType.includes('system') ? 'system' : 'assistant';
  const kind = role === 'tool' ? 'tool' : role === 'system' ? 'system' : role === 'user' ? 'user' : 'assistant';
  const text = readText(entry.content ?? entry.text ?? entry.message ?? entry.output ?? entry.result ?? entry.detail);
  const title = String(entry.title ?? entry.subject ?? entry.name ?? (kind === 'user' ? 'User' : kind === 'assistant' ? 'Assistant' : 'Tool')).trim() || (kind === 'user' ? 'User' : kind === 'assistant' ? 'Assistant' : 'Tool');
  const detailParts = [
    text,
    readText(entry.reasoning),
    readText(entry.thoughts),
  ].filter(Boolean);
  if (Array.isArray(entry.toolRequests) || Array.isArray(entry.tool_requests) || Array.isArray(entry.toolCalls) || Array.isArray(entry.tool_calls)) {
    const requests = (entry.toolRequests ?? entry.tool_requests ?? entry.toolCalls ?? entry.tool_calls ?? []) as Record<string, any>[];
    detailParts.push(requests.map((request) => `${String(request.displayName ?? request.name ?? request.tool_name ?? 'tool')}`).join(' · '));
  }
  const detail = detailParts.filter(Boolean).join('\n').trim();
  const id = String(entry.id ?? entry.messageID ?? entry.call_id ?? `${provider}-${index}`);
  if (!detail && !text && kind === 'system') return null;
  return {
    id,
    time: readTimestamp(entry.timestamp ?? entry.createdAt ?? entry.created_at ?? entry.time ?? entry.updatedAt),
    kind,
    role,
    title,
    detail: detail || text || title,
    provider,
  };
}

function normalizeConversation(provider: string, payload: unknown, sessionId: string) {
  return getConversationItems(payload)
    .map((entry, index) => normalizeConversationItem(provider, entry, index))
    .filter((message): message is SessionConversationMessage => Boolean(message))
    .map((message) => ({
      ...message,
      id: message.id || `${sessionId}-${message.kind}-${message.time || 'event'}`,
    }));
}

function normalizeWithProvider(provider: string, raw: ServerSession, workspaceId: string, fileGroup?: SessionFileGroup): NormalizedSession | null {
  const id = String(raw.id ?? raw.session_id ?? fileGroup?.session_id ?? fileGroup?.id ?? '').trim();
  if (!id) return null;

  const providerName = inferSessionProvider(provider, raw, fileGroup);
  const files = Number(fileGroup?.file_count ?? raw.file_count ?? raw.files ?? 0) || 0;
  const summary = String(raw.summary ?? raw.nickname ?? raw.title ?? fileGroup?.summary ?? id);
  const model = String(raw.model ?? raw.primary_model ?? raw.model_name ?? providerName);
  const updatedSource = raw.updated_at ?? raw.ended_at ?? raw.last_activity ?? raw.created_at ?? raw.started_at;

  return {
    id,
    workspaceId: String(raw.workspace_id ?? raw.workspace ?? workspaceId),
    title: summary,
    provider: providerDisplayNames[provider] ?? providerName.charAt(0).toUpperCase() + providerName.slice(1),
    model,
    createdAt: String(raw.created_at ?? raw.started_at ?? ''),
    updatedAt: String(raw.updated_at ?? raw.ended_at ?? raw.last_activity ?? raw.created_at ?? raw.started_at ?? ''),
    updated: formatSessionUpdated(String(updatedSource ?? '')),
    files,
    linked: files,
    notes: Number(raw.note_count ?? raw.notes ?? 0) || 0,
    jira: Number(raw.jira_count ?? raw.jira ?? 0) || 0,
    mergeRequests: Number(raw.merge_request_count ?? raw.merge_requests ?? raw.mrs ?? 0) || 0,
    tree: buildSessionTree(provider, id, fileGroup),
  };
}

const adapterRegistry: Record<string, SessionAdapter> = {
  copilot: {
    provider: 'copilot',
    displayName: 'Copilot',
    normalizeSession: (raw, workspaceId, fileGroup) => normalizeWithProvider('copilot', raw, workspaceId, fileGroup),
    conversationPath: (sessionId) => buildConversationPath('copilot', sessionId),
    normalizeConversation: (payload, sessionId) => normalizeConversation('copilot', payload, sessionId),
    transcriptPath: (raw, fileGroup) => pickTranscriptPath('copilot', raw, fileGroup),
    normalizeConversationText: (rawText, sessionId) => normalizeTranscriptText('copilot', rawText, sessionId),
  },
  claude: {
    provider: 'claude',
    displayName: 'Claude',
    normalizeSession: (raw, workspaceId, fileGroup) => normalizeWithProvider('claude', raw, workspaceId, fileGroup),
    conversationPath: (sessionId) => buildConversationPath('claude', sessionId),
    normalizeConversation: (payload, sessionId) => normalizeConversation('claude', payload, sessionId),
    transcriptPath: (raw, fileGroup) => pickTranscriptPath('claude', raw, fileGroup),
    normalizeConversationText: (rawText, sessionId) => normalizeTranscriptText('claude', rawText, sessionId),
  },
  codex: {
    provider: 'codex',
    displayName: 'Codex',
    normalizeSession: (raw, workspaceId, fileGroup) => normalizeWithProvider('codex', raw, workspaceId, fileGroup),
    conversationPath: () => null,
    normalizeConversation: (payload, sessionId) => normalizeConversation('codex', payload, sessionId),
    transcriptPath: (raw, fileGroup) => pickTranscriptPath('codex', raw, fileGroup),
    normalizeConversationText: (rawText, sessionId) => normalizeTranscriptText('codex', rawText, sessionId),
  },
  gemini: {
    provider: 'gemini',
    displayName: 'Gemini',
    normalizeSession: (raw, workspaceId, fileGroup) => normalizeWithProvider('gemini', raw, workspaceId, fileGroup),
    conversationPath: (sessionId) => buildConversationPath('gemini', sessionId),
    normalizeConversation: (payload, sessionId) => normalizeConversation('gemini', payload, sessionId),
    transcriptPath: (raw, fileGroup) => pickTranscriptPath('gemini', raw, fileGroup),
    normalizeConversationText: (rawText, sessionId) => normalizeTranscriptText('gemini', rawText, sessionId),
  },
  agy: {
    provider: 'agy',
    displayName: 'AGY',
    normalizeSession: (raw, workspaceId, fileGroup) => normalizeWithProvider('agy', raw, workspaceId, fileGroup),
    conversationPath: (sessionId) => buildConversationPath('agy', sessionId),
    normalizeConversation: (payload, sessionId) => normalizeConversation('agy', payload, sessionId),
    transcriptPath: (raw, fileGroup) => pickTranscriptPath('agy', raw, fileGroup),
    normalizeConversationText: (rawText, sessionId) => normalizeTranscriptText('agy', rawText, sessionId),
  },
  savant: {
    provider: 'savant',
    displayName: 'Savant',
    normalizeSession: (raw, workspaceId, fileGroup) => normalizeWithProvider('savant', raw, workspaceId, fileGroup),
    conversationPath: (sessionId) => buildConversationPath('savant', sessionId),
    normalizeConversation: (payload, sessionId) => normalizeConversation('savant', payload, sessionId),
    transcriptPath: (raw, fileGroup) => pickTranscriptPath('savant', raw, fileGroup),
    normalizeConversationText: (rawText, sessionId) => normalizeTranscriptText('savant', rawText, sessionId),
  },
};

export function getSessionAdapter(provider?: string) {
  const normalized = (provider ?? '').toLowerCase();
  if (normalized === 'agt') return adapterRegistry.agy;
  return adapterRegistry[normalized] ?? adapterRegistry.savant;
}
