import React, { useState, useEffect } from 'react';
import { 
  Activity, RefreshCw, Trash2, 
  CheckCircle, XCircle, Clock, Search, Loader2, Volume2, FileText, Copy
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
  task_type?: 'ai-explain' | 'tts';
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
  const [viewingResult, setViewingResult] = useState<string | null>(null);
  
  // Clear Queue Modal States
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<'unrun' | 'logs' | 'all'>('unrun');
  const [clearTaskType, setClearTaskType] = useState<string>('');
  const [clearSource, setClearSource] = useState<string>('');
  
  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [searchPrompt, setSearchPrompt] = useState<string>('');
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

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

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let url = `/api/queue/list?limit=${limit}&offset=${offset}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (sourceFilter) url += `&satellite_source=${sourceFilter}`;
      if (taskTypeFilter) url += `&task_type=${taskTypeFilter}`;
      if (providerFilter) url += `&provider=${providerFilter}`;
      
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
    const interval = setInterval(() => {
      fetchStats();
      fetchTasks();
    }, 5000);
    return () => clearInterval(interval);
  }, [statusFilter, sourceFilter, taskTypeFilter, providerFilter, offset, searchPrompt]);

  const handleCopyPrompt = (taskId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTaskId(taskId);
    setTimeout(() => {
      setCopiedTaskId(null);
    }, 1500);
  };

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
    setIsClearModalOpen(false);
    setLoading(true);
    try {
      let url = `/api/queue/clear?target=${clearTarget}`;
      if (clearTaskType) {
        url += `&task_type=${clearTaskType}`;
      }
      if (clearSource) {
        url += `&satellite_source=${clearSource}`;
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

          {/* Task Type Filter */}
          <select
            value={taskTypeFilter}
            onChange={(e) => { setTaskTypeFilter(e.target.value); setOffset(0); }}
            className="bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">All Types</option>
            <option value="ai">AI Text</option>
            <option value="tts">TTS Audio</option>
          </select>

          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setOffset(0); }}
            className="bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">All Providers</option>
            <option value="google">Google</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
            <option value="cerebras">Cerebras</option>
            <option value="nvidia">NVIDIA</option>
            <option value="sambanova">SambaNova</option>
            <option value="mistral">Mistral</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="github_models">GitHub Models</option>
            <option value="cohere">Cohere</option>
            <option value="huggingface">HuggingFace</option>
            <option value="fireworks">Fireworks</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setIsClearModalOpen(true)}
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
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/10">
                          {task.satellite_source}
                        </span>
                        {task.task_type === 'tts' ? (
                          <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/10 flex items-center gap-0.5">
                            <Volume2 size={8} /> TTS
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10 flex items-center gap-0.5">
                            <FileText size={8} /> AI
                          </span>
                        )}
                        <span className="text-[8px] text-slate-500 font-bold ml-1">
                          {new Date(task.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>

                    {/* Prompt Snippet */}
                    <td className="py-6 px-8 max-w-[300px]">
                      <div className="flex items-center justify-between gap-2 group">
                        <p className="text-xs text-slate-300 truncate flex-1 font-medium" title={task.prompt}>
                          {task.prompt}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(task.id, task.prompt)}
                          className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center min-w-[24px]"
                          title="Copy prompt"
                        >
                          {copiedTaskId === task.id ? (
                            <span className="text-[8px] font-bold text-emerald-400">Copied!</span>
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
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
                        {task.status === 'completed' && task.result && task.result.includes('/static/uploads/tts/') && (
                          <button
                            onClick={() => {
                              const audioUrl = task.result;
                              const audio = new Audio(audioUrl);
                              audio.play().catch(e => alert('Cannot play audio: ' + e));
                            }}
                            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 p-2.5 rounded-xl transition-all"
                            title="Play TTS Audio"
                          >
                            <Volume2 size={14} />
                          </button>
                        )}

                        {task.status === 'completed' && task.result && !task.result.includes('/static/uploads/tts/') && (
                          <button
                            onClick={() => setViewingResult(task.result || null)}
                            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 p-2.5 rounded-xl transition-all"
                            title="View Generated Result"
                          >
                            <FileText size={14} />
                          </button>
                        )}

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
      {/* Result Viewer Modal */}
      {viewingResult !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass max-w-2xl w-full p-8 rounded-[2rem] border border-white/10 flex flex-col max-h-[85vh] animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="text-indigo-400" size={20} />
                AI Generated Result
              </h3>
              <button 
                onClick={() => setViewingResult(null)} 
                className="text-slate-500 hover:text-white font-bold text-sm bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all active:scale-95"
              >
                Close [X]
              </button>
            </div>
            <div className="overflow-y-auto flex-1 bg-slate-900/60 p-6 rounded-xl border border-white/5 text-sm text-slate-300 font-medium whitespace-pre-wrap font-sans max-h-[50vh]">
              {viewingResult}
            </div>
          </div>
        </div>
      )}

      {/* Clear Queue Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-8 rounded-[2rem] border border-white/10 flex flex-col animate-fade-in space-y-6">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="text-rose-500" size={20} />
                DỌN DẸP HÀNG ĐỢI
              </h3>
              <p className="text-slate-400 text-xs mt-1">Cấu hình bộ lọc nâng cao để xóa các mục trong hàng đợi.</p>
            </div>

            <div className="space-y-4">
              {/* Target Type */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đối tượng xóa</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setClearTarget('unrun')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      clearTarget === 'unrun'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    Chưa chạy (Pending)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearTarget('logs')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      clearTarget === 'logs'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    Nhật ký cũ (Logs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearTarget('all')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      clearTarget === 'all'
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    Tất cả (All)
                  </button>
                </div>
              </div>

              {/* Task Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Loại tác vụ</label>
                <select
                  value={clearTaskType}
                  onChange={(e) => setClearTaskType(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">Tất cả loại (All)</option>
                  <option value="ai">AI Text</option>
                  <option value="tts">TTS Audio</option>
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nguồn gửi (Satellite Source)</label>
                <select
                  value={clearSource}
                  onChange={(e) => setClearSource(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">Tất cả nguồn (All)</option>
                  <option value="vocaburn">Vocaburn</option>
                  <option value="grammardata">GrammarData</option>
                  <option value="quizmind">QuizMind</option>
                  <option value="podlearn">PodLearn</option>
                </select>
              </div>
            </div>

            {/* Warning description */}
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-[11px] text-rose-400 leading-relaxed font-sans">
              <strong>Lưu ý:</strong> {
                clearTarget === 'unrun' 
                  ? 'Hành động này sẽ hủy tất cả các tác vụ đang chờ xử lý khớp với bộ lọc trên. Nhật ký đã xử lý sẽ KHÔNG bị ảnh hưởng.' 
                  : clearTarget === 'logs'
                  ? 'Hành động này sẽ xóa nhật ký cũ (thành công/thất bại) khớp với bộ lọc trên để giải phóng dung lượng. Các tác vụ chưa chạy sẽ KHÔNG bị ảnh hưởng.'
                  : 'CẢNH BÁO: Hành động này sẽ xóa sạch cả các tác vụ đang chờ xử lý và nhật ký cũ khớp với bộ lọc trên.'
              }
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-xl text-slate-300 transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleClearQueue}
                className="bg-rose-500 hover:bg-rose-600 text-xs font-bold uppercase tracking-wider py-2.5 px-5 rounded-xl text-white transition-all active:scale-95"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
