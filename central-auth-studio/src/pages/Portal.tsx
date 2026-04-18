import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Rocket, Shield, AppWindow, Zap, AlertCircle } from 'lucide-react';
import type { Client } from '../types';

export const Portal: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/portal-apps');
      
      if (response.status === 401) {
        // Transparently redirect to login if session expired or missing
        window.location.href = '/api/auth/login?return_to=' + encodeURIComponent(window.location.pathname);
        return;
      }

      const data = await response.json();
      
      // Safety check: ensure data is an array before setting state
      if (Array.isArray(data)) {
        setClients(data);
      } else {
        console.error('Expected array for portal-apps, got:', data);
        setError('Failed to load applications. Please try again.');
        setClients([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Network communication error. Check your connection.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  return (
    <div className="space-y-12">
      {/* Welcome Header */}
      <div className="relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 relative z-10"
        >
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tighter">
            Ecosystem <span className="text-indigo-500">Launchpad</span>
          </h2>
          <p className="text-lg text-slate-400 font-medium max-w-2xl leading-relaxed">
            Welcome back. Your centralized identity grants you secure access to all Mindstack services through this unified portal.
          </p>
        </motion.div>
        
        <div className="absolute top-0 right-0 p-12 hidden lg:block opacity-20 transform translate-x-1/4 -translate-y-1/4">
          <Shield size={400} className="text-indigo-500" />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 flex items-center gap-6 text-rose-500"
        >
          <div className="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="font-black uppercase tracking-widest text-[10px] mb-1">System Error</p>
            <p className="font-bold">{error}</p>
          </div>
          <button 
            onClick={fetchApps}
            className="ml-auto px-6 py-3 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
          >
            Retry Connection
          </button>
        </motion.div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-64 glass rounded-[3rem] animate-pulse border border-white/5" />
          ))
        ) : clients.map((app, idx) => (
          <motion.a
            key={app.id}
            href={app.redirect_uri.split(',')[0]}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative h-64 glass p-10 rounded-[3rem] border border-white/10 hover:border-indigo-500/30 transition-all duration-500 flex flex-col justify-between overflow-hidden"
          >
            {/* Background Glow */}
            <div className={`absolute -right-20 -top-20 w-48 h-48 bg-indigo-500/10 blur-[100px] group-hover:bg-indigo-500/20 transition-all`} />

            <div className="flex justify-between items-start">
               <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-2xl">
                  <Rocket size={32} />
               </div>
               <ExternalLink className="text-slate-600 group-hover:text-indigo-400 transition-colors" size={20} />
            </div>

            <div>
               <div className="flex items-center gap-3 mb-2">
                 <h3 className="text-2xl font-black text-white tracking-tight">{app.name}</h3>
                 <div className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black uppercase text-indigo-400 tracking-widest">Active</div>
               </div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">SSO Linked • Secure Shell</p>
               
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Zap size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Instant Sync</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Shield size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Protected</span>
                  </div>
               </div>
            </div>
          </motion.a>
        ))}

        {!loading && clients.length === 0 && !error && (
          <div className="col-span-full h-64 glass flex flex-col items-center justify-center text-slate-500 space-y-4 rounded-[3rem] border-dashed border-2 border-white/5">
            <AppWindow size={48} className="opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No accessible services in your cluster</p>
          </div>
        )}
      </div>

      {/* Network Stats */}
      <div className="mt-12 flex flex-wrap gap-8">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Regional Node: SG-1</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security: Tier 4</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Identity: UUID-v4</span>
        </div>
      </div>
    </div>
  );
};
