import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const COLOSSEUM_PROVIDERS = ['codex', 'claude', 'copilot', 'hermes', 'agy'] as const;
export type ColosseumProviderId = (typeof COLOSSEUM_PROVIDERS)[number];

export interface AgentConfig {
  id: string;
  name: string;
  prompt: string;
  persona: string;
  tag: string;
  provider: ColosseumProviderId | string;
  model: string;
  pickup_location: string;
  working_location?: string;
  drop_location: string;
}

export interface Pipeline {
  id: string;
  name: string;
  agent_ids: string[];
}

export interface ColosseumRegistry {
  agents: Record<string, AgentConfig>;
  pipelines: Record<string, Pipeline>;
}

export type WorkerStatus = 'starting' | 'running' | 'stopped' | 'succeeded' | 'failed';

export interface WorkerRecord {
  worker_id: string;
  workspace_id: string | null;
  status: WorkerStatus;
  pid: number | null;
  process_identity?: string | null;
  started_at: string;
  finished_at?: string | null;
  log_path: string;
}

export interface SystemStats {
  cpuUsagePercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  usedMemoryBytes: number;
  memoryUsagePercent: number;
  uptimeSeconds: number;
  loadAvg: number[];
  platform: string;
  arch: string;
}

export function getDefaultPipelinesPath(): string {
  return path.join(os.homedir(), '.savant', 'colosseum', 'pipelines.json');
}

export function getDefaultWorkerRegistryPath(): string {
  return path.join(os.homedir(), '.savant', 'colosseum', 'workers', 'registry.json');
}

