import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  COLOSSEUM_PROVIDERS,
  validatePipelineChain,
  readColosseumRegistry,
  writeColosseumRegistry,
  readWorkerRegistry,
  writeWorkerRegistry,
  purgeWorker,
  readIncrementalLog,
  getSystemResources,
  type AgentConfig,
  type Pipeline,
  type ColosseumRegistry,
  type WorkerRecord,
} from '../../../electron/colosseumStore';

describe('Colosseum Pipeline and Agent validation', () => {
  const coder: AgentConfig = {
    id: 'agent-coder',
    name: 'Coder',
    prompt: 'Implement code according to task spec.',
    persona: 'coder',
    tag: 'v1',
    provider: 'codex',
    model: 'gpt-4o',
    pickup_location: 'ready',
    working_location: 'in-progress',
    drop_location: 'review',
  };

  const reviewer: AgentConfig = {
    id: 'agent-reviewer',
    name: 'Reviewer',
    prompt: 'Review diff and ensure correctness.',
    persona: 'reviewer',
    tag: 'v1',
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    pickup_location: 'review',
    working_location: 'in-progress',
    drop_location: 'approved',
  };

  const merger: AgentConfig = {
    id: 'agent-merger',
    name: 'Merger',
    prompt: 'Fast-forward merge approved PR.',
    persona: 'merger',
    tag: 'v1',
    provider: 'copilot',
    model: 'claude-3-5-sonnet',
    pickup_location: 'approved',
    working_location: 'in-progress',
    drop_location: 'done',
  };

  const agents: Record<string, AgentConfig> = {
    [coder.id]: coder,
    [reviewer.id]: reviewer,
    [merger.id]: merger,
  };

  it('validates a continuous coder -> reviewer -> merger pipeline successfully', () => {
    const pipeline: Pipeline = {
      id: 'pipeline-full',
      name: 'Full Dev Cycle',
      agent_ids: [coder.id, reviewer.id, merger.id],
    };

    const result = validatePipelineChain(pipeline, agents);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a pipeline with a disconnected chain', () => {
    // coder drops to "review", but merger picks up from "approved" (gap)
    const pipeline: Pipeline = {
      id: 'pipeline-broken',
      name: 'Broken Chain',
      agent_ids: [coder.id, merger.id],
    };

    const result = validatePipelineChain(pipeline, agents);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('drop_location') && e.includes('pickup_location'))).toBe(true);
  });

  it('rejects a pipeline with duplicate pickup locations', () => {
    const duplicateCoder: AgentConfig = {
      ...coder,
      id: 'agent-coder-2',
      name: 'Coder 2',
      pickup_location: 'ready',
    };
    const agentsWithDup = { ...agents, [duplicateCoder.id]: duplicateCoder };
    const pipeline: Pipeline = {
      id: 'pipeline-dup',
      name: 'Duplicate Pickups',
      agent_ids: [coder.id, duplicateCoder.id],
    };

    const result = validatePipelineChain(pipeline, agentsWithDup);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate pickup location'))).toBe(true);
  });

  it('rejects an agent with unsupported provider like gemini', () => {
    const geminiAgent: AgentConfig = {
      ...coder,
      id: 'agent-gemini',
      provider: 'gemini',
    };
    const agentsWithGemini = { ...agents, [geminiAgent.id]: geminiAgent };
    const pipeline: Pipeline = {
      id: 'pipeline-gemini',
      name: 'Gemini Pipeline',
      agent_ids: [geminiAgent.id],
    };

    const result = validatePipelineChain(pipeline, agentsWithGemini);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unsupported provider "gemini"'))).toBe(true);
  });

  it('rejects an agent with empty required fields', () => {
    const invalidAgent: AgentConfig = {
      ...coder,
      id: 'agent-empty',
      model: '',
    };
    const agentsWithEmpty = { ...agents, [invalidAgent.id]: invalidAgent };
    const pipeline: Pipeline = {
      id: 'pipeline-empty',
      name: 'Empty Model',
      agent_ids: [invalidAgent.id],
    };

    const result = validatePipelineChain(pipeline, agentsWithEmpty);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('model'))).toBe(true);
  });

  it('rejects a pipeline referencing a missing agent ID', () => {
    const pipeline: Pipeline = {
      id: 'pipeline-missing',
      name: 'Missing Agent',
      agent_ids: ['non-existent-agent'],
    };

    const result = validatePipelineChain(pipeline, agents);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not found'))).toBe(true);
  });
});

