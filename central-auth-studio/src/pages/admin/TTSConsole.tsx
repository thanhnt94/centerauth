import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, Play, Pause, Download, Trash2, 
  Activity, Loader2, FileAudio, RefreshCw, Check, Copy
} from 'lucide-react';

interface TTSFile {
  filename: string;
  size_bytes: number;
  created_at: string;
  url: string;
  text?: string;
}

interface TTSSettings {
  default_engine: string;
  google_api_key?: string;
  default_voices: Record<string, any>;
  queue_worker_delay_seconds: number;
  queue_max_retries: number;
}

const EDGE_VOICE_OPTIONS = [
  { value: 'vi-VN-HoaiMyNeural', label: 'Hoai My (Vietnamese - Female)' },
  { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Vietnamese - Male)' },
  { value: 'en-US-AriaNeural', label: 'Aria (English - US - Female)' },
  { value: 'en-US-GuyNeural', label: 'Guy (English - US - Male)' },
  { value: 'en-GB-SoniaNeural', label: 'Sonia (English - UK - Female)' },
  { value: 'ja-JP-NanamiNeural', label: 'Nanami (Japanese - Female)' },
  { value: 'ja-JP-KeitaNeural', label: 'Keita (Japanese - Male)' },
  { value: 'zh-CN-XiaoxiaoNeural', label: 'Xiaoxiao (Chinese - Female)' },
  { value: 'ko-KR-SunHiNeural', label: 'SunHi (Korean - Female)' },
  { value: 'fr-FR-DeniseNeural', label: 'Denise (French - Female)' },
  { value: 'de-DE-KillianNeural', label: 'Killian (German - Male)' },
  { value: 'es-ES-ElviraNeural', label: 'Elvira (Spanish - Female)' },
  { value: 'ru-RU-SvetlanaNeural', label: 'Svetlana (Russian - Female)' },
  { value: 'it-IT-ElsaNeural', label: 'Elsa (Italian - Female)' }
];

const GOOGLE_VOICE_OPTIONS = [
  { value: 'vi-VN-Neural2-A', label: 'Vi (Vietnamese - Female)' },
  { value: 'vi-VN-Neural2-F', label: 'Vi (Vietnamese - Male)' },
  { value: 'en-US-Neural2-H', label: 'En (English - US - Female)' },
  { value: 'en-US-Neural2-J', label: 'En (English - US - Male)' },
  { value: 'ja-JP-Neural2-C', label: 'Ja (Japanese - Female)' },
  { value: 'ja-JP-Neural2-D', label: 'Ja (Japanese - Male)' },
  { value: 'zh-CN-Neural2-C', label: 'Zh (Chinese - Female)' },
  { value: 'ko-KR-Neural2-A', label: 'Ko (Korean - Female)' },
  { value: 'fr-FR-Neural2-B', label: 'Fr (French - Female)' },
  { value: 'de-DE-Neural2-F', label: 'De (German - Male)' },
  { value: 'es-ES-Neural2-F', label: 'Es (Spanish - Female)' },
  { value: 'ru-RU-Wavenet-A', label: 'Ru (Russian - Female)' },
  { value: 'it-IT-Neural2-C', label: 'It (Italian - Female)' }
];

const GTTS_VOICE_OPTIONS = [
  { value: 'vi', label: 'Vietnamese (vi)' },
  { value: 'en', label: 'English (en)' },
  { value: 'ja', label: 'Japanese (ja)' },
  { value: 'zh', label: 'Chinese (zh)' },
  { value: 'ko', label: 'Korean (ko)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'de', label: 'German (de)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'ru', label: 'Russian (ru)' },
  { value: 'it', label: 'Italian (it)' }
];

interface TTSConsoleProps {
  defaultTab?: 'create' | 'gallery' | 'settings';
}

