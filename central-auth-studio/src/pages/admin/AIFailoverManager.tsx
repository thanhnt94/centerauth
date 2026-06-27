import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Plus, Trash2, ArrowUp, ArrowDown, Save, 
  RefreshCw, Check, AlertCircle, Bot, Sliders, Loader2
} from 'lucide-react';

interface FailoverItem {
  id?: number;
  provider: string;
  key_id: string;
  key_label: string;
  model_id: string;
  priority: number;
  is_enabled: boolean;
}

interface AvailableKey {
  key_id: string;
  label: string;
  provider: string;
  default_model: string;
}

export const AIFailoverManager: React.FC = () => {
  const [failoverPool, setFailoverPool] = useState<FailoverItem[]>([]);
  const [availableKeys, setAvailableKeys] = useState<AvailableKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state to add new candidate
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<{id: string, display_name: string}[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [manualInput, setManualInput] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const handleLoadModels = async (keyId: string) => {
    if (!keyId) return;
    setLoadingModels(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: keyId })
      });
      if (res.ok) {
        const data = await res.json();
        setDiscoveredModels(data);
        if (data.length > 0) {
          setCustomModelId(data[0].id);
          setManualInput(false);
        } else {
          setManualInput(true);
        }
      } else {
        setDiscoveredModels([]);
        setManualInput(true);
      }
    } catch {
      setDiscoveredModels([]);
      setManualInput(true);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/failover');
      if (res.ok) {
        const data = await res.json();
        setFailoverPool(data.failover_pool);
        setAvailableKeys(data.available_keys);
        if (data.available_keys.length > 0) {
          const firstKey = data.available_keys[0].key_id;
          setSelectedKeyId(firstKey);
          setCustomModelId(data.available_keys[0].default_model);
          handleLoadModels(firstKey);
        }
      } else {
        setError('Failed to fetch failover settings from server.');
      }
    } catch (err) {
      setError('Network error loading failover configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyChange = (keyId: string) => {
    setSelectedKeyId(keyId);
    const matched = availableKeys.find(k => k.key_id === keyId);
    if (matched) {
      setCustomModelId(matched.default_model);
    }
    handleLoadModels(keyId);
  };

  const handleAddCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeyId || !customModelId.trim()) return;

    const matchedKey = availableKeys.find(k => k.key_id === selectedKeyId);
    if (!matchedKey) return;

    // Check if duplicate already exists in pool
    const duplicate = failoverPool.some(
      item => item.key_id === selectedKeyId && item.model_id.trim() === customModelId.trim()
    );
    if (duplicate) {
      alert('This specific Key + Model candidate is already in the failover pool!');
      return;
    }

    const newItem: FailoverItem = {
      provider: matchedKey.provider,
      key_id: matchedKey.key_id,
      key_label: matchedKey.label,
      model_id: customModelId.trim(),
      priority: failoverPool.length,
      is_enabled: true
    };

    setFailoverPool([...failoverPool, newItem]);
    setCustomModelId('');
  };

  const handleRemoveCandidate = (index: number) => {
    const updated = failoverPool.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      priority: idx
    }));
    setFailoverPool(updated);
  };

  const handleToggleEnabled = (index: number) => {
    const updated = failoverPool.map((item, i) => {
      if (i === index) {
        return { ...item, is_enabled: !item.is_enabled };
      }
      return item;
    });
    setFailoverPool(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...failoverPool];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    
    // Recalculate priorities
    const reordered = updated.map((item, idx) => ({ ...item, priority: idx }));
    setFailoverPool(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index === failoverPool.length - 1) return;
    const updated = [...failoverPool];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    
    // Recalculate priorities
    const reordered = updated.map((item, idx) => ({ ...item, priority: idx }));
    setFailoverPool(reordered);
  };

  const handleSavePool = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/chat/failover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: failoverPool })
      });
      if (res.ok) {
        setMessage('AI Failover pool priorities saved successfully!');
        fetchData();
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to save failover config.');
      }
    } catch {
      setError('Network failure saving failover pool.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Sliders className="text-indigo-500" size={32} />
            AI Failover Pool & Model Priorities
          </h2>
          <p className="text-slate-400 mt-2">
            Configure dynamic Key + Model pairs and order their fallback priority when running out of quota.
          </p>
        </div>
        
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-3 bg-slate-900 border border-white/5 hover:bg-white/5 rounded-2xl text-slate-350 transition-all self-start flex items-center gap-2 text-xs font-bold"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          Reload Data
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {message && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center gap-2">
          <Check size={16} />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pool Table Reordering */}
        <div className="lg:col-span-2 bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Model Failover Pool</h3>
            <span className="text-[10px] bg-indigo-600/10 border border-indigo-600/25 text-indigo-400 px-3 py-1 rounded-full font-bold">
              {failoverPool.length} Active Candidates
            </span>
          </div>

          {failoverPool.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-600 font-bold text-xs gap-3 border border-dashed border-white/10 rounded-2xl bg-slate-950/40">
              <Bot size={36} className="text-slate-700" />
              <span>No models added to the failover pool.</span>
              <span className="text-[10px] text-slate-750 font-normal">Add models from the right panel to configure your pool.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {failoverPool.map((item, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all
                    ${item.is_enabled 
                      ? 'bg-slate-900/40 border-white/5' 
                      : 'bg-slate-950/20 border-white/5 opacity-50'}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Checkbox */}
                    <input 
                      type="checkbox"
                      checked={item.is_enabled}
                      onChange={() => handleToggleEnabled(index)}
                      className="w-4 h-4 rounded border-white/10 bg-slate-950 accent-indigo-600 cursor-pointer shrink-0"
                    />
                    
                    {/* Index Priority */}
                    <span className="text-xs font-black text-slate-500 font-mono w-6">
                      #{index + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {item.key_label}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Model: <code className="text-slate-400 font-mono">{item.model_id}</code> • Provider: <span className="uppercase text-slate-400 font-semibold">{item.provider}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-xl transition-all"
                      title="Move Up (Increase Priority)"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === failoverPool.length - 1}
                      className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-xl transition-all"
                      title="Move Down (Decrease Priority)"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={() => handleRemoveCandidate(index)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                      title="Remove From Pool"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {failoverPool.length > 0 && (
            <div className="pt-4 flex justify-between items-center border-t border-white/5">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <ShieldAlert size={12} className="text-amber-500" />
                Note: Lower indices represent higher priority and are tried first.
              </span>
              <button
                onClick={handleSavePool}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Save Pool Configuration
              </button>
            </div>
          )}
        </div>

        {/* Add Candidate Form */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleAddCandidate} className="glass p-6 rounded-[2rem] border border-white/5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Add Model Candidate</h3>
            
            {/* Choose Key */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Select Account Key</label>
                <button
                  type="button"
                  onClick={() => handleLoadModels(selectedKeyId)}
                  disabled={loadingModels || !selectedKeyId}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  <RefreshCw className={loadingModels ? 'animate-spin' : ''} size={10} />
                  Load Models
                </button>
              </div>
              <select
                value={selectedKeyId}
                onChange={(e) => handleKeyChange(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-3 text-xs text-white"
              >
                {availableKeys.map(k => (
                  <option key={k.key_id} value={k.key_id}>
                    {k.label} ({k.provider.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Model ID Selection / Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Model ID</label>
                {discoveredModels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManualInput(!manualInput)}
                    className="text-[9px] text-indigo-400 hover:text-indigo-350 font-bold"
                  >
                    {manualInput ? 'Select from list' : 'Input manually'}
                  </button>
                )}
              </div>
              
              {!manualInput && discoveredModels.length > 0 ? (
                <select
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-3 text-xs text-white"
                >
                  {discoveredModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.display_name} ({m.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  placeholder={loadingModels ? "Loading models..." : "e.g. gemini-2.5-flash, llama-3.3-70b-versatile"}
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white font-mono"
                  required
                />
              )}
              
              <span className="text-[9px] text-slate-600 mt-1 block">
                Type or select the exact model ID from the provider specs.
              </span>
            </div>

            <button
              type="submit"
              disabled={!customModelId.trim() || loadingModels}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-black uppercase tracking-wider py-3 px-4 rounded-xl text-indigo-400 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              Add to Pool
            </button>
          </form>

          {/* Quick Info Card */}
          <div className="glass p-6 rounded-[2rem] border border-white/5 text-xs text-slate-450 leading-relaxed space-y-3">
            <h4 className="font-bold text-slate-200">How Failover Works</h4>
            <p>
              When a satellite client requests direct generation, the central server processes pool items sequentially.
            </p>
            <p>
              If a candidate encounters errors like **Quota Exceeded (429)** or **Bad Request**, it silently catches it and attempts the next candidate.
            </p>
            <p className="text-[10px] text-slate-500 italic">
              * If the failover pool is empty or all candidates fail, the system falls back to the administrator's default active key configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
