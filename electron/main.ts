import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAVANT_DIR = path.join(os.homedir(), '.savant');
const SANCTUM_DB_PATH = path.join(SAVANT_DIR, 'sanctum.db');
const CODEX_DIR = path.join(os.homedir(), '.codex');
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const COPILOT_DIR = path.join(os.homedir(), '.copilot');
const GEMINI_DIR = path.join(os.homedir(), '.gemini');
const AGY_DIR = path.join(os.homedir(), '.agy');
const CODEX_HISTORY_PATH = path.join(CODEX_DIR, 'history.jsonl');
const CODEX_LOGS_PATH = path.join(CODEX_DIR, 'logs_2.sqlite');
const COPILOT_SESSION_DB_PATH = path.join(COPILOT_DIR, 'session-store.db');

let db: any;
let codexLogsDb: any;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

type RunAgentPayload = {
  prompt?: string;
  chain?: Array<{ provider: string; model?: string }>;
  cwd?: string;
  sessionId?: string;
};

async function initDb() {
  await fs.mkdir(SAVANT_DIR, { recursive: true });
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  db = new Database(SANCTUM_DB_PATH);
  try {
    codexLogsDb = new Database(CODEX_LOGS_PATH, { readonly: true, fileMustExist: true });
  } catch {
    codexLogsDb = null;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const defaults = [
    ['server:config', JSON.stringify({ url: 'http://127.0.0.1:8090', enabled: true })],
    ['gateway:config', JSON.stringify({ url: 'http://127.0.0.1:3100', enabled: true })],
  ] as const;

  for (const [key, value] of defaults) {
    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO NOTHING
    `).run(key, value);
  }
}

function readSetting<T>(key: string, fallback: T): T {
  if (!db) return fallback;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as T;
  }
}

function normalizeBaseUrl(value: unknown, fallback: string) {
  const raw = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'url' in value
      ? String((value as { url?: string }).url || '')
      : '';
  return (raw.trim() || fallback).replace(/\/+$/, '');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LocalConversationMessage = {
  id: string;
  time: string;
  kind: 'user' | 'assistant' | 'tool' | 'system';
  role: string;
  title: string;
  detail: string;
  provider: string;
};

function toIsoTime(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return '';
}

function parseJsonLine<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}

function readEscapedText(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function makeMessage(provider: string, sessionId: string, kind: LocalConversationMessage['kind'], index: number, time: string, detail: string): LocalConversationMessage {
  return {
    id: `${provider}-${sessionId}-${kind}-${index}`,
    time,
    kind,
    role: kind,
    title: kind === 'user' ? 'User' : kind === 'assistant' ? 'Assistant' : kind === 'tool' ? 'Tool' : 'System',
    detail,
    provider,
  };
}

function extractWebsocketEvent(body: string) {
  const marker = 'websocket event: ';
  const markerIndex = body.indexOf(marker);
  if (markerIndex < 0) return null;
  const raw = body.slice(markerIndex + marker.length).trim();
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    return JSON.parse(raw.slice(jsonStart)) as Record<string, any>;
  } catch {
    return null;
  }
}

function formatCodexToolName(item?: Record<string, any>) {
  const rawName = String(item?.name ?? item?.tool_name ?? item?.toolName ?? item?.type ?? 'Tool').trim();
  return rawName.replace(/[_-]+/g, ' ');
}

function codexEventToMessage(provider: string, sessionId: string, event: Record<string, any>, index: number, time: string): LocalConversationMessage | null {
  const type = String(event.type ?? '').toLowerCase();
  const item = event.item && typeof event.item === 'object' ? event.item as Record<string, any> : undefined;
  const titleFromType = type.replace(/^response\./, '').replace(/\./g, ' ').trim();

  if (type === 'response.output_text.done') {
    const detail = String(event.text ?? '').trim();
    if (!detail) return null;
    return makeMessage(provider, sessionId, 'assistant', index, time, detail);
  }

  if (type === 'response.function_call_arguments.done') {
    const detail = String(event.arguments ?? item?.arguments ?? '').trim();
    if (!detail) return null;
    return {
      ...makeMessage(provider, sessionId, 'tool', index, time, detail),
      title: formatCodexToolName(item) || 'Tool',
    };
  }

  if (type === 'response.output_item.done' && item?.type === 'function_call') {
    const detail = String(item.arguments ?? event.arguments ?? '').trim();
    if (!detail) return null;
    return {
      ...makeMessage(provider, sessionId, 'tool', index, time, detail),
      title: formatCodexToolName(item) || 'Tool',
    };
  }

  if (type === 'response.reasoning_summary.done' || type === 'response.reasoning.done') {
    const detail = String(event.summary ?? event.text ?? item?.summary ?? '').trim();
    if (!detail) return null;
    return {
      ...makeMessage(provider, sessionId, 'system', index, time, detail),
      title: titleFromType ? titleFromType : 'Reasoning',
    };
  }

  return null;
}

async function loadCodexConversation(sessionId: string): Promise<LocalConversationMessage[]> {
  const sid = String(sessionId || '').trim();
  if (!sid) return [];

  const messages: LocalConversationMessage[] = [];
  const seenEventKeys = new Set<string>();
  try {
    const raw = await fs.readFile(CODEX_HISTORY_PATH, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const entry = parseJsonLine<{ session_id?: string; ts?: number; text?: string }>(line);
      if (!entry || entry.session_id !== sid || !entry.text) return;
      messages.push(makeMessage('codex', sid, 'user', messages.length, toIsoTime(entry.ts) || new Date().toISOString(), entry.text));
    });
  } catch {
    // No local Codex history file.
  }

  if (codexLogsDb) {
    try {
      const rows = codexLogsDb
        .prepare(
          `SELECT ts, ts_nanos, feedback_log_body
             FROM logs
            WHERE thread_id = ?
              AND feedback_log_body LIKE '%websocket event:%'
            ORDER BY ts ASC, ts_nanos ASC, id ASC`,
        )
        .all(sid) as Array<{ ts: number; ts_nanos: number; feedback_log_body: string }>;
      rows.forEach((row) => {
        const event = extractWebsocketEvent(String(row.feedback_log_body || ''));
        if (!event) return;
        const eventKey = String(event.item_id ?? event.response?.id ?? `${row.ts}-${row.ts_nanos}`);
        if (seenEventKeys.has(eventKey)) return;
        const message = codexEventToMessage('codex', sid, event, messages.length, toIsoTime(row.ts) || new Date().toISOString());
        if (message) messages.push(message);
        seenEventKeys.add(eventKey);
      });
    } catch {
      // Ignore log parsing failures.
    }
  }

  return messages.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

async function loadCopilotConversation(sessionId: string): Promise<LocalConversationMessage[]> {
  const sid = String(sessionId || '').trim();
  if (!sid) return [];
  try {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const copilotDb = new Database(COPILOT_SESSION_DB_PATH, { readonly: true, fileMustExist: true });
    try {
      const rows = copilotDb
        .prepare(
          `SELECT turn_index, user_message, assistant_response, timestamp
             FROM turns
            WHERE session_id = ?
            ORDER BY turn_index ASC`,
        )
        .all(sid) as Array<{ turn_index: number; user_message?: string; assistant_response?: string; timestamp?: string }>;
      const messages: LocalConversationMessage[] = [];
      rows.forEach((row, index) => {
        if (row.user_message) {
          messages.push(makeMessage('copilot', sid, 'user', index, toIsoTime(row.timestamp) || new Date().toISOString(), String(row.user_message)));
        }
        if (row.assistant_response) {
          messages.push(makeMessage('copilot', sid, 'assistant', index, toIsoTime(row.timestamp) || new Date().toISOString(), String(row.assistant_response)));
        }
      });
      return messages;
    } finally {
      copilotDb.close?.();
    }
  } catch {
    return [];
  }
}

async function loadClaudeConversation(sessionId: string): Promise<LocalConversationMessage[]> {
  const sid = String(sessionId || '').trim();
  if (!sid) return [];
  try {
    const matches = await fs.readdir(path.join(CLAUDE_DIR, 'projects'), { recursive: true }) as string[];
    const jsonlFile = matches.find((entry) => entry.endsWith(`${sid}.jsonl`));
    if (!jsonlFile) return [];
    const fullPath = path.join(CLAUDE_DIR, 'projects', jsonlFile);
    const raw = await fs.readFile(fullPath, 'utf8');
    const messages: LocalConversationMessage[] = [];
    raw.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      const entry = parseJsonLine<Record<string, any>>(line);
      if (!entry) return;
      const type = String(entry.type ?? entry.role ?? '').toLowerCase();
      const detail = String(entry.content ?? entry.message?.content ?? entry.message?.text ?? entry.text ?? '').trim();
      if (!detail) return;
      if (type === 'user' || type === 'user_message') {
        messages.push(makeMessage('claude', sid, 'user', index, toIsoTime(entry.timestamp) || new Date().toISOString(), detail));
      } else if (type === 'assistant' || type === 'assistant_message' || type === 'message') {
        messages.push(makeMessage('claude', sid, 'assistant', index, toIsoTime(entry.timestamp) || new Date().toISOString(), detail));
      }
    });
    return messages;
  } catch {
    return [];
  }
}

async function loadGeminiConversation(sessionId: string): Promise<LocalConversationMessage[]> {
  const sid = String(sessionId || '').trim();
  if (!sid) return [];
  try {
    const convoDir = path.join(GEMINI_DIR, 'antigravity-cli', 'conversations');
    const files = await fs.readdir(convoDir);
    const dbFile = files.find((file) => file === `${sid}.db` || file.includes(sid));
    if (!dbFile) return [];
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const geminiDb = new Database(path.join(convoDir, dbFile), { readonly: true, fileMustExist: true });
    try {
      const tables = geminiDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
      const tableNames = tables.map((row) => row.name);
      if (tableNames.includes('turns')) {
        const rows = geminiDb.prepare('SELECT turn_index, user_message, assistant_response, timestamp FROM turns WHERE session_id = ? ORDER BY turn_index ASC').all(sid) as Array<{ turn_index: number; user_message?: string; assistant_response?: string; timestamp?: string }>;
        const messages: LocalConversationMessage[] = [];
        rows.forEach((row, index) => {
          if (row.user_message) messages.push(makeMessage('gemini', sid, 'user', index, toIsoTime(row.timestamp) || new Date().toISOString(), String(row.user_message)));
          if (row.assistant_response) messages.push(makeMessage('gemini', sid, 'assistant', index, toIsoTime(row.timestamp) || new Date().toISOString(), String(row.assistant_response)));
        });
        return messages;
      }
      if (tableNames.includes('messages')) {
        const rows = geminiDb.prepare('SELECT role, content, timestamp FROM messages ORDER BY rowid ASC').all() as Array<{ role?: string; content?: string; timestamp?: string }>;
        return rows
          .map((row, index) => {
            const role = String(row.role ?? '').toLowerCase();
            if (role !== 'user' && role !== 'assistant') return null;
            return makeMessage('gemini', sid, role as 'user' | 'assistant', index, toIsoTime(row.timestamp) || new Date().toISOString(), String(row.content ?? '').trim());
          })
          .filter((value): value is LocalConversationMessage => Boolean(value));
      }
      return [];
    } finally {
      geminiDb.close?.();
    }
  } catch {
    return [];
  }
}

async function loadConversationFromSqlite(filePath: string, provider: string, sessionId: string): Promise<LocalConversationMessage[]> {
  try {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const sqliteDb = new Database(filePath, { readonly: true, fileMustExist: true });
    try {
      const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
      const tableNames = tables.map((row) => row.name);
      const messages: LocalConversationMessage[] = [];
      const appendMessage = (kind: LocalConversationMessage['kind'], index: number, time: string, detail: string) => {
        if (!detail) return;
        messages.push(makeMessage(provider, sessionId, kind, index, time, detail));
      };

      if (tableNames.includes('turns')) {
        const rows = sqliteDb.prepare('SELECT * FROM turns ORDER BY rowid ASC').all() as Array<Record<string, any>>;
        rows.forEach((row, index) => {
          const timestamp = toIsoTime(row.timestamp ?? row.time ?? row.created_at ?? row.updated_at) || new Date().toISOString();
          if (row.user_message || row.prompt || row.input) appendMessage('user', index, timestamp, String(row.user_message ?? row.prompt ?? row.input ?? '').trim());
          if (row.assistant_response || row.response || row.output) appendMessage('assistant', index, timestamp, String(row.assistant_response ?? row.response ?? row.output ?? '').trim());
        });
        if (messages.length) return messages;
      }

      if (tableNames.includes('messages')) {
        const rows = sqliteDb.prepare('SELECT * FROM messages ORDER BY rowid ASC').all() as Array<Record<string, any>>;
        rows.forEach((row, index) => {
          const role = String(row.role ?? row.type ?? '').toLowerCase();
          const detail = String(row.content ?? row.text ?? row.message ?? row.output ?? row.result ?? '').trim();
          const kind = role.includes('user') ? 'user' : role.includes('tool') ? 'tool' : role.includes('system') ? 'system' : 'assistant';
          if (detail) appendMessage(kind, index, toIsoTime(row.timestamp ?? row.time ?? row.created_at ?? row.updated_at) || new Date().toISOString(), detail);
        });
        if (messages.length) return messages;
      }

      if (tableNames.includes('conversation')) {
        const rows = sqliteDb.prepare('SELECT * FROM conversation ORDER BY rowid ASC').all() as Array<Record<string, any>>;
        rows.forEach((row, index) => {
          const role = String(row.role ?? row.type ?? '').toLowerCase();
          const detail = String(row.content ?? row.text ?? row.message ?? row.output ?? row.result ?? '').trim();
          const kind = role.includes('user') ? 'user' : role.includes('tool') ? 'tool' : role.includes('system') ? 'system' : 'assistant';
          if (detail) appendMessage(kind, index, toIsoTime(row.timestamp ?? row.time ?? row.created_at ?? row.updated_at) || new Date().toISOString(), detail);
        });
      }

      return messages;
    } finally {
      sqliteDb.close?.();
    }
  } catch {
    return [];
  }
}

function loadTranscriptMessages(provider: string, rawText: string, sessionId: string): LocalConversationMessage[] {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const pushFromEntry = (entry: Record<string, any>, index: number, messages: LocalConversationMessage[]) => {
    const rawType = String(entry.type ?? entry.role ?? entry.kind ?? '').toLowerCase();
    const role = rawType.includes('user') || rawType === 'human' ? 'user'
      : rawType.includes('tool') ? 'tool'
      : rawType.includes('system') ? 'system'
      : 'assistant';
    const detail = String(entry.content ?? entry.text ?? entry.message ?? entry.output ?? entry.result ?? '').trim();
    if (!detail) return;
    messages.push(makeMessage(provider, sessionId, role === 'tool' ? 'tool' : role === 'system' ? 'system' : role === 'user' ? 'user' : 'assistant', index, toIsoTime(entry.timestamp ?? entry.time ?? entry.created_at ?? entry.updated_at) || new Date().toISOString(), detail));
  };

  try {
    const parsed = JSON.parse(text);
    const messages: LocalConversationMessage[] = [];
    if (Array.isArray(parsed)) {
      parsed.forEach((entry, index) => entry && typeof entry === 'object' && pushFromEntry(entry as Record<string, any>, index, messages));
      return messages;
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, any>;
      const items = Array.isArray(record.conversation) ? record.conversation
        : Array.isArray(record.messages) ? record.messages
        : Array.isArray(record.entries) ? record.entries
        : Array.isArray(record.data) ? record.data
        : [record];
      items.forEach((entry, index) => entry && typeof entry === 'object' && pushFromEntry(entry as Record<string, any>, index, messages));
      return messages;
    }
  } catch {
    // Fall through to JSONL parsing.
  }

  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line, index) => {
    const entry = parseJsonLine<Record<string, any>>(line);
    if (!entry) return [];
    const messages: LocalConversationMessage[] = [];
    pushFromEntry(entry, index, messages);
    return messages;
  });
}

async function loadAgyConversation(sessionId: string): Promise<LocalConversationMessage[]> {
  const sid = String(sessionId || '').trim();
  if (!sid) return [];
  const roots = [AGY_DIR, path.join(os.homedir(), '.local', 'share', 'agy')];
  for (const root of roots) {
    try {
      const entries = await fs.readdir(root, { recursive: true }) as string[];
      const match = entries.find((entry) => entry.includes(sid) && /\.(jsonl?|ndjson|txt|log|db)$/i.test(entry));
      if (!match) continue;
      const fullPath = path.join(root, match);
      if (/\.db$/i.test(fullPath)) {
        const sqliteMessages = await loadConversationFromSqlite(fullPath, 'agy', sid);
        if (sqliteMessages.length) return sqliteMessages;
        continue;
      }
      const raw = await fs.readFile(fullPath, 'utf8');
      const messages = loadTranscriptMessages('agy', raw, sid);
      if (messages.length) return messages;
    } catch {
      continue;
    }
  }
  return [];
}

async function loadLocalConversation(provider: string, sessionId: string): Promise<LocalConversationMessage[]> {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'codex' || normalized === 'session' || normalized === 'savant') return loadCodexConversation(sessionId);
  if (normalized === 'copilot' || normalized === 'copilot-chat' || normalized === 'github-copilot') return loadCopilotConversation(sessionId);
  if (normalized === 'claude' || normalized === 'claude-code' || normalized === 'anthropic') return loadClaudeConversation(sessionId);
  if (normalized === 'gemini') return loadGeminiConversation(sessionId);
  if (normalized === 'agy' || normalized === 'agt') return loadAgyConversation(sessionId);
  return loadCodexConversation(sessionId);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    title: 'Savant Sanctum',
    backgroundColor: '#080b12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.on('page-title-updated', (event) => {
      event.preventDefault();
      win.setTitle('Savant Sanctum');
    });
    win.once('ready-to-show', () => {
      win.setTitle('Savant Sanctum');
    });
    win.loadURL(devUrl);
    win.setTitle('Savant Sanctum');
    mainWindow = win;
    win.on('close', (event) => {
      if (isQuitting) return;
      event.preventDefault();
      win.hide();
    });
    return win;
  }
  win.on('page-title-updated', (event) => {
    event.preventDefault();
    win.setTitle('Savant Sanctum');
  });
  win.once('ready-to-show', () => {
    win.setTitle('Savant Sanctum');
  });
  win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.setTitle('Savant Sanctum');
  mainWindow = win;
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });
  return win;
}

async function getTrayIconPath() {
  const candidates = [
    path.join(app.getAppPath(), 'build/icons/tray.png'),
    path.join(__dirname, '../build/icons/tray.png'),
    path.join(__dirname, '../tray.png'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return candidates[0];
}

async function createTray() {
  if (process.platform !== 'darwin' && process.platform !== 'linux' && process.platform !== 'win32') return;

  const iconPath = await getTrayIconPath();
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return;

  tray = new Tray(image);
  tray.setToolTip('Savant Sanctum');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Sanctum', click: () => mainWindow?.show() },
    { label: 'Hide Sanctum', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  app.setName('Savant Sanctum');
  await initDb();
  await createTray();
  createWindow();
});

app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  } else if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-settings', async () => {
  if (!db) return {};
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings: Record<string, any> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
});

ipcMain.handle('save-setting', async (_event, { key, value }) => {
  if (!db) return false;
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, val);
  return true;
});

ipcMain.handle('get-user', async () => {
  try {
    return os.userInfo().username;
  } catch {
    return 'operator';
  }
});

ipcMain.handle('get-db-status', async () => {
  if (!db) return 'offline';
  try {
    db.prepare('SELECT 1').get();
    return 'connected';
  } catch (e) {
    return 'offline';
  }
});

ipcMain.handle('get-local-conversation', async (_event, provider: string, sessionId: string) => {
  return loadLocalConversation(provider, sessionId);
});

ipcMain.handle('run-agent', async (_event, payload: RunAgentPayload) => {
  const prompt = String(payload?.prompt || '').trim();
  if (!prompt) throw new Error('prompt is required');

  const gatewayConfig = readSetting('gateway:config', { url: 'http://127.0.0.1:3100', enabled: true });
  const gatewayBaseUrl = normalizeBaseUrl(gatewayConfig, 'http://127.0.0.1:3100');
  const runResponse = await fetch(`${gatewayBaseUrl}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      chain: Array.isArray(payload?.chain) && payload.chain.length > 0 ? payload.chain : undefined,
      cwd: payload?.cwd,
      session_id: payload?.sessionId,
    }),
  });

  if (!runResponse.ok) {
    const body = await runResponse.text();
    throw new Error(`Gateway run failed: ${runResponse.status} ${body}`);
  }

  const run = await runResponse.json();
  const runId = String(run?.id || '');
  if (!runId) throw new Error('Gateway did not return a run id');

  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    await delay(700);
    const statusResponse = await fetch(`${gatewayBaseUrl}/runs/${encodeURIComponent(runId)}`);
    if (!statusResponse.ok) {
      const body = await statusResponse.text();
      throw new Error(`Gateway status failed: ${statusResponse.status} ${body}`);
    }
    const status = await statusResponse.json();
    if (status.status === 'complete') return String(status.result?.response || '');
    if (status.status === 'error' || status.status === 'killed') {
      throw new Error(status.error || `Gateway run ${status.status}`);
    }
  }

  throw new Error('Gateway run timed out');
});

