/// <reference types="vite/client" />

interface Window {
  sanctum: {
    version: string;
    runAgent: (payload: {
      prompt: string;
      chain?: Array<{ provider: string; model?: string }>;
      cwd?: string;
      sessionId?: string;
    }) => Promise<string>;
    pickRepository: (defaultPath?: string) => Promise<string | null>;
    listColosseumProviders: () => Promise<Array<{ id: string; label: string; command: string }>>;
    getColosseumRegistry: () => Promise<{
      agents: Record<string, {
        id: string;
        name: string;
        prompt: string;
        persona: string;
        tag: string;
        provider: string;
        model: string;
        pickup_location: string;
        working_location?: string;
        drop_location: string;
      }>;
      pipelines: Record<string, {
        id: string;
        name: string;
        agent_ids: string[];
      }>;
    }>;
    saveColosseumRegistry: (registry: {
      agents: Record<string, any>;
      pipelines: Record<string, any>;
    }) => Promise<{ success: boolean; errors?: string[] }>;
    getColosseumWorkers: () => Promise<Array<{
      worker_id: string;
      workspace_id: string | null;
      status: 'starting' | 'running' | 'stopped' | 'succeeded' | 'failed';
      pid: number | null;
      process_identity?: string | null;
      started_at: string;
      finished_at?: string | null;
      log_path: string;
    }>>;
    startColosseumWorker: (workspaceId?: string) => Promise<{ success: boolean; workerId?: string; error?: string }>;
    stopColosseumWorker: (workerId: string) => Promise<{ success: boolean; error?: string }>;
    restartColosseumWorker: (workerId: string) => Promise<{ success: boolean; worker?: any; error?: string }>;
    purgeColosseumWorker: (workerId: string, killFirst?: boolean) => Promise<{ success: boolean; error?: string }>;
    tailColosseumLog: (logPath: string, lastLen?: number, lastMtime?: number) => Promise<{ chunk: string; len: number; mtime: number }>;
    getSystemStats: () => Promise<{
      cpuUsagePercent: number;
      totalMemoryBytes: number;
      freeMemoryBytes: number;
      usedMemoryBytes: number;
      memoryUsagePercent: number;
      uptimeSeconds: number;
      loadAvg: number[];
      platform: string;
      arch: string;
    }>;
  };
  system: {
    getSettings: () => Promise<Record<string, any>>;
    saveSetting: (key: string, value: any) => Promise<boolean>;
    saveAthenaThread: (payload: { threadKey: string; messages: Array<{ id: string; sender: 'user' | 'assistant'; text: string; timestamp: string }>; input: string }) => Promise<boolean>;
    loadAthenaThreads: () => Promise<Record<string, { messages: Array<{ id: string; sender: 'user' | 'assistant'; text: string; timestamp: string }>; input: string; updatedAt?: string }>>;
    getUser: () => Promise<string>;
    listProviders: (gatewayUrl?: string) => Promise<any>;
    getDbStatus: () => Promise<string>;
    getLocalConversation?: (provider: string, sessionId: string) => Promise<Array<{
      id: string;
      time: string;
      kind: 'user' | 'assistant' | 'tool' | 'system';
      role: string;
      title: string;
      detail: string;
      provider: string;
    }>>;
    getLocalSessionMetadata?: (sessionId: string, provider?: string) => Promise<{
      provider?: string;
      title?: string;
      agentType?: string;
      model?: string;
      messageCount?: number;
      startedAt?: string;
      endedAt?: string;
      endReason?: string;
      parentSessionId?: string;
      stats?: {
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
      files?: Array<{ path: string; name: string; category: string; size?: number }>;
    }>;
  };
}
