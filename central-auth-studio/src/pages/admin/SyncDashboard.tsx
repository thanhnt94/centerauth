import React, { useState } from 'react';
import { 
  RefreshCw, Search, Shield, Zap, 
  AlertTriangle, Link, Link2Off, Trash2,
  CheckCircle2, Globe, Server, RefreshCcw, DownloadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SyncDashboard: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startScan = async () => {
    setScanning(true);
    setReport(null);
    try {
      const response = await fetch('/admin/api/sync/scan');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Scan failed');

      let totalRemoteUsers = 0;
      let anomalies: any[] = [];
      const clientsCount = Object.keys(data.report).length;

      Object.entries(data.report).forEach(([clientId, stats]: [string, any]) => {
        if (stats.error) return; // Skip offline clients
        
        totalRemoteUsers += stats.total;

        stats.missing_links?.forEach((cu: any) => {
          anomalies.push({ type: 'unlinked', email: cu.email, username: cu.username, client: clientId, reason: 'Pending UUID linkage', ca_id: cu.ca_id_suggestion });
        });

        stats.orphans_local?.forEach((cu: any) => {
          anomalies.push({ type: 'orphaned', email: cu.email, username: cu.username, client: clientId, reason: 'Remote user missing from Central Auth' });
        });

        stats.data_mismatch?.forEach((cu: any) => {
          anomalies.push({ type: 'mismatch', email: cu.email, username: cu.username, client: clientId, reason: cu.mismatch_reasons.join(', '), ca_id: cu.central_auth_id });
        });
      });

      setReport({
        timestamp: new Date().toISOString(),
        clientsCount,
        totalRemoteUsers,
        anomalies
      });
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const executeAction = async (action: string, anomaly: any) => {
    setExecuting(anomaly.email + action);
    try {
      const payload: any = {
        action,
        client_id: anomaly.client,
        email: anomaly.email,
        username: anomaly.username,
      };
      
      if (action === 'link_user') {
         payload.central_auth_id = anomaly.ca_id;
      }

      const response = await fetch('/admin/api/sync/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message || 'Execution failed');
      
      showToast(data.message || 'Action executed successfully', 'success');
      // Rescan after successful action
      startScan();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="space-y-10 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold ${
              toast.type === 'success' ? 'bg-emerald-500 text-slate-900' : 'bg-rose-500 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 /> : <AlertTriangle />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Ecosystem Sync</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Cross-platform identity consistency audit</p>
        </div>
        <button 
          onClick={startScan}
          disabled={scanning}
          className={`btn-primary flex items-center gap-3 ${scanning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw size={20} className={scanning ? 'animate-spin' : ''} />
          <span>{scanning ? 'Auditing Ecosystem...' : 'Force Global Scan'}</span>
        </button>
      </div>

      {/* Audit Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: 'Network Probes', value: report ? report.clientsCount : '0', icon: <Globe className="text-indigo-400" /> },
           { label: 'Scanned Records', value: report ? report.totalRemoteUsers : '0', icon: <Server className="text-sky-400" /> },
           { label: 'Pending Syncs', value: report ? report.anomalies.length : '0', icon: <Zap className="text-amber-400" /> },
           { label: 'Integrity Rating', value: report && report.totalRemoteUsers ? Math.round(((report.totalRemoteUsers - report.anomalies.length) / report.totalRemoteUsers) * 100) + '%' : '100%', icon: <Shield className="text-emerald-400" /> },
         ].map((stat, i) => (
           <div key={i} className="glass p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white/5 rounded-2xl">{stat.icon}</div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                    <p className="text-xl font-black text-white">{stat.value}</p>
                 </div>
              </div>
           </div>
         ))}
      </div>

      {!report && !scanning && (
        <div className="glass rounded-[3rem] p-32 text-center border-dashed border-2 border-white/5">
           <div className="max-w-md mx-auto space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto">
                 <Search size={40} className="text-slate-700" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">No Active Audit Data</h3>
              <p className="text-sm font-medium text-slate-500">Initiate a global scan to detect identity discrepancies across the satellite ecosystem.</p>
           </div>
        </div>
      )}

      {report && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 mb-4">
            {report.anomalies.length > 0 ? (
              <AlertTriangle className="text-amber-500" size={18} />
            ) : (
              <CheckCircle2 className="text-emerald-500" size={18} />
            )}
            <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${report.anomalies.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {report.anomalies.length > 0 ? `Identity Anomalies Detected (${report.anomalies.length})` : 'Ecosystem is perfectly synchronized'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {report.anomalies.map((item: any, i: number) => {
              const isMismatch = item.type === 'mismatch';
              const isOrphan = item.type === 'orphaned';
              
              return (
                <div key={i} className={`glass p-8 rounded-[2.5rem] border flex flex-col md:flex-row justify-between items-center gap-6 ${
                  isMismatch ? 'border-sky-500/20 bg-sky-500/5' : 
                  isOrphan ? 'border-rose-500/20 bg-rose-500/5' : 'border-amber-500/20 bg-amber-500/5'
                }`}>
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isMismatch ? 'bg-sky-500/20 text-sky-500' : 
                      isOrphan ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                    }`}>
                      {isMismatch ? <RefreshCcw size={24} /> : isOrphan ? <AlertTriangle size={24} /> : <Link2Off size={24} />}
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">{item.email} <span className="text-slate-500 font-normal">({item.username})</span></div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Server size={10} /> App: {item.client} • {item.reason}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Action buttons differ based on anomaly type */}
                    
                    {(item.type === 'unlinked' || isMismatch) && (
                      <button 
                        onClick={() => executeAction('link_user', item)}
                        disabled={executing !== null}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                      >
                        {isMismatch ? <RefreshCcw size={14} /> : <Link size={14} />} 
                        {isMismatch ? 'Push Sync Update' : 'Force Link UUID'}
                      </button>
                    )}

                    {isOrphan && (
                      <button 
                        onClick={() => executeAction('reverse_sync', item)}
                        disabled={executing !== null}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                      >
                        <DownloadCloud size={14} /> Pull to Central Hub
                      </button>
                    )}

                    <button 
                      onClick={() => executeAction('delete_user', item)}
                      disabled={executing !== null}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Purge Remote Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-8 glass bg-emerald-500/5 border-emerald-500/10 rounded-[2.5rem] flex items-center justify-center gap-4">
            <CheckCircle2 size={24} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Audit Log: Scan completed successfully at {new Date(report.timestamp).toLocaleTimeString()}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

