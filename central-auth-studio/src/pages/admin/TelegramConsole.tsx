import React, { useState, useEffect } from 'react';
import { Send, Settings, Users, Bot, Loader2, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TelegramUser {
  id: number;
  user_id: number;
  username: string;
  email: string;
  telegram_chat_id: string;
  reminder_time: string;
  is_active: boolean;
  created_at: string | null;
}

interface SystemSetting {
  key: string;
  value: string;
  description: string;
  category: string;
}

export const TelegramConsole: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'broadcast'>('console');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [tgUsers, setTgUsers] = useState<TelegramUser[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]); // list of chat IDs
  const [testingConnection, setTestingConnection] = useState(false);

  // Form states
  const [broadcastText, setBroadcastText] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/admin/api/settings');
      if (response.ok) {
        const data = await response.json();
        // Filter only Telegram category settings
        const tgSettings = data.filter((s: SystemSetting) => s.category === 'Telegram');
        setSettings(tgSettings);
      }
    } catch (err) {
      console.error('Failed to fetch telegram settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/admin/api/telegram/configs');
      if (response.ok) {
        const data = await response.json();
        setTgUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch telegram users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setStatusMsg(null);

    const payload = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      const response = await fetch('/admin/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setStatusMsg({ type: 'success', text: 'Telegram settings saved successfully.' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error saving settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setSendingBroadcast(true);
    setStatusMsg(null);

    try {
      const response = await fetch('/admin/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_ids: selectedUserIds.length > 0 ? selectedUserIds : undefined,
          text: broadcastText
        })
      });
      const resData = await response.json();
      if (response.ok && resData.status === 'success') {
        setStatusMsg({
          type: 'success',
          text: `Broadcast sent to ${resData.sent_count} users successfully.${resData.failed_count > 0 ? ` (${resData.failed_count} failed)` : ''}`
        });
        setBroadcastText('');
        setSelectedUserIds([]);
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        throw new Error(resData.detail || 'Failed to send broadcast');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error sending broadcast' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const updateSettingValue = (key: string, val: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: val } : s));
  };

  const handleTestConnection = async () => {
    const tokenSetting = settings.find(s => s.key === 'telegram_bot_token');
    const token = tokenSetting?.value || '';
    if (!token) {
      alert('Please enter a bot token first.');
      return;
    }

    setTestingConnection(true);
    setStatusMsg(null);

    try {
      const response = await fetch('/admin/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setStatusMsg({
          type: 'success',
          text: `Connection successful! Connected to bot: ${data.bot_name} (@${data.bot_username})`
        });
        // Update the state
        updateSettingValue('telegram_bot_username', data.bot_username);
      } else {
        throw new Error(data.detail || 'Connection test failed');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const toggleSelectUser = (chatId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Bot className="text-indigo-400" size={32} />
            Telegram Control <span className="text-indigo-400">Panel</span>
          </h2>
          <p className="text-slate-400 mt-2">Configure credentials, monitor active bot members, and send direct broadcast messages.</p>
        </div>

        {/* Sub tabs */}
        <div className="flex bg-[#0d1321]/80 p-1.5 rounded-2xl border border-white/5 self-start">
          <button 
            type="button"
            onClick={() => setActiveSubTab('console')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'console' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'}`}
          >
            <Settings size={14} /> Bot Config
          </button>
          <button 
            type="button"
            onClick={() => setActiveSubTab('broadcast')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'}`}
          >
            <Send size={14} /> Broadcast Space
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold uppercase tracking-wider animate-fade-in ${
          statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {statusMsg.text}
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeSubTab === 'console' && (
          <motion.div
            key="console"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {loadingSettings ? (
              <div className="h-64 glass rounded-3xl flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="glass p-8 rounded-[2rem] border border-white/5 space-y-6">
                <div className="border-b border-white/5 pb-4">
                  <h3 className="text-lg font-bold text-white">Bot Credentials & Status</h3>
                  <p className="text-xs text-slate-400 mt-1">Setup the centralized API parameters and trigger Telegram reminders globally.</p>
                </div>

                <div className="space-y-6">
                  {settings.map(setting => {
                    const isBoolean = setting.value === 'true' || setting.value === 'false';
                    return (
                      <div key={setting.key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-white/5 last:border-none pb-4 last:pb-0">
                        <div className="flex-1">
                          <label className="text-sm font-bold text-white block mb-1">{setting.key}</label>
                          <p className="text-xs text-slate-500">{setting.description}</p>
                        </div>
                        
                        <div className="w-full md:w-80">
                          {isBoolean ? (
                            <select
                              value={setting.value}
                              onChange={(e) => updateSettingValue(setting.key, e.target.value)}
                              className="w-full bg-[#0d1321]/60 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-indigo-500 transition-all outline-none"
                            >
                              <option value="true">True (Enabled)</option>
                              <option value="false">False (Disabled)</option>
                            </select>
                          ) : (
                            <input 
                              type="text"
                              value={setting.value}
                              onChange={(e) => updateSettingValue(setting.key, e.target.value)}
                              className="w-full bg-[#0d1321]/60 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-slate-200 focus:border-indigo-500 transition-all outline-none"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-sky-500 hover:text-sky-400 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingConnection ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                    Test & Activate Connection
                  </button>
                  <button 
                    type="submit" 
                    disabled={savingSettings}
                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingSettings ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save Parameters
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}

        {activeSubTab === 'broadcast' && (
          <motion.div
            key="broadcast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left: Message Broadcast Composer */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSendBroadcast} className="glass p-8 rounded-[2rem] border border-white/5 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Broadcast Message</h3>
                  <p className="text-xs text-slate-400 mt-1">Compose message content to send. HTML markup tags are supported.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Message Content</label>
                  <textarea
                    rows={6}
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="👋 Chào bạn! Hãy ôn tập từ vựng ngày hôm nay nhé...\n(Dùng <b>Chữ đậm</b>, <i>Chữ nghiêng</i> hoặc <code>Code</code>)"
                    className="w-full bg-[#0d1321]/60 border border-white/10 rounded-2xl p-4 text-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-500/50 resize-none min-h-[150px]"
                  />
                </div>

                {selectedUserIds.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Sending only to {selectedUserIds.length} selected bot members</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedUserIds([])}
                      className="text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[9px] uppercase font-black"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastText.trim()}
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingBroadcast ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {sendingBroadcast ? 'Delivering...' : selectedUserIds.length > 0 ? 'Send to Selected' : 'Send to All Connected'}
                </button>
              </form>
            </div>

            {/* Right: Active Bot Members list */}
            <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col max-h-[500px]">
              <div className="mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" />
                  Bot Members
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">Users currently linked and active with the bot.</p>
              </div>

              {loadingUsers ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-slate-500" size={24} />
                </div>
              ) : tgUsers.length > 0 ? (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {tgUsers.map(user => {
                    const isSelected = selectedUserIds.includes(user.telegram_chat_id);
                    return (
                      <div 
                        key={user.id} 
                        onClick={() => toggleSelectUser(user.telegram_chat_id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-indigo-500/10 border-indigo-500/30' 
                            : 'bg-slate-950/20 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{user.username}</p>
                          <p className="text-[9px] text-slate-500 truncate mt-0.5">{user.email}</p>
                        </div>
                        <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                          {user.reminder_time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-[10px] font-black uppercase tracking-wider">
                  No active bot members
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
