/**
 * Hermes session store access.
 *
 * Hermes keeps every session for a profile in a single SQLite database at
 * `~/.hermes/profiles/<profile>/state.db` (plus a legacy top-level
 * `~/.hermes/state.db`). The `messages` table is shared by all sessions in that
 * database, so every read MUST be filtered by `session_id`, otherwise opening
 * one session surfaces the whole profile history.
 *
 * All access here is read-only. The functions take an already-opened database
 * handle (anything exposing better-sqlite3's `prepare().all()/get()` shape) so
 * they can be unit tested without the Electron native module.
 */

export type SqlStatement = {
  all: (...params: any[]) => any[];
  get: (...params: any[]) => any;
};

export type SqlDatabase = {
  prepare: (sql: string) => SqlStatement;
  close?: () => void;
};

export type HermesMessageRow = {
  id?: number;
  role?: string;
  content?: string;
  tool_name?: string;
  timestamp?: number;
  token_count?: number;
  reasoning?: string;
};

export type HermesSessionStats = {
  messageCount: number;
  tokenCount: number;
  apiCallCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  models: string[];
};

export type HermesSessionMetadata = {
  sessionId: string;
  source?: string;
  model?: string;
  displayName?: string;
  parentSessionId?: string;
  startedAt?: number;
  endedAt?: number;
  endReason?: string;
  messageCount?: number;
  stats: HermesSessionStats;
};

/** Paths that look like a Hermes state DB but must never be opened. */
const HERMES_DB_SKIP = /(\.bak$|\.tmp$|-shm$|-wal$|-journal$)/i;

/**
 * Deterministically enumerate the Hermes databases worth inspecting.
 *
 * Order: profile databases (alphabetical by profile) first, then the legacy
 * top-level database. Backups, snapshots and SQLite sidecar files are skipped.
 */
export function listHermesDatabases(
  hermesDir: string,
  fsLike: {
    readdirSync: (dir: string, options: { withFileTypes: true }) => Array<{ name: string; isDirectory: () => boolean }>;
    existsSync: (target: string) => boolean;
  },
  join: (...parts: string[]) => string,
): string[] {
  const candidates: string[] = [];

  let profiles: string[] = [];
  try {
    profiles = fsLike
      .readdirSync(join(hermesDir, 'profiles'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    // No profiles directory: older Hermes layouts only have the top-level DB.
  }

  for (const profile of profiles) {
    const dbPath = join(hermesDir, 'profiles', profile, 'state.db');
    if (!HERMES_DB_SKIP.test(dbPath) && fsLike.existsSync(dbPath)) candidates.push(dbPath);
  }

  const legacy = join(hermesDir, 'state.db');
  if (fsLike.existsSync(legacy)) candidates.push(legacy);

  return candidates;
}

function tableNames(db: SqlDatabase): string[] {
  try {
    return (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>)
      .map((row) => String(row.name));
  } catch {
    return [];
  }
}

/** True when this database actually holds the requested session. */
export function databaseHasSession(db: SqlDatabase, sessionId: string): boolean {
  const names = tableNames(db);
  try {
    if (names.includes('sessions')) {
      const row = db.prepare('SELECT id FROM sessions WHERE id = ? LIMIT 1').get(sessionId);
      if (row) return true;
    }
    if (names.includes('messages')) {
      const row = db.prepare('SELECT 1 AS ok FROM messages WHERE session_id = ? LIMIT 1').get(sessionId);
      if (row) return true;
    }
  } catch {
    // Schema drift between Hermes versions: treat as "not here" and move on.
  }
  return false;
}

function hasColumn(db: SqlDatabase, table: string, column: string): boolean {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>;
    return rows.some((row) => String(row?.name ?? '') === column);
  } catch {
    return false;
  }
}

/**
 * Read the messages belonging to exactly one session.
 *
 * Compacted messages (`active = 0`, `compacted = 1`) are summarised away by
 * Hermes and would resurface as duplicates, so the active rows are preferred.
 * If a session has no active rows left, all of its rows are returned so the
 * conversation is not silently empty.
 */
export function readHermesMessages(db: SqlDatabase, sessionId: string): HermesMessageRow[] {
  const sid = String(sessionId || '').trim();
  if (!sid) return [];
  if (!tableNames(db).includes('messages')) return [];

  const columns = 'id, role, content, tool_name, timestamp, token_count, reasoning';
  if (hasColumn(db, 'messages', 'active')) {
    const active = db
      .prepare(`SELECT ${columns} FROM messages WHERE session_id = ? AND active = 1 ORDER BY id ASC`)
      .all(sid) as HermesMessageRow[];
    if (active.length) return active;
  }
  return db
    .prepare(`SELECT ${columns} FROM messages WHERE session_id = ? ORDER BY id ASC`)
    .all(sid) as HermesMessageRow[];
}

const EMPTY_STATS: HermesSessionStats = {
  messageCount: 0,
  tokenCount: 0,
  apiCallCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  estimatedCostUsd: 0,
  models: [],
};

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown) => {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
};

