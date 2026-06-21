import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

type SettingsModalProps = {
  open: boolean;
  authUser: string;
  authDraft: string;
  serverDraft: string;
  gatewayDraft: string;
  selectedProvider: string;
  selectedModel: string;
  providers: Array<{ id: string; label: string; models: string[] }>;
  hasApiKey: boolean;
  onClose: () => void;
  onAuthUserChange: (value: string) => void;
  onAuthDraftChange: (value: string) => void;
  onServerDraftChange: (value: string) => void;
  onGatewayDraftChange: (value: string) => void;
  onSelectedProviderChange: (value: string) => void;
  onSelectedModelChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
};

export function SettingsModal({
  open,
  authUser,
  authDraft,
  serverDraft,
  gatewayDraft,
  selectedProvider,
  selectedModel,
  providers,
  hasApiKey,
  onClose,
  onAuthUserChange,
  onAuthDraftChange,
  onServerDraftChange,
  onGatewayDraftChange,
  onSelectedProviderChange,
  onSelectedModelChange,
  onSave,
  onLogout,
}: SettingsModalProps) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setSaving(false);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setSaving(true);
    try {
      await onLogout();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provId: string) => {
    onSelectedProviderChange(provId);
    if (providers && providers.length > 0) {
      const prov = providers.find((p) => p.id === provId);
      if (prov && prov.models[0]) {
        onSelectedModelChange(prov.models[0]);
      }
    }
  };

  const hasProviders = providers && providers.length > 0;
  const currentProvider = hasProviders ? providers.find((p) => p.id === selectedProvider) || providers[0] : null;
  const currentModels = currentProvider ? currentProvider.models : [];

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">User preferences</div>
            <h2 id="settings-title" className="brand-title !text-base !tracking-wider">Settings</h2>
            <p className="hero-copy mt-1">Manage your local session and Savant connection details.</p>
          </div>
          <button className="text-btn action-close icon-only" aria-label="Close" title="Close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-grid">
          <label>
            <span className="text-[10px] uppercase tracking-widest opacity-60">User name</span>
            <input
              value={authUser}
              onChange={(e) => onAuthUserChange(e.target.value)}
              className="rounded-none"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-widest opacity-60">API key</span>
            <input
              type="password"
              value={authDraft}
              onChange={(e) => onAuthDraftChange(e.target.value)}
              className="rounded-none"
              placeholder="sk-..."
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Savant server</span>
            <input
              value={serverDraft}
              onChange={(e) => onServerDraftChange(e.target.value)}
              className="rounded-none"
              placeholder="http://127.0.0.1:8090"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Gateway</span>
            <input
              value={gatewayDraft}
              onChange={(e) => onGatewayDraftChange(e.target.value)}
              className="rounded-none"
              placeholder="http://127.0.0.1:3100"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Athena Provider</span>
            {hasProviders ? (
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: '#080b12', color: '#fff' }} className="bg-[#080b12] text-white">
                    {p.label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{
                border: '1px dashed rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.05)',
                color: '#ef4444',
                fontSize: '11px',
                padding: '8px 10px',
                fontFamily: 'Share Tech Mono, monospace'
              }}>
                GATEWAY ERROR: NO PROVIDERS DETECTED
              </div>
            )}
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Athena Model</span>
            {hasProviders ? (
              <select
                value={selectedModel}
                onChange={(e) => onSelectedModelChange(e.target.value)}
              >
                {currentModels.map((m) => (
                  <option key={m} value={m} style={{ background: '#080b12', color: '#fff' }} className="bg-[#080b12] text-white">
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{
                border: '1px dashed rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.05)',
                color: '#ef4444',
                fontSize: '11px',
                padding: '8px 10px',
                fontFamily: 'Share Tech Mono, monospace'
              }}>
                GATEWAY ERROR: NO MODELS DETECTED
              </div>
            )}
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest opacity-50">
            <span>Session is managed in app</span>
            <span>{hasApiKey ? 'Authenticated' : 'Logged out'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button className="ghost-btn" onClick={handleLogout} disabled={saving}>
              Log out
            </button>
            <div className="flex gap-2">
              <button className="ghost-btn action-close icon-only" aria-label="Close" title="Close" onClick={onClose} disabled={saving}><X size={14} /></button>
              <button className="ghost-btn action-save icon-only" aria-label="Save" title="Save" onClick={handleSave} disabled={saving}>
                <Check size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
