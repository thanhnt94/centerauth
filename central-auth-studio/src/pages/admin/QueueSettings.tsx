import React, { useState, useEffect } from 'react';
import { Sliders, Loader2, Play, Pause, Save, CheckCircle } from 'lucide-react';

export const QueueSettings: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [rateLimitDelayAI, setRateLimitDelayAI] = useState(60);
  const [rateLimitDelayTTS, setRateLimitDelayTTS] = useState(5);
  const [rateLimitDelayImage, setRateLimitDelayImage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const queueToken = 'super-secret-token-123';
  const headers = {
    'X-Queue-Token': queueToken,
    'Content-Type': 'application/json'
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/queue/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.is_paused);
        setRateLimitDelayAI(data.rate_limit_delay_ai || 60);
        setRateLimitDelayTTS(data.rate_limit_delay_tts || 5);
        setRateLimitDelayImage(data.rate_limit_delay_image || 5);
      }
    } catch (err) {
      console.error('Failed to fetch queue settings:', err);
    } finally {
      loading && setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleTogglePause = async () => {
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/queue/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ is_paused: !isPaused })
      });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.is_paused);
        setSuccessMsg(`Queue is now ${data.is_paused ? 'Paused' : 'Running'}.`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to toggle queue pause:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/queue/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          rate_limit_delay_ai: rateLimitDelayAI,
          rate_limit_delay_tts: rateLimitDelayTTS,
          rate_limit_delay_image: rateLimitDelayImage
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimitDelayAI(data.rate_limit_delay_ai);
        setRateLimitDelayTTS(data.rate_limit_delay_tts);
        setRateLimitDelayImage(data.rate_limit_delay_image);
        setSuccessMsg('Queue processing delay intervals updated successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save queue delays:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[800px] mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Sliders className="text-indigo-500" size={32} />
          Queue Settings
        </h2>
        <p className="text-slate-400 mt-2">Configure background task processing rate limits, execution status, and throttling parameters.</p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 animate-fade-in">
          <CheckCircle size={14} /> {successMsg}
        </div>
      )}

      <div className="glass p-8 rounded-[2rem] border border-white/5 space-y-8">
        {/* Pause/Resume Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
          <div>
            <h3 className="text-lg font-bold text-white">Execution Status</h3>
            <p className="text-xs text-slate-400 mt-1">Temporarily pause or resume processing of pending queue items.</p>
          </div>
          <button
            onClick={handleTogglePause}
            disabled={isSaving}
            className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'}`}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            {isPaused ? 'Resume Processing' : 'Pause Processing'}
          </button>
        </div>

        {/* Rate Limit / Delay Section */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Throttling Delay Intervals</h3>
          <form onSubmit={handleSaveDelay} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI Text Generation Delay</label>
                <div className="flex items-center gap-3 bg-[#0d1321]/60 border border-white/10 rounded-xl px-4 py-3 max-w-[200px]">
                  <input 
                    type="number"
                    min="1"
                    value={rateLimitDelayAI}
                    onChange={(e) => setRateLimitDelayAI(parseInt(e.target.value) || 1)}
                    className="bg-transparent border-none text-white text-sm font-black focus:outline-none w-full text-center"
                  />
                  <span className="text-xs font-bold text-slate-400">sec</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Delay interval between processing text-generation prompts. Keeps LLM API key limits safe from exhaustion.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">TTS Audio Generation Delay</label>
                <div className="flex items-center gap-3 bg-[#0d1321]/60 border border-white/10 rounded-xl px-4 py-3 max-w-[200px]">
                  <input 
                    type="number"
                    min="1"
                    value={rateLimitDelayTTS}
                    onChange={(e) => setRateLimitDelayTTS(parseInt(e.target.value) || 1)}
                    className="bg-transparent border-none text-white text-sm font-black focus:outline-none w-full text-center"
                  />
                  <span className="text-xs font-bold text-slate-400">sec</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Delay interval between generating TTS voice files. Can be small since audio synthesis is generally fast and less rate-restricted.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Image Search Download Delay</label>
                <div className="flex items-center gap-3 bg-[#0d1321]/60 border border-white/10 rounded-xl px-4 py-3 max-w-[200px]">
                  <input 
                    type="number"
                    min="1"
                    value={rateLimitDelayImage}
                    onChange={(e) => setRateLimitDelayImage(parseInt(e.target.value) || 1)}
                    className="bg-transparent border-none text-white text-sm font-black focus:outline-none w-full text-center"
                  />
                  <span className="text-xs font-bold text-slate-400">sec</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Delay interval between image search & download tasks. Prevents hitting image API key limits and blocking.
                </p>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={12} /> Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