export function validatePipelineChain(
  pipeline: Pipeline,
  agents: Record<string, AgentConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!pipeline.id?.trim()) {
    errors.push('Pipeline ID cannot be empty');
  }
  if (!pipeline.name?.trim()) {
    errors.push('Pipeline name cannot be empty');
  }
  if (!pipeline.agent_ids || pipeline.agent_ids.length === 0) {
    errors.push('Pipeline must have at least one agent');
    return { valid: false, errors };
  }

  const seenPickups = new Map<string, string>();
  const pipelineAgents: AgentConfig[] = [];

  for (const agentId of pipeline.agent_ids) {
    const agent = agents[agentId];
    if (!agent) {
      errors.push(`Agent '${agentId}' referenced in pipeline was not found`);
      continue;
    }
    pipelineAgents.push(agent);

    // Validate agent fields
    if (!agent.name?.trim()) errors.push(`Agent '${agentId}' missing name`);
    if (!agent.prompt?.trim()) errors.push(`Agent '${agentId}' missing prompt`);
    if (!agent.persona?.trim()) errors.push(`Agent '${agentId}' missing persona`);
    if (!agent.model?.trim()) errors.push(`Agent '${agentId}' missing model`);
    if (!agent.pickup_location?.trim()) errors.push(`Agent '${agentId}' missing pickup_location`);
    if (!agent.drop_location?.trim()) errors.push(`Agent '${agentId}' missing drop_location`);

    // Validate provider
    const providerLower = (agent.provider || '').trim().toLowerCase();
    if (!COLOSSEUM_PROVIDERS.includes(providerLower as ColosseumProviderId)) {
      errors.push(
        `Unsupported provider "${agent.provider}" for agent '${agent.name || agentId}'. Must be one of: ${COLOSSEUM_PROVIDERS.join(', ')}`
      );
    }

    // Check duplicate pickup locations
    const pickup = (agent.pickup_location || '').trim().toLowerCase();
    if (pickup) {
      if (seenPickups.has(pickup)) {
        errors.push(
          `Duplicate pickup location '${pickup}' in pipeline '${pipeline.name}': agents '${seenPickups.get(pickup)}' and '${agent.name}' share pickup`
        );
      } else {
        seenPickups.set(pickup, agent.name || agentId);
      }
    }
  }

  // Chain validation: adjacent drop_location == pickup_location
  for (let i = 0; i < pipelineAgents.length - 1; i++) {
    const current = pipelineAgents[i];
    const next = pipelineAgents[i + 1];
    const currentDrop = (current.drop_location || '').trim().toLowerCase();
    const nextPickup = (next.pickup_location || '').trim().toLowerCase();

    if (currentDrop && nextPickup && currentDrop !== nextPickup) {
      errors.push(
        `Broken chain between '${current.name}' and '${next.name}': drop_location '${current.drop_location}' does not match next pickup_location '${next.pickup_location}'`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function readColosseumRegistry(customPath?: string): Promise<ColosseumRegistry> {
  const filePath = customPath || getDefaultPipelinesPath();
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return {
      agents: parsed && typeof parsed.agents === 'object' && parsed.agents !== null ? parsed.agents : {},
      pipelines: parsed && typeof parsed.pipelines === 'object' && parsed.pipelines !== null ? parsed.pipelines : {},
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { agents: {}, pipelines: {} };
    }
    throw new Error(`Failed to read Colosseum registry at ${filePath}: ${error?.message || String(error)}`);
  }
}

export async function writeColosseumRegistry(
  registry: ColosseumRegistry,
  customPath?: string
): Promise<void> {
  const filePath = customPath || getDefaultPipelinesPath();

  if (!registry || typeof registry !== 'object') {
    throw new Error('Registry must be an object');
  }
  const agents = registry.agents || {};
  const pipelines = registry.pipelines || {};

  // Validate all pipelines before writing
  const allErrors: string[] = [];
  for (const pipeline of Object.values(pipelines)) {
    const validation = validatePipelineChain(pipeline, agents);
    if (!validation.valid) {
      allErrors.push(...validation.errors);
    }
  }

  // Also validate standalone agents
  for (const [id, agent] of Object.entries(agents)) {
    if (!agent.name?.trim()) allErrors.push(`Agent '${id}' missing name`);
    const providerLower = (agent.provider || '').trim().toLowerCase();
    if (!COLOSSEUM_PROVIDERS.includes(providerLower as ColosseumProviderId)) {
      allErrors.push(
        `Unsupported provider "${agent.provider}" for agent '${agent.name || id}'. Must be one of: ${COLOSSEUM_PROVIDERS.join(', ')}`
      );
    }
  }

  if (allErrors.length > 0) {
    throw new Error(`Colosseum registry validation failed: ${allErrors.join('; ')}`);
  }

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempFile = path.join(dir, `pipelines.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  const content = JSON.stringify({ agents, pipelines }, null, 2);
  await fs.writeFile(tempFile, content, 'utf8');
  await fs.rename(tempFile, filePath);
}

export async function readWorkerRegistry(customPath?: string): Promise<WorkerRecord[]> {
  const filePath = customPath || getDefaultWorkerRegistryPath();
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to read Colosseum worker registry at ${filePath}: ${error?.message || String(error)}`);
  }
}

export async function readIncrementalLog(
  logPath: string,
  lastLen = 0,
  _lastMtime?: number
): Promise<{ chunk: string; len: number; mtime: number }> {
  try {
    const stats = await fs.stat(logPath);
    const mtime = stats.mtimeMs;
    const currentSize = stats.size;

    if (currentSize <= lastLen) {
      // No new data or log was truncated
      if (currentSize < lastLen) {
        // Truncated / restarted log
        const handle = await fs.open(logPath, 'r');
        const buffer = Buffer.alloc(currentSize);
        await handle.read(buffer, 0, currentSize, 0);
        await handle.close();
        return { chunk: buffer.toString('utf8'), len: currentSize, mtime };
      }
      return { chunk: '', len: lastLen, mtime };
    }

    const readBytes = currentSize - lastLen;
    const buffer = Buffer.alloc(readBytes);
    const handle = await fs.open(logPath, 'r');
    await handle.read(buffer, 0, readBytes, lastLen);
    await handle.close();

    return {
      chunk: buffer.toString('utf8'),
      len: currentSize,
      mtime,
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { chunk: '', len: 0, mtime: 0 };
    }
    throw error;
  }
}

export function getSystemResources(): SystemStats {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  const idlePercent = totalTick > 0 ? (totalIdle / totalTick) * 100 : 0;
  const cpuUsagePercent = Math.max(0, Math.min(100, Math.round((100 - idlePercent) * 10) / 10));

  const totalMemoryBytes = os.totalmem();
  const freeMemoryBytes = os.freemem();
  const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;
  const memoryUsagePercent = totalMemoryBytes > 0
    ? Math.round((usedMemoryBytes / totalMemoryBytes) * 1000) / 10
    : 0;

  return {
    cpuUsagePercent,
    totalMemoryBytes,
    freeMemoryBytes,
    usedMemoryBytes,
    memoryUsagePercent,
    uptimeSeconds: Math.floor(os.uptime()),
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    platform: os.platform(),
    arch: os.arch(),
  };
}