function normalizeGatewayProviders(payload: any) {
  const providerPayload = payload?.providerDetails ?? payload?.providers ?? payload?.data ?? payload;
  const rawProviders = Array.isArray(providerPayload)
    ? providerPayload
    : providerPayload && typeof providerPayload === 'object'
      ? Object.entries(providerPayload).map(([id, value]) => (
        value && typeof value === 'object'
          ? { id, ...(value as Record<string, unknown>) }
          : { id, label: String(value) }
      ))
      : Array.isArray(payload)
    ? payload
    : [];

  return rawProviders
    .map((provider: any) => {
      if (typeof provider === 'string') {
        const id = provider.trim();
        if (!id) return null;
        return {
          id,
          label: id,
          models: [],
          source: 'gateway',
          installed: true,
        };
      }

      const id = String(provider.id || provider.name || provider.provider || '').trim();
      if (!id) return null;
      const models = Array.isArray(provider.models)
        ? provider.models.map((model: any) => String(model.id || model.name || model)).filter(Boolean)
        : provider.models && typeof provider.models === 'object'
          ? Object.keys(provider.models)
        : provider.model
          ? [String(provider.model)]
          : [];

      return {
        id,
        label: String(provider.label || provider.name || id),
        defaultModel: provider.defaultModel ? String(provider.defaultModel) : models[0],
        models,
        source: 'gateway',
        installed: true,
      };
    })
    .filter(Boolean);
}

function nodeFetchJson(urlStr: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith('https') ? https : http;
    const req = client.get(urlStr, { timeout: 2000 }, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        res.resume();
        return reject(new Error(`Request Failed. Status Code: ${statusCode}`));
      }
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', (e) => {
      reject(e);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function getGatewayProviders(gatewayUrl: string) {
  const baseUrl = gatewayUrl.replace(/\/+$/, '');
  const endpoints = ['/models', '/health', '/providers', '/api/providers', '/v1/providers', '/models/providers'];

  for (const endpoint of endpoints) {
    try {
      const data = await nodeFetchJson(`${baseUrl}${endpoint}`);
      const providers = normalizeGatewayProviders(data);
      if (providers.length > 0) {
        return providers;
      }
    } catch (_e) {
      // Try the next known gateway route
    }
  }

  return [];
}

ipcMain.handle('list-providers', async (_event, gatewayUrl?: string) => {
  const url = gatewayUrl || 'http://127.0.0.1:3100';
  const gatewayProviders = await getGatewayProviders(url);
  return {
    source: 'gateway',
    providers: gatewayProviders || [],
  };
});
