import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, MessageSquare, Send, Plus, Trash2, 
  RefreshCw, Eye, EyeOff, Loader2, Copy, Edit2,
  AlertCircle, Terminal, Check, UserCheck, Search
} from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  id?: number;
  role: 'user' | 'model' | 'assistant';
  content: string;
  model_used?: string;
  created_at?: string;
}

interface CustomApiKey {
  id: string;
  label: string;
  provider: string;
  api_key: string;
  model: string;
}

interface ProviderConfig {
  key: string;
  model: string;
}

interface AIConfigResponse {
  active_provider: string;
  active_key_id: string;
  api_keys_json: string;
  providers: Record<string, ProviderConfig>;
  has_google_fallback?: boolean;
  has_openai_fallback?: boolean;
  has_groq_fallback?: boolean;
  has_cerebras_fallback?: boolean;
  has_nvidia_fallback?: boolean;
  has_sambanova_fallback?: boolean;
  has_mistral_fallback?: boolean;
  has_cloudflare_fallback?: boolean;
  has_github_models_fallback?: boolean;
  has_cohere_fallback?: boolean;
  has_huggingface_fallback?: boolean;
  has_fireworks_fallback?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI GPT',
  groq: 'Groq Inference',
  cerebras: 'Cerebras AI',
  nvidia: 'NVIDIA NIM',
  sambanova: 'SambaNova Cloud',
  mistral: 'Mistral AI',
  cloudflare: 'Cloudflare Workers AI',
  github_models: 'GitHub Models',
  cohere: 'Cohere',
  huggingface: 'Hugging Face',
  fireworks: 'Fireworks AI'
};

interface ConfiguredAccountCardProps {
  apiKeyItem: CustomApiKey;
  isActive: boolean;
  onSetActive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (apiKeyItem: CustomApiKey) => void;
}

