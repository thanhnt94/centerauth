import React, { useState, useEffect } from 'react';
import { Send, Settings, Users, Bot, Loader2, CheckCircle, AlertCircle, Save, History, ExternalLink, FileText, Plus, Trash2, Edit } from 'lucide-react';
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
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'broadcast' | 'logs' | 'templates'>('console');
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

  // Ecosystem Logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Templates states
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTplForm, setShowTplForm] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any | null>(null);

  // Template form fields
  const [tplClientId, setTplClientId] = useState('');
  const [tplMessageType, setTplMessageType] = useState('');
  const [tplLabel, setTplLabel] = useState('');
  const [tplText, setTplText] = useState('');

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/admin/api/telegram/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);
    setStatusMsg(null);

    const payload = {
      id: editingTpl?.id,
      client_id: tplClientId,
      message_type: tplMessageType,
      label: tplLabel,
      template_text: tplText
    };

    try {
      const response = await fetch('/admin/api/telegram/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setStatusMsg({ type: 'success', text: 'Template saved successfully.' });
        setShowTplForm(false);
        fetchTemplates();
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        throw new Error(data.detail || 'Failed to save template');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error saving template' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      const response = await fetch(`/admin/api/telegram/templates/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setStatusMsg({ type: 'success', text: 'Template deleted successfully.' });
        fetchTemplates();
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const openAddTpl = () => {
    setEditingTpl(null);
    setTplClientId('vocaburn');
    setTplMessageType('');
    setTplLabel('');
    setTplText('');
    setShowTplForm(true);
  };

  const openEditTpl = (tpl: any) => {
    setEditingTpl(tpl);
    setTplClientId(tpl.client_id);
    setTplMessageType(tpl.message_type);
    setTplLabel(tpl.label);
    setTplText(tpl.template_text);
    setShowTplForm(true);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch('/admin/api/telegram/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch telegram logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

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
    fetchLogs();
    fetchTemplates();
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
          <button 
            type="button"
            onClick={() => { setActiveSubTab('logs'); fetchLogs(); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'}`}
          >
            <History size={14} /> Notification Log
          </button>
          <button 
            type="button"
            onClick={() => { setActiveSubTab('templates'); fetchTemplates(); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'templates' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText size={14} /> Message Templates
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

        {activeSubTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="glass p-8 rounded-[2rem] border border-white/5 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Ecosystem Telegram Logs</h3>
                  <p className="text-xs text-slate-400 mt-1">Audit log of all Telegram notifications dispatched to user accounts.</p>
                </div>
                <button 
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                >
                  <ExternalLink size={14} className="rotate-180" /> Refresh Log
                </button>
              </div>

              {loadingLogs ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                  No notifications logged in the database
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="py-4 px-4 w-40">Timestamp</th>
                        <th className="py-4 px-4 w-32">User</th>
                        <th className="py-4 px-4 w-28">Satellite</th>
                        <th className="py-4 px-4 w-36">Message Type</th>
                        <th className="py-4 px-4">Message Content</th>
                        <th className="py-4 px-4 w-24 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-white/5 text-xs text-slate-300 hover:bg-white/[0.01] transition-all">
                          <td className="py-4 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {new Date(log.sent_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-4 px-4 font-bold text-white">
                            {log.username}
                          </td>
                          <td className="py-4 px-4 font-bold uppercase tracking-wider text-indigo-400">
                            {log.satellite_source}
                          </td>
                          <td className="py-4 px-4 text-slate-400">
                            {log.message_type || 'General'}
                          </td>
                          <td className="py-4 px-4 max-w-xs truncate" title={log.text}>
                            {log.text.replace(/<[^>]*>/g, '')}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                              log.status === 'success' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="glass p-8 rounded-[2rem] border border-white/5 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Ecosystem Message Templates</h3>
                  <p className="text-xs text-slate-400 mt-1">Configure custom notification formats and prompts for satellite services.</p>
                </div>
                <button 
                  onClick={openAddTpl}
                  className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                >
                  <Plus size={14} /> Create Template
                </button>
              </div>

              {loadingTemplates ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                  No custom message templates configured
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {tpl.client_id}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            Type: {tpl.message_type}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white">{tpl.label}</h4>
                        <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5 text-xs text-slate-350 font-mono whitespace-pre-wrap min-h-[80px]">
                          {tpl.template_text}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-4 border-t border-white/5 mt-4">
                        <button 
                          onClick={() => openEditTpl(tpl)}
                          className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-400 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTplForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-8 rounded-[2rem] w-full max-w-xl space-y-6 border border-white/5"
            >
              <div className="flex justify-between items-start border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{editingTpl ? 'Edit Message Template' : 'Create Message Template'}</h3>
                  <p className="text-xs text-slate-400 mt-1">Configure dynamic message layouts with formatting tags and placeholders.</p>
                </div>
                <button 
                  onClick={() => setShowTplForm(false)} 
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
                >
                  <AlertCircle size={20} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Client ID</label>
                    <input 
                      type="text" 
                      required 
                      value={tplClientId} 
                      onChange={(e) => setTplClientId(e.target.value)}
                      placeholder="e.g. vocaburn" 
                      className="w-full bg-[#0d1321]/60 border border-white/10 rounded-xl p-3.5 text-xs text-white outline-none focus:border-indigo-500/50" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Message Type</label>
                    <input 
                      type="text" 
                      required 
                      value={tplMessageType} 
                      onChange={(e) => setTplMessageType(e.target.value)}
                      placeholder="e.g. study_reminder" 
                      className="w-full bg-[#0d1321]/60 border border-white/10 rounded-xl p-3.5 text-xs text-white outline-none focus:border-indigo-500/50" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Template Label</label>
                  <input 
                    type="text" 
                    required 
                    value={tplLabel} 
                    onChange={(e) => setTplLabel(e.target.value)}
                    placeholder="e.g. Daily Study Alert" 
                    className="w-full bg-[#0d1321]/60 border border-white/10 rounded-xl p-3.5 text-xs text-white outline-none focus:border-indigo-500/50" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1 flex justify-between">
                    <span>Template Message (HTML Supported)</span>
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Placeholders: {"{username}, {due_count}, {learned_count}"}</span>
                  </label>
                  <textarea 
                    required 
                    rows={6}
                    value={tplText} 
                    onChange={(e) => setTplText(e.target.value)}
                    placeholder="👋 Chào {username}!\nHôm nay bạn có {due_count} từ vựng cần ôn tập và đã học {learned_count} từ hôm nay." 
                    className="w-full bg-[#0d1321]/60 border border-white/10 rounded-xl p-4 text-xs font-mono text-white outline-none focus:border-indigo-500/50 resize-none" 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={savingTemplate}
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Template
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