/** Per-session counters derived from `messages` and `session_model_usage`. */
export function readHermesSessionStats(db: SqlDatabase, sessionId: string): HermesSessionStats {
  const sid = String(sessionId || '').trim();
  if (!sid) return { ...EMPTY_STATS };
  const names = tableNames(db);
  const stats: HermesSessionStats = { ...EMPTY_STATS, models: [] };

  if (names.includes('messages')) {
    try {
      const activeClause = hasColumn(db, 'messages', 'active') ? ' AND active = 1' : '';
      const row = db
        .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(token_count), 0) AS tokens FROM messages WHERE session_id = ?${activeClause}`)
        .get(sid) as { count?: number; tokens?: number } | undefined;
      stats.messageCount = num(row?.count);
      stats.tokenCount = num(row?.tokens);
    } catch {
      // Counters are best effort.
    }
  }

  if (names.includes('session_model_usage')) {
    try {
      const rows = db
        .prepare(
          `SELECT model, api_call_count, input_tokens, output_tokens, reasoning_tokens,
                  cache_read_tokens, cache_write_tokens, estimated_cost_usd
             FROM session_model_usage WHERE session_id = ?`,
        )
        .all(sid) as Array<Record<string, any>>;
      const models = new Set<string>();
      for (const row of rows) {
        const model = text(row.model);
        if (model) models.add(model);
        stats.apiCallCount += num(row.api_call_count);
        stats.inputTokens += num(row.input_tokens);
        stats.outputTokens += num(row.output_tokens);
        stats.reasoningTokens += num(row.reasoning_tokens);
        stats.cacheReadTokens += num(row.cache_read_tokens);
        stats.cacheWriteTokens += num(row.cache_write_tokens);
        stats.estimatedCostUsd += num(row.estimated_cost_usd);
      }
      stats.models = Array.from(models).sort();
    } catch {
      // Usage accounting is optional.
    }
  }

  return stats;
}

/** Session row plus derived statistics, or null when the session is absent. */
export function readHermesSessionMetadata(db: SqlDatabase, sessionId: string): HermesSessionMetadata | null {
  const sid = String(sessionId || '').trim();
  if (!sid) return null;
  const stats = readHermesSessionStats(db, sid);

  let row: Record<string, any> | undefined;
  if (tableNames(db).includes('sessions')) {
    try {
      row = db
        .prepare(
          `SELECT id, source, model, display_name, parent_session_id, started_at, ended_at, end_reason, message_count
             FROM sessions WHERE id = ? LIMIT 1`,
        )
        .get(sid) as Record<string, any> | undefined;
    } catch {
      row = undefined;
    }
  }

  if (!row) {
    if (!stats.messageCount) return null;
    return { sessionId: sid, stats };
  }

  return {
    sessionId: sid,
    source: text(row.source),
    model: text(row.model) ?? stats.models[0],
    displayName: text(row.display_name),
    parentSessionId: text(row.parent_session_id),
    startedAt: row.started_at == null ? undefined : num(row.started_at),
    endedAt: row.ended_at == null ? undefined : num(row.ended_at),
    endReason: text(row.end_reason),
    messageCount: row.message_count == null ? stats.messageCount : num(row.message_count),
    stats,
  };
}

/** Map a Hermes role/tool row onto Sanctum's conversation message kinds. */
export function hermesMessageKind(row: HermesMessageRow): 'user' | 'assistant' | 'tool' | 'system' {
  const role = String(row?.role ?? '').toLowerCase();
  if (role.includes('tool')) return 'tool';
  if (role.includes('user') || role === 'human') return 'user';
  if (role.includes('system') || role.includes('developer')) return 'system';
  return 'assistant';
}

/** Human-readable body for a Hermes message row. */
export function hermesMessageDetail(row: HermesMessageRow): string {
  const content = String(row?.content ?? '').trim();
  if (content) return content;
  const reasoning = String(row?.reasoning ?? '').trim();
  if (reasoning) return reasoning;
  const toolName = String(row?.tool_name ?? '').trim();
  return toolName ? `[${toolName}]` : '';
}
