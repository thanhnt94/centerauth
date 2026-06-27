import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, Play, Pause, Download, Trash2, 
  Activity, Loader2, FileAudio, RefreshCw, Check
} from 'lucide-react';

interface TTSFile {
  filename: string;
  size_bytes: number;
  created_at: string;
  url: string;
}

interface TTSSettings {
  default_engine: string;
  default_voices: Record<string, string>;
  queue_worker_delay_seconds: number;
  queue_max_retries: number;
}

const EDGE_VOICES_MAP = {
  'vi': { name: 'Hoai My (Vietnamese)', code: 'vi-VN-HoaiMyNeural' },
  'en': { name: 'Aria (English)', code: 'en-US-AriaNeural' },
  'ja': { name: 'Nanami (Japanese)', code: 'ja-JP-NanamiNeural' },
  'zh': { name: 'Xiaoxiao (Chinese)', code: 'zh-CN-XiaoxiaoNeural' },
  'ko': { name: 'SunHi (Korean)', code: 'ko-KR-SunHiNeural' },
  'fr': { name: 'Denise (French)', code: 'fr-FR-DeniseNeural' },
  'de': { name: 'Killian (German)', code: 'de-DE-KillianNeural' },
  'es': { name: 'Elvira (Spanish)', code: 'es-ES-ElviraNeural' },
  'ru': { name: 'Svetlana (Russian)', code: 'ru-RU-SvetlanaNeural' },
  'it': { name: 'Elsa (Italian)', code: 'it-IT-ElsaNeural' }
};

interface TTSConsoleProps {
  defaultTab?: 'playground' | 'settings';
}

export const TTSConsole: React.FC<TTSConsoleProps> = ({ defaultTab = 'playground' }) => {
  const [activeTab, setActiveTab] = useState<'playground' | 'settings'>(defaultTab);

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
  
  // Player State
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Settings State
  const [settings, setSettings] = useState<TTSSettings>({
    default_engine: 'edge',
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
            {activeTab === 'playground' ? 'TTS Speech Synthesizer' : 'TTS Configuration'}
          </h2>
          <p className="text-slate-400 mt-2">
            {activeTab === 'playground' 
              ? 'Test premium Text-to-Speech voices and preview output clips.' 
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

      {activeTab === 'playground' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Synthesizer Workspace */}
          <div className="lg:col-span-2 bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Synthesizer</h3>
            
            <form onSubmit={handleSynthesize} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Engine selection */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">TTS Engine</label>
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-3 px-4 text-xs text-white"
                  >
                    <option value="edge">Microsoft Edge TTS (Premium Neural)</option>
                    <option value="gtts">Google TTS (gTTS Standard)</option>
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
                    {Object.entries(EDGE_VOICES_MAP).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.name} ({key.toUpperCase()})
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

          {/* History / Cached Files */}
          <div className="lg:col-span-1 bg-slate-950/20 border border-white/5 rounded-[2rem] p-8 flex flex-col gap-6 h-[660px]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Cached Audio</h3>
              <button 
                onClick={fetchHistory}
                disabled={historyLoading}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-all"
                title="Refresh Cache List"
              >
                <RefreshCw className={historyLoading ? 'animate-spin' : ''} size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 font-bold text-xs gap-2 py-20">
                  <FileAudio size={36} className="text-slate-700" />
                  <span>No cached speech files.</span>
                </div>
              ) : (
                history.map((file) => (
                  <div 
                    key={file.filename}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all
                      ${playingFile === file.filename 
                        ? 'bg-indigo-600/5 border-indigo-600/30' 
                        : 'bg-slate-900/40 border-white/5'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {file.created_at} • {formatBytes(file.size_bytes)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handlePlayFile(file.url, file.filename)}
                        className={`p-2 rounded-xl transition-all
                          ${playingFile === file.filename 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                      >
                        {playingFile === file.filename ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.filename)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Settings & Queue Monitor */
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
                  <option value="gtts">Google TTS (gTTS Standard)</option>
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
            </div>

            {/* Default Mapped Voices */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Mapped Voices Configuration</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(EDGE_VOICES_MAP).slice(0, 4).map(([lang, info]) => (
                  <div key={lang}>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                      {info.name} Voice String
                    </label>
                    <input
                      type="text"
                      value={settings.default_voices[lang] || info.code}
                      onChange={(e) => {
                        const updatedVoices = { ...settings.default_voices, [lang]: e.target.value };
                        setSettings({ ...settings, default_voices: updatedVoices });
                      }}
                      className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 outline-none rounded-xl py-2.5 px-3.5 text-xs text-white font-mono"
                    />
                  </div>
                ))}
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