const ConfiguredAccountCard: React.FC<ConfiguredAccountCardProps> = ({
  apiKeyItem,
  isActive,
  onSetActive,
  onDelete,
  onEdit
}) => {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKeyItem.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all
        ${isActive 
          ? 'bg-indigo-600/5 border-indigo-600/30' 
          : 'bg-slate-900/40 border-white/5'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="w-full">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            {apiKeyItem.label}
            {isActive && (
              <span className="flex items-center gap-1 text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                <Check size={8} /> Active
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Default Model: <code className="text-slate-400 font-mono">{apiKeyItem.model || 'Default'}</code></p>
          
          <div className="flex items-center justify-between gap-2 mt-2 bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2">
            <span className="text-[9px] text-slate-400 font-mono truncate max-w-[180px]">
              Key: {showKey ? apiKeyItem.api_key : '••••••••••••••••'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                title={showKey ? "Hide Key" : "Show Key"}
              >
                {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
              <button 
                type="button"
                onClick={handleCopy}
                className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                title="Copy Key"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        {!isActive && (
          <button
            onClick={() => onSetActive(apiKeyItem.id)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all"
          >
            Set Active
          </button>
        )}
        <button
          onClick={() => onEdit(apiKeyItem)}
          className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 p-2.5 rounded-xl transition-all"
          title="Edit Credentials"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => onDelete(apiKeyItem.id)}
          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-2.5 rounded-xl transition-all"
          title="Delete Account"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

interface AIChatConsoleProps {
  defaultTab?: 'chat' | 'keys' | 'gallery';
}

export const AIChatConsole: React.FC<AIChatConsoleProps> = ({ defaultTab = 'chat' }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'keys' | 'gallery'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  
  // Selection state
  const [activeKeyId, setActiveKeyId] = useState('system-google');
  const [selectedModel, setSelectedModel] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<{id: string, display_name: string}[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  
  // API Keys state
  const [aiConfig, setAiConfig] = useState<AIConfigResponse | null>(null);
  const [customKeys, setCustomKeys] = useState<CustomApiKey[]>([]);
  const [activeProviderTab, setActiveProviderTab] = useState<string>('google');
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  
  const [editingKeyItem, setEditingKeyItem] = useState<CustomApiKey | null>(null);

  // Gallery state
  const [caches, setCaches] = useState<any[]>([]);
  const [cachesLoading, setCachesLoading] = useState(false);
  const [cachesSearch, setCachesSearch] = useState('');
  const [cachesPage, setCachesPage] = useState(1);
  const [cachesTotal, setCachesTotal] = useState(0);
  const cachesLimit = 24;
  const [selectedCacheDetail, setSelectedCacheDetail] = useState<any>(null);
  const [regeneratingHash, setRegeneratingHash] = useState<string | null>(null);
  const [regenConfigTarget, setRegenConfigTarget] = useState<any | null>(null);

  const fetchCaches = async (page = cachesPage, searchVal = cachesSearch) => {
    setCachesLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: cachesLimit.toString(),
      });
      if (searchVal.trim()) {
        queryParams.append('search', searchVal.trim());
      }
      const res = await fetch(`/api/chat/ai-cache?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCaches(data.caches || []);
        setCachesTotal(data.total || 0);
        setCachesPage(data.page || 1);
      }
    } catch (err) {
      console.error('Failed to load AI caches:', err);
    } finally {
      setCachesLoading(false);
    }
  };

  const handleDeleteCache = async (hash: string) => {
    if (!confirm('Are you sure you want to delete this cached explanation?')) return;
    try {
      const res = await fetch(`/api/chat/ai-cache/${hash}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCaches(cachesPage, cachesSearch);
      }
    } catch (err) {
      console.error('Failed to delete cache:', err);
    }
  };

  const handleRegenerateCache = async (hash: string, prompt?: string, provider?: string, model?: string) => {
    setRegeneratingHash(hash);
    try {
      const res = await fetch('/api/chat/ai-cache/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_hash: hash, prompt, provider, model })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Cache regenerated successfully!');
        
        // If the prompt changed, the hash in selectedCacheDetail or in caches might have changed.
        // Let's close modal detail to refresh properly.
        setSelectedCacheDetail(null);
        setRegenConfigTarget(null);
        fetchCaches(cachesPage, cachesSearch);
      } else {
        const err = await res.json();
        alert('Regeneration failed: ' + (err.detail || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to regenerate cache:', err);
      alert('Failed to connect to the server.');
    } finally {
      setRegeneratingHash(null);
    }
  };

  // Clear editing state when active provider tab changes
  useEffect(() => {
    setEditingKeyItem(null);
  }, [activeProviderTab]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedText]);

  useEffect(() => {
    fetchSessions();
    fetchCredentials();
  }, []);

  useEffect(() => {
    if (activeTab === 'gallery') {
      fetchCaches(1, '');
    }
  }, [activeTab]);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/chat/settings');
      if (res.ok) {
        const data: AIConfigResponse = await res.json();
        setAiConfig(data);
        setActiveKeyId(data.active_key_id || 'system-google');
        
        try {
          const parsed = JSON.parse(data.api_keys_json || '[]');
          setCustomKeys(parsed);
        } catch {
          setCustomKeys([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch AI credentials:', err);
    }
  };

  // Load models whenever the active account (keyId) changes
  useEffect(() => {
    if (activeKeyId) {
      loadModelsForSelection(activeKeyId);
    }
  }, [activeKeyId]);

  const loadModelsForSelection = async (keyId: string) => {
    setLoadingModels(true);
    setDiscoverError(null);
    try {
      const res = await fetch('/api/chat/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: keyId })
      });
      if (res.ok) {
        const models = await res.json();
        setDiscoveredModels(models);
        
        // Find default model based on selection
        let defaultModel = '';
        if (keyId.startsWith('system-')) {
          const p = keyId.replace('system-', '');
          defaultModel = aiConfig?.providers[p]?.model || '';
        } else {
          const customK = customKeys.find(k => k.id === keyId);
          defaultModel = customK?.model || '';
        }

        if (defaultModel && models.some((m: any) => m.id === defaultModel)) {
          setSelectedModel(defaultModel);
        } else if (models.length > 0) {
          setSelectedModel(models[0].id);
        } else {
          setSelectedModel('');
        }
      } else {
        setDiscoveredModels([]);
        setSelectedModel('');
      }
    } catch (err) {
      setDiscoveredModels([]);
      setSelectedModel('');
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/chat/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          loadSessionMessages(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setChatError(null);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleCreateSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' })
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isStreaming) return;
    setChatError(null);

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      try {
        const res = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' })
        });
        if (res.ok) {
          const newSession = await res.json();
          setSessions(prev => [newSession, ...prev]);
          currentSessionId = newSession.id;
          setActiveSessionId(newSession.id);
        } else {
          setChatError('Failed to initialize session.');
          return;
        }
      } catch (err) {
        setChatError('Failed to initialize session.');
        return;
      }
    }

    const userPrompt = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userPrompt, model_used: selectedModel }]);
    setIsStreaming(true);
    setStreamedText('');

    try {
      // 1. Sync active key and model configuration first
      let resolvedProvider = 'google';
      if (activeKeyId.startsWith('system-')) {
        resolvedProvider = activeKeyId.replace('system-', '');
      } else {
        const matched = customKeys.find(k => k.id === activeKeyId);
        resolvedProvider = matched?.provider || 'google';
      }

      await fetch('/api/chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_provider: resolvedProvider,
          active_key_id: activeKeyId,
          provider_name: resolvedProvider,
          model: selectedModel
        })
      });

      // 2. Fetch the stream response
      const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userPrompt })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to stream response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let textBuffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          textBuffer += chunk;
          setStreamedText(textBuffer);
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: textBuffer, model_used: selectedModel }]);
      setStreamedText('');
      fetchSessions();
    } catch (err: any) {
      setChatError(err.message || 'Connection failed.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveActiveKeyId = async (keyId: string) => {
    setActiveKeyId(keyId);
    try {
      await fetch('/api/chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_key_id: keyId })
      });
    } catch (err) {
      console.error('Failed to update active key ID:', err);
    }
  };

  const handleSaveCustomKey = async (label: string, key: string, provider: string, model: string, editId?: string) => {
    if (!label.trim() || !key.trim()) {
      alert('Label and API Key are required.');
      return;
    }

    let updatedKeys: CustomApiKey[];
    let resolvedActiveId = activeKeyId;

    if (editId) {
      // Edit mode
      updatedKeys = customKeys.map(k => {
        if (k.id === editId) {
          return { ...k, label: label.trim(), api_key: key.trim(), model };
        }
        return k;
      });
    } else {
      // Add mode
      const newKeyItem: CustomApiKey = {
        id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        label: label.trim(),
        provider,
        api_key: key.trim(),
        model
      };
      updatedKeys = [...customKeys, newKeyItem];
      resolvedActiveId = newKeyItem.id;
    }

    try {
      const res = await fetch('/api/chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          api_keys_json: JSON.stringify(updatedKeys),
          active_key_id: resolvedActiveId 
        })
      });
      if (res.ok) {
        setCustomKeys(updatedKeys);
        setActiveKeyId(resolvedActiveId);
        setEditingKeyItem(null);
      } else {
        alert('Failed to save settings.');
      }
    } catch (err) {
      console.error('Failed to save custom key:', err);
    }
  };

  const handleDeleteCustomKey = async (keyId: string) => {
    if (!confirm('Delete this account credential?')) return;
    const updated = customKeys.filter(k => k.id !== keyId);
    
    const payload: any = {
      api_keys_json: JSON.stringify(updated)
    };
    if (activeKeyId === keyId) {
      payload.active_key_id = 'system-google';
    }

    try {
      const res = await fetch('/api/chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setCustomKeys(updated);
        if (activeKeyId === keyId) {
          setActiveKeyId('system-google');
        }
      }
    } catch (err) {
      alert('Failed to delete key.');
    }
  };

  // Group accounts/credentials for selector options
  const renderAccountOptions = () => {
    const list: React.ReactNode[] = [];

    // Custom Keys
    customKeys.forEach(k => {
      list.push(
        <option key={k.id} value={k.id}>
          {PROVIDER_LABELS[k.provider] || k.provider} - {k.label} ({k.model || 'Default'})
        </option>
      );
    });

    // Fallbacks
    if (aiConfig) {
      if (aiConfig.has_google_fallback) {
        list.push(<option key="system-google" value="system-google">Google Studio (Server Default)</option>);
      }
      if (aiConfig.has_openai_fallback) {
        list.push(<option key="system-openai" value="system-openai">OpenAI (Server Default)</option>);
      }
      if (aiConfig.has_groq_fallback) {
        list.push(<option key="system-groq" value="system-groq">Groq (Server Default)</option>);
      }
      if (aiConfig.has_cerebras_fallback) {
        list.push(<option key="system-cerebras" value="system-cerebras">Cerebras AI (Server Default)</option>);
      }
      if (aiConfig.has_nvidia_fallback) {
        list.push(<option key="system-nvidia" value="system-nvidia">NVIDIA NIM (Server Default)</option>);
      }
      if (aiConfig.has_sambanova_fallback) {
        list.push(<option key="system-sambanova" value="system-sambanova">SambaNova Cloud (Server Default)</option>);
      }
      if (aiConfig.has_mistral_fallback) {
        list.push(<option key="system-mistral" value="system-mistral">Mistral AI (Server Default)</option>);
      }
      if (aiConfig.has_cloudflare_fallback) {
        list.push(<option key="system-cloudflare" value="system-cloudflare">Cloudflare Workers AI (Server Default)</option>);
      }
      if (aiConfig.has_github_models_fallback) {
        list.push(<option key="system-github_models" value="system-github_models">GitHub Models (Server Default)</option>);
      }
      if (aiConfig.has_cohere_fallback) {
        list.push(<option key="system-cohere" value="system-cohere">Cohere (Server Default)</option>);
      }
      if (aiConfig.has_huggingface_fallback) {
        list.push(<option key="system-huggingface" value="system-huggingface">Hugging Face (Server Default)</option>);
      }
      if (aiConfig.has_fireworks_fallback) {
        list.push(<option key="system-fireworks" value="system-fireworks">Fireworks AI (Server Default)</option>);
      }
    }

    if (list.length === 0) {
      return <option value="">No Active Account Configured</option>;
    }
    return list;
  };

  return (
    <div className="space-y-8 max-w-[1450px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Bot className="text-indigo-500" size={32} />
            {activeTab === 'chat' 
              ? 'AI Chat Playground' 
              : activeTab === 'gallery'
                ? 'AI Response Cache Gallery'
                : 'AI API Configuration'}
          </h2>
          <p className="text-slate-400 mt-2">
            {activeTab === 'chat' 
              ? 'Interact with different Large Language Models and custom credentials.' 
              : activeTab === 'gallery'
                ? 'Review and manage cached AI generated explanations for Vocaburn cards.'
                : 'Configure multi-account credentials and list available model versions.'}
          </p>
        </div>
        
        {/* Tab switcher */}
        <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 gap-1 self-start md:self-auto shrink-0">
          {[
            { id: 'chat', label: 'Playground' },
            { id: 'gallery', label: 'Cache Gallery' },
            { id: 'keys', label: 'Credentials' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                window.history.pushState(null, '', tab.id === 'chat' ? '/admin/aichat' : tab.id === 'gallery' ? '/admin/ai-gallery' : '/admin/ai-settings');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[720px]">
          {/* Sidebar */}
          <div className="lg:col-span-1 bg-slate-950/40 border border-white/5 rounded-[2rem] p-6 flex flex-col gap-6 h-full">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Dialogues</h3>
              <button 
                onClick={handleCreateSession}
                className="bg-white/5 hover:bg-indigo-600 hover:text-white p-2 rounded-xl text-slate-400 transition-all"
                title="New Session"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>
              ) : sessions.length === 0 ? (
                <div className="text-center p-8 text-slate-600 text-xs font-bold">No active sessions.</div>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => loadSessionMessages(s.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border group
                      ${activeSessionId === s.id 
                        ? 'bg-indigo-600/10 border-indigo-600/30 text-white' 
                        : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare size={16} className={activeSessionId === s.id ? 'text-indigo-400' : 'text-slate-500'} />
                      <span className="text-sm font-bold truncate">{s.title}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-1 rounded transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-3 bg-slate-950/40 border border-white/5 rounded-[2rem] flex flex-col h-full overflow-hidden">
            {/* Header model selection */}
            <div className="bg-slate-950/50 px-8 py-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Inference Account</label>
                  <select
                    value={activeKeyId}
                    onChange={(e) => handleSaveActiveKeyId(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 min-w-[220px]"
                  >
                    {renderAccountOptions()}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Model Variant</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={loadingModels}
                      className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 min-w-[200px]"
                    >
                      {loadingModels ? (
                        <option>Loading models...</option>
                      ) : discoveredModels.length === 0 ? (
                        <option value="">No models discovered</option>
                      ) : (
                        discoveredModels.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name}</option>
                        ))
                      )}
                    </select>
                    <button 
                      type="button"
                      onClick={() => loadModelsForSelection(activeKeyId)}
                      className="p-2.5 bg-slate-900 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl border border-white/10 transition-all"
                    >
                      <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-8 overflow-y-auto space-y-6 custom-scrollbar">
              {messages.length === 0 && !streamedText ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-400">
                    <Bot size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Playground Active</h4>
                    <p className="text-xs text-slate-500 mt-2">Select an account from the dropdown above, and write your prompt below.</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, idx) => (
                    <div 
                      key={idx}
                      className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-md shrink-0
                        ${m.role === 'user' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-900 text-slate-300 border border-white/5'}`}
                      >
                        {m.role === 'user' ? 'U' : 'AI'}
                      </div>
                      
                      <div className="space-y-1">
                        <div className={`p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap
                          ${m.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-none'}`}
                        >
                          {m.content}
                        </div>
                        {m.model_used && (
                          <div className={`text-[9px] font-bold text-slate-500 flex items-center gap-1 ${m.role === 'user' ? 'justify-end' : ''}`}>
                            <Terminal size={10} />
                            <span>{m.model_used}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Streaming Block */}
                  {streamedText && (
                    <div className="flex gap-4 max-w-[85%]">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-slate-300 border border-white/5 flex items-center justify-center text-xs font-black shadow-md shrink-0">
                        AI
                      </div>
                      <div className="space-y-1">
                        <div className="p-4 rounded-3xl bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-none text-sm leading-relaxed whitespace-pre-wrap">
                          {streamedText}
                          <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-1 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {chatError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{chatError}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-8 border-t border-white/5 bg-slate-950/20 flex gap-4">
              <input 
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a prompt..."
                disabled={isStreaming}
                className="flex-1 bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-2xl px-6 py-4 text-sm text-white transition-all placeholder:text-slate-600"
              />
              <button 
                type="submit"
                disabled={isStreaming || !inputMessage.trim() || activeKeyId === ""}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-4 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center justify-center shrink-0"
              >
                {isStreaming ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'keys' && (
        <div className="glass p-8 rounded-[2rem] border border-white/5 grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Provider Sidebar Tabs */}
          <div className="lg:col-span-1 bg-slate-950/20 border-r border-white/5 pr-6 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Providers</h3>
            {Object.keys(PROVIDER_LABELS).map((providerKey) => {
              const count = customKeys.filter(k => k.provider === providerKey).length;
              const hasFallback = aiConfig?.[`has_${providerKey}_fallback` as keyof AIConfigResponse];
              return (
                <button
                  key={providerKey}
                  onClick={() => { setActiveProviderTab(providerKey); setDiscoverError(null); }}
                  className={`w-full text-left p-4 rounded-2xl font-bold text-sm flex items-center justify-between transition-all
                    ${activeProviderTab === providerKey 
                      ? 'bg-indigo-600/10 text-white border-l-4 border-indigo-600' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <span>{PROVIDER_LABELS[providerKey]}</span>
                  <div className="flex items-center gap-1.5">
                    {hasFallback && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="System fallback active" />}
                    {count > 0 && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-bold">{count}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Accounts settings Panel */}
          <div className="lg:col-span-3 space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-black text-white">{PROVIDER_LABELS[activeProviderTab]} Credentials</h3>
              {aiConfig?.[`has_${activeProviderTab}_fallback` as keyof AIConfigResponse] && (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl text-xs font-bold">
                  <UserCheck size={14} /> System Fallback Enabled
                </div>
              )}
            </div>

            {/* List existing custom keys */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Configured Accounts</h4>
              {customKeys.filter(k => k.provider === activeProviderTab).length === 0 ? (
                <p className="text-slate-600 text-xs font-bold">No custom accounts added for this provider.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customKeys.filter(k => k.provider === activeProviderTab).map(k => (
                    <ConfiguredAccountCard
                      key={k.id}
                      apiKeyItem={k}
                      isActive={activeKeyId === k.id}
                      onSetActive={handleSaveActiveKeyId}
                      onDelete={handleDeleteCustomKey}
                      onEdit={setEditingKeyItem}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Add custom key form */}
            <AddCustomKeyForm 
              provider={activeProviderTab}
              onSave={handleSaveCustomKey}
              discoverError={discoverError}
              setDiscoverError={setDiscoverError}
              editingKeyItem={editingKeyItem}
              onCancelEdit={() => setEditingKeyItem(null)}
            />
          </div>
        </div>
      )}

      {activeTab === 'gallery' && (
        <div className="bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">AI Response Cache</h3>
            <button 
              onClick={() => fetchCaches(cachesPage, cachesSearch)}
              disabled={cachesLoading}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 transition-all flex items-center gap-2 text-xs font-bold"
            >
              <RefreshCw className={cachesLoading ? 'animate-spin' : ''} size={14} />
              Refresh Cache
            </button>
          </div>

          {/* Search Input */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-3 text-slate-500" size={16} />
              <input 
                type="text" 
                value={cachesSearch}
                onChange={(e) => {
                  setCachesSearch(e.target.value);
                  setCachesPage(1);
                  fetchCaches(1, e.target.value);
                }}
                placeholder="Search prompt or response..."
                className="w-full bg-slate-900/50 border border-white/5 focus:border-indigo-500 outline-none rounded-2xl py-3 pl-12 pr-4 text-xs text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {cachesLoading && caches.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading cache...</span>
            </div>
          ) : caches.length === 0 ? (
            <div className="py-24 text-center text-slate-500 space-y-3">
              <MessageSquare size={48} className="mx-auto text-slate-700" />
              <p className="text-sm font-bold">No cached AI responses found.</p>
              <p className="text-xs text-slate-600">Tasks processed through the AI Queue will automatically be cached here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {caches.map((item) => {
                  const matchInput = item.prompt.match(/Input:\s*([^\n\r]+)/i);
                  const queryTerm = matchInput ? matchInput[1].trim() : 'AI Explanation';
                  const mainTitle = queryTerm.split('/')[0].trim();
                  const subTitle = queryTerm.includes('/') ? queryTerm.substring(queryTerm.indexOf('/') + 1).trim() : '';

                  return (
                    <div 
                      key={item.prompt_hash}
                      onClick={() => setSelectedCacheDetail(item)}
                      className="p-5 bg-slate-900/40 border border-white/5 hover:border-indigo-500/50 hover:bg-slate-900/80 rounded-2xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden h-[180px]"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-500 font-mono">{item.prompt_hash.substring(0, 10)}</span>
                          <span className="bg-slate-950/60 px-2 py-0.5 border border-white/5 rounded text-[8px] font-black uppercase text-indigo-400">
                            {item.provider}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate" title={mainTitle}>
                          {mainTitle}
                        </h4>
                        {subTitle && (
                          <p className="text-[10px] text-slate-400 truncate" title={subTitle}>{subTitle}</p>
                        )}

                        <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed mt-1">
                          {item.response.replace(/[#*`\-]/g, '').trim()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[8px] text-slate-650 font-bold uppercase">{item.created_at.split(' ')[0]}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setRegenConfigTarget(item)}
                            disabled={regeneratingHash === item.prompt_hash}
                            className="p-1 hover:text-indigo-400 text-slate-500 transition-colors disabled:opacity-30"
                            title="Regenerate Cache"
                          >
                            {regeneratingHash === item.prompt_hash ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.response);
                              alert('Copied response!');
                            }}
                            className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                            title="Copy response"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCache(item.prompt_hash)}
                            className="p-1 hover:text-rose-500 text-slate-555 transition-colors"
                            title="Delete Cache"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {cachesTotal > cachesLimit && (
                <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-6">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    Showing {Math.min((cachesPage - 1) * cachesLimit + 1, cachesTotal)} - {Math.min(cachesPage * cachesLimit, cachesTotal)} of {cachesTotal} caches
                  </span>
                  <div className="flex gap-2">
                    <button 
                      disabled={cachesPage === 1}
                      onClick={() => {
                        const newPage = cachesPage - 1;
                        setCachesPage(newPage);
                        fetchCaches(newPage);
                      }}
                      className="px-3 py-1.5 bg-slate-900 border border-white/10 hover:bg-indigo-500 hover:text-white rounded-xl text-xs font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-all cursor-pointer"
                    >
                      Previous
                    </button>
                    <button 
                      disabled={cachesPage * cachesLimit >= cachesTotal}
                      onClick={() => {
                        const newPage = cachesPage + 1;
                        setCachesPage(newPage);
                        fetchCaches(newPage);
                      }}
                      className="px-3 py-1.5 bg-slate-900 border border-white/10 hover:bg-indigo-500 hover:text-white rounded-xl text-xs font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-all cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cache Detail Modal */}
      {selectedCacheDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedCacheDetail(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
              <div>
                <h3 className="text-lg font-black text-white">Cache Detail</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">HASH: {selectedCacheDetail.prompt_hash}</p>
              </div>
              <button 
                onClick={() => setSelectedCacheDetail(null)}
                className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all font-bold text-xs"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Prompt & Input</h4>
                <div className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl text-xs text-slate-300 font-mono break-words whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar">
                  {selectedCacheDetail.prompt}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Cached AI Explanation</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRegenConfigTarget(selectedCacheDetail)}
                      disabled={regeneratingHash === selectedCacheDetail.prompt_hash}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-xl transition-all disabled:opacity-30"
                    >
                      {regeneratingHash === selectedCacheDetail.prompt_hash ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedCacheDetail.response);
                        alert('Copied response to clipboard!');
                      }}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-xl transition-all"
                    >
                      <Copy size={12} />
                      Copy Explanation
                    </button>
                  </div>
                </div>
                <div className="p-5 bg-slate-950/70 border border-white/5 rounded-2xl text-sm text-slate-200 break-words whitespace-pre-wrap leading-relaxed">
                  {selectedCacheDetail.response}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 flex justify-between items-center bg-slate-950/20 text-[10px] text-slate-500 font-bold uppercase">
              <span>Provider: {selectedCacheDetail.provider} ({selectedCacheDetail.model})</span>
              <span>Cached at: {selectedCacheDetail.created_at}</span>
            </div>
          </div>
        </div>
      )}

      {/* Regeneration Config Modal */}
      {regenConfigTarget && (
        <RegenConfigModal
          cache={regenConfigTarget}
          onClose={() => setRegenConfigTarget(null)}
          onRegenerate={handleRegenerateCache}
          isRegenerating={regeneratingHash === regenConfigTarget.prompt_hash}
        />
      )}
    </div>
  );
};

interface RegenConfigModalProps {
  cache: any;
  onClose: () => void;
  onRegenerate: (hash: string, prompt: string, provider: string, model: string) => Promise<void>;
  isRegenerating: boolean;
}

const RegenConfigModal: React.FC<RegenConfigModalProps> = ({
  cache,
  onClose,
  onRegenerate,
  isRegenerating
}) => {
  const [prompt, setPrompt] = useState(cache.prompt);
  const [provider, setProvider] = useState(cache.provider || 'google');
  const [model, setModel] = useState(cache.model || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegenerate(cache.prompt_hash, prompt, provider, model);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
            <div>
              <h3 className="text-lg font-black text-white">Regenerate Cache Settings</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Customize prompt, provider and model for this explanation</p>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all font-bold text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Edit Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white resize-y font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">AI Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-2 px-3 text-xs text-white"
                >
                  {Object.keys(PROVIDER_LABELS).map((key) => (
                    <option key={key} value={key}>{PROVIDER_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Model Variant</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gemini-2.5-pro, gpt-4o"
                  className="w-full bg-slate-950 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-2 px-3 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/5 bg-slate-950/20 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold py-2.5 px-4 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRegenerating || !prompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"
            >
              {isRegenerating && <Loader2 size={12} className="animate-spin" />}
              {isRegenerating ? 'Regenerating...' : 'Regenerate & Sync'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Form sub-component for adding keys with interactive model discovery
interface AddCustomKeyFormProps {
  provider: string;
  onSave: (label: string, key: string, provider: string, model: string, editId?: string) => Promise<void>;
  discoverError: string | null;
  setDiscoverError: (err: string | null) => void;
  editingKeyItem: CustomApiKey | null;
  onCancelEdit: () => void;
}

const AddCustomKeyForm: React.FC<AddCustomKeyFormProps> = ({
  provider,
  onSave,
  discoverError,
  setDiscoverError,
  editingKeyItem,
  onCancelEdit
}) => {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [discovered, setDiscovered] = useState<{id: string, display_name: string}[]>([]);
  const [loading, setLoading] = useState(false);

  // Clear state when provider changes or editing item changes
  useEffect(() => {
    if (editingKeyItem) {
      setLabel(editingKeyItem.label);
      setKey(editingKeyItem.api_key);
      setModel(editingKeyItem.model);
      handleVerify(editingKeyItem.api_key);
    } else {
      setLabel('');
      setKey('');
      setModel('');
      setDiscovered([]);
      setDiscoverError(null);
    }
  }, [provider, editingKeyItem]);

  const handleVerify = async (providedKey?: string) => {
    const keyToVerify = providedKey || key;
    if (!keyToVerify.trim()) {
      alert('API Key is required to verify.');
      return;
    }
    setLoading(true);
    setDiscoverError(null);
    try {
      const res = await fetch('/api/chat/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: keyToVerify.trim() })
      });
      if (res.ok) {
        const models = await res.json();
        setDiscovered(models);
        if (models.length > 0) {
          if (editingKeyItem && models.some((m: any) => m.id === editingKeyItem.model)) {
            setModel(editingKeyItem.model);
          } else {
            setModel(models[0].id);
          }
        }
      } else {
        const err = await res.json();
        setDiscoverError(err.detail || 'API key verification failed.');
        setDiscovered([]);
      }
    } catch {
      setDiscoverError('Network failure verifying key.');
      setDiscovered([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(label, key, provider, model, editingKeyItem?.id);
    setLabel('');
    setKey('');
    setModel('');
    setDiscovered([]);
  };

  return (
    <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl border border-white/5 space-y-4 max-w-xl">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
        {editingKeyItem ? `Edit Account: ${editingKeyItem.label}` : 'Add New Account'}
      </h4>
      
      <div className="space-y-3">
        {/* Label */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Account Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Work Account, Personal Key"
            className="w-full bg-slate-950 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-2 px-3 text-xs text-white"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter provider key..."
              className="w-full bg-slate-950 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-2 px-3 pr-10 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2 text-slate-500 hover:text-white"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Verification and model selection */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Default Model</label>
          <div className="flex gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={discovered.length === 0}
              className="flex-1 bg-slate-950 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-2 px-3 text-xs text-white"
            >
              {discovered.length === 0 ? (
                <option value="">Verify key to list models</option>
              ) : (
                discovered.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => handleVerify()}
              disabled={loading || !key.trim()}
              className="bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-xs font-bold px-4 py-2 rounded-xl text-slate-300 transition-all flex items-center gap-1.5"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Verify Key
            </button>
          </div>
        </div>
      </div>

      {discoverError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold">
          {discoverError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!label.trim() || !key.trim()}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all"
        >
          {editingKeyItem ? 'Update Credentials' : 'Save Credentials'}
        </button>
        {editingKeyItem && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="bg-slate-800 hover:bg-slate-750 border border-white/5 text-slate-300 text-xs font-bold py-2.5 px-4 rounded-xl transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
