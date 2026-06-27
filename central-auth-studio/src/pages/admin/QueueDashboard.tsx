import React, { useState, useEffect } from 'react';
import { 
  Activity, RefreshCw, Trash2, 
  CheckCircle, XCircle, Clock, Search, Loader2
} from 'lucide-react';

interface TaskItem {
  id: string;
  satellite_source: string;
  prompt: string;
  provider?: string;
  model?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  attempts: number;
  callback_url?: string;
  callback_status?: 'sent' | 'failed' | null;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export const QueueDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [searchPrompt, setSearchPrompt] = useState<string>('');
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const [rateLimitDelay, setRateLimitDelay] = useState(60);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Authentication header token (falls back to system config)
  const queueToken = 'super-secret-token-123';
  const headers = {
    'X-Queue-Token': queueToken,
    'Content-Type': 'application/json'
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/queue/stats', { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch queue stats:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/queue/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.is_paused);
        setRateLimitDelay(data.rate_limit_delay);
      }
    } catch (err) {
      console.error('Failed to fetch queue settings:', err);
    }
  };

  const handleTogglePause = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/queue/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ is_paused: !isPaused })
      });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.is_paused);
      }
    } catch (err) {
      console.error('Failed to toggle queue pause:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/queue/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rate_limit_delay: rateLimitDelay })
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimitDelay(data.rate_limit_delay);
        alert('Saved queue rate limit delay successfully!');
      }
    } catch (err) {
      console.error('Failed to save queue delay:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let url = `/api/queue/list?limit=${limit}&offset=${offset}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (sourceFilter) url += `&satellite_source=${sourceFilter}`;
      
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        let filteredTasks = data.tasks as TaskItem[];
        
        // Local filtering for prompt search if entered
        if (searchPrompt.trim()) {
          filteredTasks = filteredTasks.filter(t => 
            t.prompt.toLowerCase().includes(searchPrompt.toLowerCase()) ||
            t.id.includes(searchPrompt)
          );
        }
        
        setTasks(filteredTasks);
        setTotalCount(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch queue tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll tasks and stats every 5 seconds
  useEffect(() => {
    fetchStats();
    fetchTasks();
    fetchSettings();
    const interval = setInterval(() => {
      fetchStats();
      fetchTasks();
      fetchSettings();
    }, 5000);
    return () => clearInterval(interval);
  }, [statusFilter, sourceFilter, offset, searchPrompt]);

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to remove this task from the queue?')) return;
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/queue/task/${taskId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        fetchStats();
        fetchTasks();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Delete task failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearQueue = async () => {
    let confirmMsg = 'Are you sure you want to clear the entire task queue?';
    if (statusFilter) {
      confirmMsg = `Are you sure you want to clear only the ${statusFilter} tasks?`;
    }
    if (!confirm(confirmMsg)) return;
    
    setLoading(true);
    try {
      let url = '/api/queue/clear';
      if (statusFilter) {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        fetchStats();
        fetchTasks();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to clear queue');
      }
    } catch (err) {
      console.error('Clear queue failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryTask = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/queue/retry/${taskId}`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        fetchStats();
        fetchTasks();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to retry task');
      }
    } catch (err) {
      console.error('Retry task failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle size={10} /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <XCircle size={10} /> Failed
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Loader2 size={10} className="animate-spin" /> Processing
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 border border-white/5 text-slate-400">
            <Clock size={10} /> Pending
          </span>
        );
    }
  };

  const getCallbackBadge = (status?: string | null) => {
    if (status === 'sent') {
      return <span className="text-[10px] font-bold text-emerald-500">Delivered</span>;
    }
    if (status === 'failed') {
      return <span className="text-[10px] font-bold text-rose-500">Failed</span>;
    }
    return <span className="text-[10px] font-bold text-slate-600">—</span>;
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Activity className="text-emerald-500 animate-pulse" size={32} />
            Background Task Queue
          </h2>
          <p className="text-slate-400 mt-2">Monitor asynchronous prompt generation, rate limits, and callback success rates.</p>
        </div>
      </div>

      {/* Queue Controls (Pause & Rate Limit) */}
      <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${isPaused ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {isPaused ? '⏸️' : '▶️'}
          </div>
          <div>
            <h4 className="font-bold text-lg text-white">Queue Controller</h4>
            <p className="text-xs text-slate-400">
              {isPaused 
                ? 'Queue is currently PAUSED. New tasks will wait in queue.' 
                : 'Queue is currently RUNNING and processing tasks.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Rate Limit Input Form */}
          <form onSubmit={handleSaveDelay} className="flex items-center gap-2 bg-[#0d1321]/60 border border-white/10 rounded-xl px-3 py-1.5 w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Interval:</span>
            <input 
              type="number"
              min="1"
              value={rateLimitDelay}
              onChange={(e) => setRateLimitDelay(parseInt(e.target.value) || 1)}
              className="bg-transparent border-none text-white text-sm font-black focus:outline-none w-16 text-center"
            />
            <span className="text-[10px] font-black text-slate-400 uppercase">sec</span>
            <button 
              type="submit" 
              disabled={isSavingSettings}
              className="ml-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50"
            >
              Save
            </button>
          </form>

          {/* Pause Toggle Button */}
          <button
            onClick={handleTogglePause}
            disabled={isSavingSettings}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'}`}
          >
            {isPaused ? 'Resume Queue' : 'Pause Queue'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Requests</span>
          <h3 className="text-3xl font-black text-white mt-4">{stats.total}</h3>
        </div>
        <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending</span>
          <h3 className="text-3xl font-black text-slate-300 mt-4">{stats.pending}</h3>
        </div>
        <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Processing</span>
          <h3 className="text-3xl font-black text-indigo-400 mt-4">{stats.processing}</h3>
        </div>
        <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Completed</span>
          <h3 className="text-3xl font-black text-emerald-400 mt-4">{stats.completed}</h3>
        </div>
        <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Failed</span>
          <h3 className="text-3xl font-black text-rose-400 mt-4">{stats.failed}</h3>
        </div>
      </div>

      {/* Controls & Filter Panel */}
      <div className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-3 text-slate-600" size={16} />
            <input 
              type="text"
              placeholder="Search prompts or task IDs..."
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            className="bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Satellite Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setOffset(0); }}
            className="bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">All Sources</option>
            <option value="vocaburn">Vocaburn</option>
            <option value="grammardata">GrammarData</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleClearQueue}
            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-xl text-rose-400 transition-all active:scale-95"
          >
            <Trash2 size={14} /> Clear Queue
          </button>

          <button 
            onClick={fetchTasks}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-xl text-slate-300 transition-all"
          >
            <RefreshCw size={14} /> Force Refresh
          </button>
        </div>
      </div>

      {/* Task List Table */}
      <div className="glass rounded-[2rem] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-slate-950/40 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="py-5 px-8">Task Info</th>
                <th className="py-5 px-8">Prompt Snippet</th>
                <th className="py-5 px-8 text-center">Status</th>
                <th className="py-5 px-8 text-center">Inference API</th>
                <th className="py-5 px-8 text-center">Callback Delivery</th>
                <th className="py-5 px-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={32} />
                    <span className="text-slate-600 text-xs font-bold uppercase tracking-wider">Streaming Queue logs...</span>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-600 text-xs font-bold uppercase tracking-wider">
                    No matching queue tasks discovered.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-all">
                    {/* Task Info */}
                    <td className="py-6 px-8 space-y-1">
                      <p className="text-xs font-bold text-white max-w-[150px] truncate" title={task.id}>
                        {task.id.substring(0, 8)}...
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">
                          {task.satellite_source}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold">
                          {new Date(task.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>

                    {/* Prompt Snippet */}
                    <td className="py-6 px-8 max-w-[300px]">
                      <p className="text-xs text-slate-300 truncate" title={task.prompt}>
                        {task.prompt}
                      </p>
                      {task.error && (
                        <p className="text-[10px] text-rose-500 mt-1 truncate" title={task.error}>
                          Error: {task.error}
                        </p>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-6 px-8 text-center">
                      <div className="flex justify-center">{getStatusBadge(task.status)}</div>
                    </td>

                    {/* Inference API */}
                    <td className="py-6 px-8 text-center text-xs text-slate-400">
                      {task.provider ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-white capitalize">{task.provider}</p>
                          <p className="text-[9px] text-slate-600 truncate max-w-[120px] mx-auto" title={task.model}>
                            {task.model}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Callback Delivery */}
                    <td className="py-6 px-8 text-center">
                      <div className="space-y-0.5">
                        {getCallbackBadge(task.callback_status)}
                        {task.callback_url && (
                          <p className="text-[9px] text-slate-600 truncate max-w-[120px] mx-auto" title={task.callback_url}>
                            {task.callback_url}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-6 px-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {task.status === 'failed' && (
                          <button
                            onClick={() => handleRetryTask(task.id)}
                            disabled={actionLoading === task.id}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-xl transition-all"
                            title="Retry Task"
                          >
                            {actionLoading === task.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleCancelTask(task.id)}
                          disabled={actionLoading === task.id}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-2.5 rounded-xl transition-all"
                          title="Remove Task"
                        >
                          {actionLoading === task.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalCount > limit && (
          <div className="p-6 bg-slate-950/40 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of {totalCount} tasks
            </span>
            <div className="flex gap-2">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(prev => Math.max(0, prev - limit))}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 text-xs font-bold px-4 py-2 rounded-xl text-slate-300 transition-all"
              >
                Previous
              </button>
              <button
                disabled={offset + limit >= totalCount}
                onClick={() => setOffset(prev => prev + limit)}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 text-xs font-bold px-4 py-2 rounded-xl text-slate-300 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
