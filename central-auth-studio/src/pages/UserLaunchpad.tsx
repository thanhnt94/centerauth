import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Rocket, Shield, AppWindow, Zap, AlertCircle, LogOut } from 'lucide-react';
import type { Client } from '../types';

interface UserInfo {
  username: string;
  role: string;
  avatar_initial: string;
  full_name?: string;
  email?: string;
}

export const UserLaunchpad: React.FC<{ user: UserInfo }> = ({ user }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/portal-apps');
      
      if (response.status === 401) {
        window.location.href = '/api/auth/login?return_to=' + encodeURIComponent(window.location.pathname);
        return;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setClients(data);
      } else {
        setError('Failed to load applications. Please try again.');
        setClients([]);
      }
    } catch (err) {
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
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 font-sans selection:bg-indigo-500/30">
      {/* Top Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/50 bg-white/50 backdrop-blur-3xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="text-white" size={20} />
          </div>
          <div>
             <span className="text-lg font-black tracking-tighter text-slate-800">CENTRAL<span className="text-indigo-500">AUTH</span></span>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">Unified Access</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900">{user.full_name || user.username}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.email || 'Authenticated Session'}</p>
           </div>
           <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-500 uppercase">
             {user.avatar_initial}
           </div>
           <div className="w-px h-8 bg-slate-200" />
           <button 
             onClick={() => window.location.href = '/api/auth/logout'}
             className="flex items-center gap-2 p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all font-bold uppercase text-[10px] tracking-widest"
           >
             <LogOut size={18} /> Logout
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16 space-y-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="inline-block px-4 py-2 bg-indigo-50 text-indigo-500 font-black text-[10px] uppercase tracking-widest rounded-2xl mb-6">
              Welcome to your Workspace
            </div>
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-black tracking-tight text-slate-900"
          >
            Ready to jump back in, <span className="text-indigo-500">{user.username}</span>?
          </motion.h1>
          <motion.p 
             initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
             className="text-slate-500 font-medium max-w-2xl mx-auto"
          >
            Your centralized identity grants you one-click access to all services in the ecosystem. Simply select an application below to continue.
          </motion.p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-12 p-8 rounded-3xl bg-rose-50 border border-rose-100 flex items-center gap-6 text-rose-600 max-w-2xl mx-auto">
            <AlertCircle size={32} />
            <div>
              <p className="font-black uppercase tracking-widest text-[10px] mb-1">System Error</p>
              <p className="font-bold">{error}</p>
            </div>
            <button 
              onClick={fetchApps}
              className="ml-auto px-6 py-3 bg-white text-rose-500 shadow-sm rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-[280px] bg-white rounded-[2.5rem] shadow-sm border border-slate-100 animate-pulse" />
            ))
          ) : clients.map((app, idx) => (
            <motion.a
              key={app.id}
              href={app.redirect_uri.split(',')[0]}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group relative h-[280px] bg-white p-10 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between overflow-hidden"
            >
              {/* Decorative Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-500" />

              <div className="flex justify-between items-start relative z-10">
                 <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 flex items-center justify-center to-indigo-600 rounded-[1.5rem] text-white shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all duration-300">
                    <Rocket size={24} />
                 </div>
                 <div className="w-10 h-10 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 rounded-full flex items-center justify-center transition-colors">
                   <ExternalLink size={18} />
                 </div>
              </div>

              <div className="relative z-10 mt-auto">
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">{app.name}</h3>
                 <p className="text-slate-500 text-sm font-medium mb-6 line-clamp-2">
                   {app.app_description || "Access the central platform."}
                 </p>
                 
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg">
                      <Zap size={12} fill="currentColor" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Shield size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">SSO</span>
                    </div>
                 </div>
              </div>
            </motion.a>
          ))}

          {!loading && clients.length === 0 && !error && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 space-y-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <AppWindow size={64} className="text-slate-200" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">No applications configured</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