describe('Colosseum Registry Disk Persistence', () => {
  let tmpDir: string;
  let registryPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'colosseum-test-'));
    registryPath = path.join(tmpDir, 'pipelines.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty registry when pipelines.json does not exist', async () => {
    const registry = await readColosseumRegistry(registryPath);
    expect(registry).toEqual({ agents: {}, pipelines: {} });
  });

  it('persists and hydrates valid pipelines and agents exactly matching Colosseum schema', async () => {
    const coder: AgentConfig = {
      id: 'coder-1',
      name: 'Coder 1',
      prompt: 'Implement prompt',
      persona: 'coder',
      tag: 'v1',
      provider: 'codex',
      model: 'gpt-4o',
      pickup_location: 'ready',
      working_location: 'in-progress',
      drop_location: 'review',
    };
    const reviewer: AgentConfig = {
      id: 'reviewer-1',
      name: 'Reviewer 1',
      prompt: 'Review prompt',
      persona: 'reviewer',
      tag: 'v1',
      provider: 'claude',
      model: 'claude-3-5-sonnet',
      pickup_location: 'review',
      working_location: 'in-progress',
      drop_location: 'done',
    };
    const pipeline: Pipeline = {
      id: 'pipe-1',
      name: 'Dev Flow',
      agent_ids: ['coder-1', 'reviewer-1'],
    };

    const toSave: ColosseumRegistry = {
      agents: { 'coder-1': coder, 'reviewer-1': reviewer },
      pipelines: { 'pipe-1': pipeline },
    };

    await writeColosseumRegistry(toSave, registryPath);

    const reloaded = await readColosseumRegistry(registryPath);
    expect(reloaded).toEqual(toSave);

    // Verify raw file format is valid JSON matching colosseum
    const raw = await fs.readFile(registryPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.agents['coder-1'].provider).toBe('codex');
    expect(parsed.pipelines['pipe-1'].agent_ids).toEqual(['coder-1', 'reviewer-1']);
  });

  it('refuses to write if a pipeline chain is broken', async () => {
    const brokenRegistry: ColosseumRegistry = {
      agents: {
        'coder-1': {
          id: 'coder-1',
          name: 'Coder 1',
          prompt: 'Implement prompt',
          persona: 'coder',
          tag: 'v1',
          provider: 'codex',
          model: 'gpt-4o',
          pickup_location: 'ready',
          working_location: 'in-progress',
          drop_location: 'review',
        },
        'merger-1': {
          id: 'merger-1',
          name: 'Merger 1',
          prompt: 'Merge prompt',
          persona: 'merger',
          tag: 'v1',
          provider: 'agy',
          model: 'gemini-2.5-flash',
          pickup_location: 'approved', // gap!
          working_location: 'in-progress',
          drop_location: 'done',
        },
      },
      pipelines: {
        'broken-pipe': {
          id: 'broken-pipe',
          name: 'Broken Flow',
          agent_ids: ['coder-1', 'merger-1'],
        },
      },
    };

    await expect(writeColosseumRegistry(brokenRegistry, registryPath)).rejects.toThrow(
      /validation failed/i
    );
  });
});

describe('Worker registry reading and incremental log tailing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads worker records from registry.json', async () => {
    const regFile = path.join(tmpDir, 'registry.json');
    const worker: WorkerRecord = {
      worker_id: '01JABCDEF1234567890',
      workspace_id: 'ws-123',
      status: 'running',
      pid: 12345,
      process_identity: 'Sun Sep 27 12:00:00 2026',
      started_at: '2026-09-27T12:00:00Z',
      finished_at: null,
      log_path: '/tmp/log.jsonl',
    };

    await fs.writeFile(regFile, JSON.stringify([worker]));

    const workers = await readWorkerRegistry(regFile);
    expect(workers).toHaveLength(1);
    expect(workers[0].worker_id).toBe('01JABCDEF1234567890');
    expect(workers[0].workspace_id).toBe('ws-123');
  });

  it('atomically writes and purges workers from registry', async () => {
    const regFile = path.join(tmpDir, 'workers', 'registry.json');
    const logDir = path.join(tmpDir, 'workers', 'w1-logs');
    await fs.mkdir(logDir, { recursive: true });
    const logPath = path.join(logDir, 'worker.jsonl');
    await fs.writeFile(logPath, '{"type":"test"}\n');

    const w1: WorkerRecord = {
      worker_id: 'w1',
      workspace_id: 'ws-1',
      status: 'stopped',
      pid: null,
      started_at: new Date().toISOString(),
      log_path: logPath,
    };
    const w2: WorkerRecord = {
      worker_id: 'w2',
      workspace_id: 'ws-2',
      status: 'running',
      pid: null,
      started_at: new Date().toISOString(),
      log_path: '/tmp/w2.log',
    };

    await writeWorkerRegistry([w1, w2], regFile);
    let workers = await readWorkerRegistry(regFile);
    expect(workers).toHaveLength(2);

    const purgeRes = await purgeWorker('w1', false, regFile);
    expect(purgeRes.success).toBe(true);

    workers = await readWorkerRegistry(regFile);
    expect(workers).toHaveLength(1);
    expect(workers[0].worker_id).toBe('w2');

    // w1 log directory should be cleaned up
    const logExists = await fs.stat(logPath).catch(() => null);
    expect(logExists).toBeNull();
  });

  it('tails logs incrementally without re-reading previous bytes', async () => {
    const logFile = path.join(tmpDir, 'test.log');
    await fs.writeFile(logFile, 'Line 1\nLine 2\n');

    const first = await readIncrementalLog(logFile, 0);
    expect(first.chunk).toBe('Line 1\nLine 2\n');
    expect(first.len).toBe(14);

    // Append new line
    await fs.appendFile(logFile, 'Line 3\n');

    const second = await readIncrementalLog(logFile, first.len);
    expect(second.chunk).toBe('Line 3\n');
    expect(second.len).toBe(21);

    // Call again with no changes
    const third = await readIncrementalLog(logFile, second.len);
    expect(third.chunk).toBe('');
    expect(third.len).toBe(21);
  });
});

describe('System resource metrics (node:os)', () => {
  it('reads CPU, memory, load average and uptime without subprocess spawns', () => {
    const stats = getSystemResources();
    expect(stats.cpuUsagePercent).toBeGreaterThanOrEqual(0);
    expect(stats.cpuUsagePercent).toBeLessThanOrEqual(100);
    expect(stats.totalMemoryBytes).toBeGreaterThan(0);
    expect(stats.freeMemoryBytes).toBeGreaterThanOrEqual(0);
    expect(stats.usedMemoryBytes).toBeGreaterThanOrEqual(0);
    expect(stats.uptimeSeconds).toBeGreaterThan(0);
    expect(Array.isArray(stats.loadAvg)).toBe(true);
  });
});
