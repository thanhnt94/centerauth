import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: string;
  description: string;
  category: string;
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'error'|'success', text: string} | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    
    // Convert array structure back to flat key-value pair for API
    const payload = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      const response = await fetch('/admin/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Save failed');
      setMessage({ type: 'success', text: data.message });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, newValue: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  };

  // Group settings by category
  const groupedSettings = settings.reduce((acc, curr) => {
    const cat = curr.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <SettingsIcon className="text-slate-400" />
            System Configuration
          </h2>
          <p className="text-slate-400 mt-2">Manage global settings and behavioral protocols for the Identity Node.</p>
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-2xl flex items-center gap-4 border ${
            message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <span className="font-bold">{message.text}</span>
        </motion.div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 glass rounded-[2rem]">
          <Loader2 className="animate-spin mb-4" size={32} />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {Object.entries(groupedSettings).map(([category, items]) => (
            <div key={category} className="glass p-8 rounded-[2rem] border border-white/5 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                 <ShieldAlert className="text-indigo-400" size={20} />
                 <h3 className="text-lg font-black uppercase tracking-widest text-white">{category}</h3>
              </div>
              
              <div className="space-y-6">
                {items.map(setting => {
                  const isBoolean = setting.value === 'true' || setting.value === 'false';
                  
                  return (
                    <div key={setting.key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                       <div className="flex-1">
                          <label className="text-sm font-bold text-white block mb-1">{setting.key}</label>
                          <p className="text-xs text-slate-500">{setting.description}</p>
                       </div>
                       
                       <div className="w-full md:w-64">
                         {isBoolean ? (
                            <select
                              value={setting.value}
                              onChange={(e) => updateSetting(setting.key, e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-indigo-500 transition-all outline-none"
                            >
                              <option value="true">True (Enabled)</option>
                              <option value="false">False (Disabled)</option>
                            </select>
                         ) : (
                            <input 
                              type="text"
                              value={setting.value}
                              onChange={(e) => updateSetting(setting.key, e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-indigo-500 transition-all outline-none"
                            />
                         )}
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white py-4 px-8 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Committing...' : 'Commit Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