export const TTSConsole: React.FC<TTSConsoleProps> = ({ defaultTab = 'create' }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'gallery' | 'settings'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  // Synthesizer State
  const [inputText, setInputText] = useState('');
  const [selectedLang, setSelectedLang] = useState('vi');
  const [selectedEngine, setSelectedEngine] = useState('edge');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<TTSFile[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  
  // Player State
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Settings State
  const [settings, setSettings] = useState<TTSSettings>({
    default_engine: 'edge',
    google_api_key: '',
    default_voices: {
      vi: 'vi-VN-HoaiMyNeural',
      en: 'en-US-AriaNeural',
      ja: 'ja-JP-NanamiNeural'
    },
    queue_worker_delay_seconds: 5,
    queue_max_retries: 3
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchSettings();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/tts/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load TTS history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/tts/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load TTS settings:', err);
    }
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsSynthesizing(true);
    setPlayUrl(null);
    
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          lang: selectedLang
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPlayUrl(data.url);
        setInputText('');
        fetchHistory();
        
        // Auto play generated audio
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = data.url;
          audioPlayerRef.current.play().catch(e => console.log('Autoplay blocked:', e));
        }
      } else {
        alert('Synthesis failed. Please verify engine status.');
      }
    } catch (err) {
      console.error('Failed to synthesize TTS:', err);
      alert('Network error while requesting speech synthesis.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handlePlayFile = (url: string, filename: string) => {
    if (audioPlayerRef.current) {
      if (playingFile === filename) {
        audioPlayerRef.current.pause();
        setPlayingFile(null);
      } else {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play().catch(e => console.error(e));
        setPlayingFile(filename);
      }
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this audio file?')) return;
    try {
      const res = await fetch(`/api/tts/history/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (playingFile === filename && audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          setPlayingFile(null);
        }
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const handleCopyPath = (url: string, filename: string) => {
    const fullUrl = window.location.origin + url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch('/api/tts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSettingsMessage('Settings updated successfully!');
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage('Failed to update settings.');
      }
    } catch (err) {
      setSettingsMessage('Network error updating settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleVoiceMappingChange = (oldTag: string, newTag: string, engine: string, voice: string) => {
    const updated = { ...settings.default_voices };
    if (oldTag !== newTag) {
      delete updated[oldTag];
    }
    updated[newTag] = { engine, voice };
    setSettings({ ...settings, default_voices: updated });
  };

  const handleAddVoiceMapping = () => {
    let counter = 1;
    let newTag = `custom-${counter}`;
    while (newTag in settings.default_voices) {
      counter++;
      newTag = `custom-${counter}`;
    }
    setSettings({
      ...settings,
      default_voices: {
        ...settings.default_voices,
        [newTag]: { engine: 'edge', voice: 'vi-VN-HoaiMyNeural' }
      }
    });
  };

  const handleRemoveVoiceMapping = (tag: string) => {
    const updated = { ...settings.default_voices };
    delete updated[tag];
    setSettings({ ...settings, default_voices: updated });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-[1450px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Volume2 className="text-indigo-500" size={32} />
            {activeTab === 'create' ? 'TTS Speech Synthesizer' : activeTab === 'gallery' ? 'TTS Cache Gallery' : 'TTS Configuration'}
          </h2>
          <p className="text-slate-400 mt-2">
            {activeTab === 'create' 
              ? 'Test premium Text-to-Speech voices and preview output clips.' 
              : activeTab === 'gallery'
                ? 'Manage and preview cached synthesized speech clips.'
                : 'Configure default voices per language and worker batch details.'}
          </p>
        </div>
      </div>

      {/* Hidden audio element for playback */}
      <audio 
        ref={audioPlayerRef} 
        onEnded={() => setPlayingFile(null)}
        className="hidden" 
      />

      {activeTab === 'create' && (
        <div className="max-w-3xl mx-auto bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Synthesizer</h3>
          
          <form onSubmit={handleSynthesize} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Engine selection */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">TTS Engine</label>
                <select
                  value={selectedEngine}
                  onChange={(e) => {
                    const newEngine = e.target.value;
                    setSelectedEngine(newEngine);
                    // Reset selected voice to first item of new engine list
                    const list = newEngine === 'google' 
                      ? GOOGLE_VOICE_OPTIONS 
                      : newEngine === 'gtts' 
                        ? GTTS_VOICE_OPTIONS 
                        : EDGE_VOICE_OPTIONS;
                    setSelectedLang(list[0].value);
                  }}
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white"
                >
                  <option value="edge">Microsoft Edge TTS (Premium Neural)</option>
                  <option value="gtts">Google Translate (gTTS Free)</option>
                  <option value="google">Google Cloud TTS (Premium Neural2/Wavenet)</option>
                </select>
              </div>

              {/* Voice selection */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Voice & Language</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white"
                >
                  {(selectedEngine === 'google' 
                    ? GOOGLE_VOICE_OPTIONS 
                    : selectedEngine === 'gtts' 
                      ? GTTS_VOICE_OPTIONS 
                      : EDGE_VOICE_OPTIONS).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Text Input */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Text Content</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter text to speak, e.g. [ja:人生][vi:cuộc đời] or standard text blocks..."
                rows={6}
                className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-2xl p-6 text-sm text-white transition-all resize-none placeholder:text-slate-650"
                maxLength={1000}
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Supports multi-language segments using [lang:text] brackets.</span>
                <span>{inputText.length}/1000 chars</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSynthesizing || !inputText.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Synthesizing Speech...
                  </>
                ) : (
                  <>
                    <Volume2 size={16} />
                    Generate Audio Speech
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Generated output player */}
          {playUrl && (
            <div className="p-5 rounded-2xl bg-indigo-600/5 border border-indigo-600/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <FileAudio size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Speech generated successfully!</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click listen or download below.</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePlayFile(playUrl, 'generated')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  {playingFile === 'generated' ? <Pause size={14} /> : <Play size={14} />}
                  Listen
                </button>
                <a 
                  href={playUrl} 
                  download
                  className="bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 p-2.5 rounded-xl transition-all flex items-center"
                >
                  <Download size={14} />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'gallery' && (
        <div className="bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">TTS Audio Gallery</h3>
            <button 
              onClick={fetchHistory}
              disabled={historyLoading}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 transition-all flex items-center gap-2 text-xs font-bold"
            >
              <RefreshCw className={historyLoading ? 'animate-spin' : ''} size={14} />
              Refresh Gallery
            </button>
          </div>

          {historyLoading && history.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading gallery...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-24 text-center text-slate-500 space-y-3">
              <FileAudio size={48} className="mx-auto text-slate-700" />
              <p className="text-sm font-bold">No synthesized TTS audios found.</p>
              <p className="text-xs text-slate-600">Go to TTS Create to generate your first audio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((file) => (
                <div 
                  key={file.filename}
                  className={`p-6 rounded-2xl border transition-all flex flex-col justify-between gap-4
                    ${playingFile === file.filename 
                      ? 'bg-indigo-600/5 border-indigo-600/30 shadow-lg shadow-indigo-600/5' 
                      : 'bg-slate-900/40 border-white/5 hover:border-white/10'}`}
                >
                  <div className="space-y-3">
                    {/* Audio prompt/text */}
                    <div className="p-3 bg-slate-950/30 rounded-xl border border-white/5 min-h-[4rem] flex flex-col justify-center">
                      <p className="text-sm text-white font-medium line-clamp-3 leading-relaxed break-words">
                        {file.text || <span className="text-slate-600 italic">No text content cached</span>}
                      </p>
                    </div>
                    
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 truncate" title={file.filename}>
                        File: {file.filename}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Created: {file.created_at} • Size: {formatBytes(file.size_bytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <button
                      onClick={() => handlePlayFile(file.url, file.filename)}
                      className={`px-4 py-2 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5
                        ${playingFile === file.filename 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'}`}
                    >
                      {playingFile === file.filename ? (
                        <>
                          <Pause size={14} />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          Listen
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyPath(file.url, file.filename)}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-center
                          ${copiedFile === file.filename
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                        title="Copy Path"
                      >
                        {copiedFile === file.filename ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.filename)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                        title="Delete Clip"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings form */}
          <form onSubmit={handleSaveSettings} className="lg:col-span-2 bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Settings Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Default Engine */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Default TTS Engine</label>
                <select
                  value={settings.default_engine}
                  onChange={(e) => setSettings({ ...settings, default_engine: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white"
                >
                  <option value="edge">Microsoft Edge TTS (Premium Neural)</option>
                  <option value="gtts">Google Translate (gTTS Free)</option>
                  <option value="google">Google Cloud TTS (Premium Neural2/Wavenet)</option>
                </select>
              </div>

              {/* Worker interval */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Queue Worker Delay (Seconds)</label>
                <input
                  type="number"
                  value={settings.queue_worker_delay_seconds}
                  onChange={(e) => setSettings({ ...settings, queue_worker_delay_seconds: parseInt(e.target.value) || 5 })}
                  min={1}
                  max={60}
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white"
                />
              </div>

              {/* Google Cloud API Key (Conditionally visible) */}
              {settings.default_engine === 'google' && (
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Google Cloud API Key</label>
                  <input
                    type="password"
                    value={settings.google_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, google_api_key: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white font-mono"
                  />
                </div>
              )}
            </div>

            {/* Dynamic Mapped Voices */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Mapped Voices Configuration</h4>
                <button
                  type="button"
                  onClick={handleAddVoiceMapping}
                  className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-650/20 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg transition-all"
                >
                  + Add Voice Mapping
                </button>
              </div>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(settings.default_voices).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No voice mappings configured. Add a mapping to translate tags in prompts to synthesized voices.</p>
                ) : (
                  Object.entries(settings.default_voices).map(([tag, voice]) => {
                    const info = typeof voice === 'object' && voice !== null
                      ? (voice as { engine: string, voice: string })
                      : { engine: 'edge', voice: String(voice) };
                    const engine = info.engine || 'edge';
                    const voiceVal = info.voice || '';

                    return (
                      <div key={tag} className="flex items-center gap-3 bg-slate-900/30 p-3 rounded-xl border border-white/5">
                        {/* Tag Name */}
                        <div className="w-1/5">
                          <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Prompt Tag</label>
                          <input
                            type="text"
                            value={tag}
                            onChange={(e) => handleVoiceMappingChange(tag, e.target.value, engine, voiceVal)}
                            placeholder="e.g. ja-1"
                            className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-lg py-2 px-3 text-xs text-white font-bold"
                          />
                        </div>

                        {/* Tag Engine */}
                        <div className="w-1/4">
                          <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">TTS Engine</label>
                          <select
                            value={engine}
                            onChange={(e) => {
                              const newEngine = e.target.value;
                              const list = newEngine === 'google' 
                                ? GOOGLE_VOICE_OPTIONS 
                                : newEngine === 'gtts' 
                                  ? GTTS_VOICE_OPTIONS 
                                  : EDGE_VOICE_OPTIONS;
                              handleVoiceMappingChange(tag, tag, newEngine, list[0].value);
                            }}
                            className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-lg py-2.5 px-3 text-xs text-white font-bold"
                          >
                            <option value="edge">Edge TTS (Free)</option>
                            <option value="gtts">gTTS Translate</option>
                            <option value="google">Google Cloud</option>
                          </select>
                        </div>

                        {/* Tag Voice */}
                        <div className="flex-1">
                          <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Voice & Language</label>
                          <select
                            value={voiceVal}
                            onChange={(e) => handleVoiceMappingChange(tag, tag, engine, e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-lg py-2.5 px-3 text-xs text-white font-mono"
                          >
                            {(engine === 'google' 
                              ? GOOGLE_VOICE_OPTIONS 
                              : engine === 'gtts' 
                                ? GTTS_VOICE_OPTIONS 
                                : EDGE_VOICE_OPTIONS).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveVoiceMapping(tag)}
                          className="mt-4 p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all"
                          title="Remove Mapping"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {settingsMessage && (
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                {settingsMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={settingsSaving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-3.5 px-6 rounded-xl transition-all flex items-center gap-2"
            >
              {settingsSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving Settings...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Save TTS Config
                </>
              )}
            </button>
          </form>

          {/* Queue Monitor Info */}
          <div className="lg:col-span-1 bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center gap-2 text-indigo-400">
              <Activity size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Queue Status</h3>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">Active Engine</span>
                <span className="text-white font-mono uppercase font-black">{settings.default_engine}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">Worker Delay</span>
                <span className="text-white font-mono">{settings.queue_worker_delay_seconds}s</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">Max Retries</span>
                <span className="text-white font-mono">{settings.queue_max_retries} attempts</span>
              </div>
            </div>
            
            <div className="p-6 rounded-2xl bg-indigo-600/5 border border-indigo-600/10 text-xs text-indigo-300/80 leading-relaxed">
              <p className="font-bold mb-1 text-white">Centralized Queue Active</p>
              TTS tasks submitted from satellite nodes are processed according to the worker delay setting. Ensure your VPS has `ffmpeg` installed to merge segments successfully.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
