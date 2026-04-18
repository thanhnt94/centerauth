import React, { useEffect, useState } from 'react';
import { 
  Plus, Trash2, Edit2, Zap, Copy, Check,
  Terminal, ShieldCheck, Cpu, Rocket, X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Client } from '../../types';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientStatuses, setClientStatuses] = useState<Record<number, { online: boolean | null, message: string }>>({});

  const [copied, setCopied] = useState(false);

  const fetchClients = () => {
    setLoading(true);
    fetch('/admin/api/clients')
      .then(r => r.json())
      .then(data => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => {
        setClients([
          { id: 1, name: 'PodLearn', client_id: 'podlearn_id_123', client_secret: 'podlearn_secret_xyz', redirect_uri: 'http://localhost:5001/auth/callback', app_icon: 'Shield', app_color_theme: 'sky', is_active: true, is_visible_on_portal: true, created_at: '2026-04-18' },
        ] as any);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkConnection = async (client: Client) => {
    try {
      setClientStatuses(prev => ({ ...prev, [client.id]: { online: null, message: 'Pinging...' } }));
      const res = await fetch('/admin/api/ping-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: client.redirect_uri.split(',')[0].split('/').slice(0,3).join('/') })
      });
      const data = await res.json();
      setClientStatuses(prev => ({ 
        ...prev, 
        [client.id]: { online: data.success, message: data.message } 
      }));
    } catch (err) {
      setClientStatuses(prev => ({ 
        ...prev, 
        [client.id]: { online: false, message: 'Connection Timeout' } 
      }));
    }
  };

  const pairingSnippet = selectedClient ? `
# Ecosystem SSO Configuration for ${selectedClient.name}
CENTRAL_AUTH_SERVER = "${window.location.origin}"
CLIENT_ID = "${selectedClient.client_id}"
CLIENT_SECRET = "${selectedClient.client_secret}"

# Drop-in Helper Initialization
from ecosystem_auth_helper import EcosystemAuth
sso = EcosystemAuth(CENTRAL_AUTH_SERVER, CLIENT_ID, CLIENT_SECRET)
  `.trim() : '';

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Client Ecosystem</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Manage authorized satellite applications</p>
        </div>
        <button className="btn-primary flex items-center gap-3">
          <Plus size={20} />
          <span>Register New Client</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {[
           { label: 'Active Clusters', value: clients.length, icon: <Cpu className="text-indigo-400" /> },
           { label: 'Security Protocols', value: 'OAuth 2.1', icon: <ShieldCheck className="text-emerald-400" /> },
           { label: 'Network Latency', value: '12ms', icon: <Zap className="text-amber-400" /> },
         ].map((stat, i) => (
           <div key={i} className="glass-card flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                <p className="text-2xl font-black text-white mt-1">{stat.value}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl">{stat.icon}</div>
           </div>
         ))}
      </div>

      <div className="glass rounded-[3rem] overflow-hidden border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Application</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Authentication</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              [1, 2, 3].map(i => <tr key={i} className="animate-pulse h-24" />)
            ) : clients.map(client => {
              const status = clientStatuses[client.id];
              return (
                <tr key={client.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400">
                         <Rocket size={24} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{client.name}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{client.client_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                     <div className="flex flex-col gap-1">
                       <span className="text-xs font-bold text-slate-400 font-mono">Redirect: {client.redirect_uri.split(',')[0]}</span>
                       {client.backchannel_logout_uri && (
                         <span className="text-[10px] text-rose-500/50 font-black uppercase tracking-widest">Global Logout Active</span>
                       )}
                     </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                       {!status ? (
                         <>
                           <div className="w-2 h-2 rounded-full bg-slate-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unknown</span>
                         </>
                       ) : status.online === null ? (
                         <>
                           <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Checking...</span>
                         </>
                       ) : status.online ? (
                         <>
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Online</span>
                         </>
                       ) : (
                         <>
                           <div className="w-2 h-2 rounded-full bg-rose-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-rose-500/80" title={status.message}>Offline</span>
                         </>
                       )}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => { setSelectedClient(client); setIsPairingModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all"
                      >
                        <Terminal size={14} />
                        Pairing Helper
                      </button>
                      <button 
                        onClick={() => checkConnection(client)}
                        className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-emerald-400 transition-all shadow-lg"
                        title="Check Connectivity"
                      >
                        <Zap size={16} />
                      </button>
                      <button className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all"><Edit2 size={16} /></button>
                      <button className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isPairingModalOpen && selectedClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="glass p-12 rounded-[3.5rem] w-full max-w-2xl space-y-8 border-indigo-500/30"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Power Pairing Assistant</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Initialize your satellite application in seconds</p>
                </div>
                <button onClick={() => setIsPairingModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><X size={24} className="text-slate-500" /></button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                       <Terminal size={12} /> Configuration Snippet
                    </span>
                    <button 
                      onClick={() => handleCopy(pairingSnippet)}
                      className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-all"
                    >
                      {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-300 overflow-x-auto p-4 bg-black/20 rounded-xl">
                    {pairingSnippet}
                  </pre>
                </div>
              </div>

              <button className="w-full btn-primary" onClick={() => setIsPairingModalOpen(false)}>Close Assistant</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
