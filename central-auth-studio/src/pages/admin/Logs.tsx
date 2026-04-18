import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, AlertCircle, History, Clock, User, Activity, FileText } from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  details: string;
  username: string;
  created_at: string;
}

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/api/logs');
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('FAIL')) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (action.includes('ADDED') || action.includes('SUCCESS') || action.includes('LOGIN')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    if (action.includes('SYNC')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <History className="text-amber-500" />
            Audit Logs
          </h2>
          <p className="text-slate-400 mt-2">Comprehensive system event timeline and security monitoring.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full md:w-64 bg-slate-900 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:border-amber-500/50 transition-all outline-none"
            />
          </div>
          <button 
            onClick={fetchLogs}
            className="w-12 h-12 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:border-amber-500/50 transition-all"
          >
            <Clock size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-rose-400 gap-2">
          <AlertCircle />
          <p>{error}</p>
        </div>
      )}

      {/* Log Table */}
      <div className="glass rounded-[2rem] border border-white/5 overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="text-sm font-bold uppercase tracking-widest">Scanning Records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-500 w-48">Timestamp</th>
                  <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-500 w-40">User</th>
                  <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-500 w-48">Action</th>
                  <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-500">System Trace Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      <FileText className="mx-auto mb-3 opacity-20" size={36} />
                      <p className="text-xs font-bold uppercase tracking-widest">No matching logs found</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={log.id} 
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-6 text-sm text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="opacity-50" />
                          {formatDate(log.created_at)}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 shadow overflow-hidden">
                             {log.username === 'System' ? <Activity size={12} /> : <User size={12} />}
                          </div>
                          <span className="text-sm font-bold text-white">{log.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-300">
                        {log.details}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
