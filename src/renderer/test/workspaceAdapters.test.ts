import { describe, expect, it } from 'vitest';
import { normalizeServerWorkspace } from '../services/workspaceAdapters';

describe('normalizeServerWorkspace', () => {
  it('converts the live attached-session array into a render-safe count', () => {
    const workspace = normalizeServerWorkspace({
      workspace_id: '17840847469787888397441',
      name: 'Savant Forge Planning Workflow',
      status: 'open',
      sessions: [
        { attached_at: '2026-07-16', provider: 'session', session_id: 'one', workspace_id: '17840847469787888397441' },
        { attached_at: '2026-07-15', provider: 'session', session_id: 'two', workspace_id: '17840847469787888397441' },
      ],
      session_count: 2,
    });

    expect(workspace?.id).toBe('17840847469787888397441');
    expect(workspace?.sessions).toBe(2);
    expect(workspace?.counts?.total).toBe(2);
  });
});
