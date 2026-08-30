import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  databaseHasSession,
  hermesMessageDetail,
  hermesMessageKind,
  listHermesDatabases,
  readHermesMessages,
  readHermesSessionMetadata,
  readHermesSessionStats,
  type SqlDatabase,
} from '../../../electron/hermesStore';

/**
 * Build an in-memory clone of the real Hermes schema (subset of the columns
 * Sanctum reads) holding two sessions, so cross-session leakage is observable.
 */
function makeHermesDb(): SqlDatabase {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, user_id TEXT, display_name TEXT,
      model TEXT, parent_session_id TEXT, started_at REAL NOT NULL, ended_at REAL,
      end_reason TEXT, message_count INTEGER DEFAULT 0
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, content TEXT,
      tool_name TEXT, timestamp REAL, token_count INTEGER, reasoning TEXT,
      active INTEGER NOT NULL DEFAULT 1, compacted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE session_model_usage (
      session_id TEXT NOT NULL, model TEXT NOT NULL, api_call_count INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0, estimated_cost_usd REAL NOT NULL DEFAULT 0
    );
  `);

  const session = raw.prepare('INSERT INTO sessions (id, source, display_name, model, started_at, ended_at, message_count) VALUES (?,?,?,?,?,?,?)');
  session.run('sess-a', 'tui', 'Session A', 'claude-opus-5', 1788110725.7, null, 3);
  session.run('sess-b', 'telegram', 'Session B', 'gpt-5.6-sol', 1788000000.0, 1788000500.0, 2);

  const message = raw.prepare('INSERT INTO messages (id, session_id, role, content, tool_name, timestamp, token_count, active, compacted) VALUES (?,?,?,?,?,?,?,?,?)');
  message.run(1, 'sess-a', 'user', 'hello from A', null, 1788110725.7, 5, 1, 0);
  message.run(2, 'sess-a', 'assistant', 'reply in A', null, 1788110726.7, 11, 1, 0);
  message.run(3, 'sess-a', 'tool', '', 'terminal', 1788110727.7, 2, 1, 0);
  message.run(4, 'sess-a', 'assistant', 'compacted away', null, 1788110720.0, 900, 0, 1);
  message.run(5, 'sess-b', 'user', 'SECRET FROM B', null, 1788000000.0, 7, 1, 0);
  message.run(6, 'sess-b', 'assistant', 'reply in B', null, 1788000001.0, 8, 1, 0);

  raw.prepare('INSERT INTO session_model_usage (session_id, model, api_call_count, input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens, estimated_cost_usd) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('sess-a', 'claude-opus-5', 3, 120, 400, 50, 900, 300, 0.25);

  return raw as unknown as SqlDatabase;
}

describe('hermes store session scoping', () => {
  it('returns only the requested session and never leaks other sessions', () => {
    const db = makeHermesDb();
    const messages = readHermesMessages(db, 'sess-a');
    expect(messages).toHaveLength(3);
    const bodies = messages.map((row) => String(row.content ?? ''));
    expect(bodies.join('|')).not.toContain('SECRET FROM B');
    expect(bodies.join('|')).not.toContain('reply in B');

    const other = readHermesMessages(db, 'sess-b');
    expect(other).toHaveLength(2);
    expect(other.map((row) => row.content)).toEqual(['SECRET FROM B', 'reply in B']);
  });

  it('excludes compacted messages so summarised turns do not duplicate', () => {
    const db = makeHermesDb();
    const bodies = readHermesMessages(db, 'sess-a').map((row) => row.content);
    expect(bodies).not.toContain('compacted away');
  });

  it('orders messages by id and returns nothing for unknown or blank ids', () => {
    const db = makeHermesDb();
    expect(readHermesMessages(db, 'sess-a').map((row) => row.id)).toEqual([1, 2, 3]);
    expect(readHermesMessages(db, 'does-not-exist')).toEqual([]);
    expect(readHermesMessages(db, '  ')).toEqual([]);
  });

  it('binds the session id as a parameter instead of interpolating it', () => {
    const seen: Array<{ sql: string; params: any[] }> = [];
    const fake: SqlDatabase = {
      prepare: (sql: string) => ({
        all: (...params: any[]) => {
          seen.push({ sql, params });
          if (/sqlite_master/.test(sql)) return [{ name: 'messages' }];
          if (/table_info/.test(sql)) return [{ name: 'active' }];
          return [];
        },
        get: () => undefined,
      }),
    };
    readHermesMessages(fake, "sess-a'; DROP TABLE messages; --");
    const queries = seen.filter((entry) => /FROM messages/.test(entry.sql));
    expect(queries.length).toBeGreaterThan(0);
    for (const entry of queries) {
      expect(entry.sql).toContain('session_id = ?');
      expect(entry.sql).not.toContain('DROP TABLE');
      expect(entry.params).toEqual(["sess-a'; DROP TABLE messages; --"]);
    }
  });

  it('detects which database owns a session', () => {
    const db = makeHermesDb();
    expect(databaseHasSession(db, 'sess-a')).toBe(true);
    expect(databaseHasSession(db, 'sess-missing')).toBe(false);
  });
});

describe('hermes store metadata and statistics', () => {
  it('reports session fields and scoped token statistics', () => {
    const db = makeHermesDb();
    const meta = readHermesSessionMetadata(db, 'sess-a');
    expect(meta).toMatchObject({
      sessionId: 'sess-a',
      source: 'tui',
      model: 'claude-opus-5',
      displayName: 'Session A',
      messageCount: 3,
      startedAt: 1788110725.7,
    });
    expect(meta?.endedAt).toBeUndefined();
    // Only the three active messages count: 5 + 11 + 2.
    expect(meta?.stats.tokenCount).toBe(18);
    expect(meta?.stats).toMatchObject({
      messageCount: 3,
      apiCallCount: 3,
      inputTokens: 120,
      outputTokens: 400,
      reasoningTokens: 50,
      cacheReadTokens: 900,
      cacheWriteTokens: 300,
      models: ['claude-opus-5'],
    });
    expect(meta?.stats.estimatedCostUsd).toBeCloseTo(0.25);
  });

  it('keeps statistics per session and returns null for unknown sessions', () => {
    const db = makeHermesDb();
    expect(readHermesSessionStats(db, 'sess-b')).toMatchObject({
      messageCount: 2,
      tokenCount: 15,
      apiCallCount: 0,
      models: [],
    });
    expect(readHermesSessionMetadata(db, 'sess-missing')).toBeNull();
  });
});

describe('hermes database enumeration', () => {
  const fsLike = (paths: string[], profiles: string[]) => ({
    readdirSync: (dir: string) => {
      if (!dir.endsWith('profiles')) throw new Error('ENOENT');
      return profiles.map((name) => ({ name, isDirectory: () => true }));
    },
    existsSync: (target: string) => paths.includes(target),
  });
  const join = (...parts: string[]) => parts.join('/');

  it('lists profile databases alphabetically then the legacy database', () => {
    const paths = [
      '/h/profiles/software-engineer/state.db',
      '/h/profiles/code-reviewer/state.db',
      '/h/state.db',
    ];
    expect(listHermesDatabases('/h', fsLike(paths, ['software-engineer', 'code-reviewer']) as any, join)).toEqual([
      '/h/profiles/code-reviewer/state.db',
      '/h/profiles/software-engineer/state.db',
      '/h/state.db',
    ]);
  });

  it('never returns backups, snapshots or sqlite sidecar files', () => {
    const paths = ['/h/profiles/a/state.db', '/h/state.db'];
    const result = listHermesDatabases('/h', fsLike(paths, ['a']) as any, join);
    expect(result).toEqual(['/h/profiles/a/state.db', '/h/state.db']);
    for (const entry of result) {
      expect(entry).not.toMatch(/\.bak$|state-snapshots|-shm$|-wal$/);
    }
  });

  it('falls back to the legacy database when no profiles directory exists', () => {
    expect(listHermesDatabases('/h', fsLike(['/h/state.db'], []) as any, join)).toEqual(['/h/state.db']);
  });
});

describe('hermes message mapping', () => {
  it('maps roles onto sanctum message kinds', () => {
    expect(hermesMessageKind({ role: 'user' })).toBe('user');
    expect(hermesMessageKind({ role: 'tool' })).toBe('tool');
    expect(hermesMessageKind({ role: 'system' })).toBe('system');
    expect(hermesMessageKind({ role: 'assistant' })).toBe('assistant');
    expect(hermesMessageKind({})).toBe('assistant');
  });

  it('falls back to reasoning then tool name for empty content', () => {
    expect(hermesMessageDetail({ content: 'body' })).toBe('body');
    expect(hermesMessageDetail({ content: '', reasoning: 'thinking' })).toBe('thinking');
    expect(hermesMessageDetail({ content: '', tool_name: 'terminal' })).toBe('[terminal]');
    expect(hermesMessageDetail({})).toBe('');
  });
});
