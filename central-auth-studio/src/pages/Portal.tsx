import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Shield, 
  AppWindow, 
  Zap, 
  AlertCircle, 
  Flame, 
  Clock, 
  BookOpen, 
  FileText, 
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import type { Client } from '../types';

// App brand configurations
const getAppBrandConfig = (app: Client) => {
  const cid = (app.client_id || '').toLowerCase();
  const name = (app.name || '').toLowerCase();

  if (cid.includes('vocab') || name.includes('vocab')) {
    return {
      icon: <Flame size={24} className="text-white" />,
      gradient: 'from-orange-500 via-amber-500 to-rose-500',
      badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      tag: 'Flashcards & SRS',
      accentColor: 'text-orange-400',
      glow: 'group-hover:bg-orange-500/20'
    };
  }

  if (cid.includes('time') || name.includes('time')) {
    return {
      icon: <Clock size={24} className="text-white" />,
      gradient: 'from-violet-600 via-purple-600 to-indigo-600',
      badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      tag: 'Time & Pomodoro',
      accentColor: 'text-violet-400',
      glow: 'group-hover:bg-violet-500/20'
    };
  }

  if (cid.includes('quiz') || name.includes('quiz')) {
    return {
      icon: <BookOpen size={24} className="text-white" />,
      gradient: 'from-sky-500 via-indigo-500 to-blue-600',
      badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      tag: 'Quizzes & Exams',
      accentColor: 'text-sky-400',
      glow: 'group-hover:bg-sky-500/20'
    };
  }

  if (cid.includes('note') || name.includes('remi') || name.includes('note')) {
    return {
      icon: <FileText size={24} className="text-white" />,
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      tag: 'Notes & Tasks',
      accentColor: 'text-emerald-400',
      glow: 'group-hover:bg-emerald-500/20'
    };
  }

  return {
    icon: <Rocket size={24} className="text-white" />,
    gradient: 'from-indigo-600 via-blue-600 to-purple-600',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    tag: 'Ecosystem App',
    accentColor: 'text-indigo-400',
    glow: 'group-hover:bg-indigo-500/20'
  };
};

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
        window.location.href = '/api/auth/login?return_to=' + encodeURIComponent(window.location.pathname);
        return;
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Deduplicate clients by name / client_id defensively
        const seen = new Set<string>();
        const deduped: Client[] = [];
        for (const app of data) {
          if (app.client_id === 'timehack') continue; // Skip legacy duplicate
          const key = (app.name || '').toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(app);
          }
        }
        setClients(deduped);
      } else {
        setError('Failed to load applications. Please try again.');
        setClients([]);
      }
    } catch (err) {
      setError('Network communication error.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  return (
    <div className="flex flex-col justify-center max-w-2xl mx-auto w-full py-1 sm:py-4">
      {/* ═══════════ COMPACT APP LAUNCHER HEADER ═══════════ */}
      <div className="text-center mb-3 sm:mb-5 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider text-indigo-400">
          <Sparkles size={11} />
          <span>Ecosystem Hub</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Workspaces <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Launchpad</span>
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
          Select an application below to open with instant SSO session.
        </p>
      </div>

      {/* ═══════════ ERROR BANNER ═══════════ */}
      {error && (
        <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-2 text-rose-400 text-xs font-bold">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle size={15} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button 
            onClick={fetchApps}
            className="px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-rose-600 transition shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ═══════════ 2-COLUMN APP LAUNCHER TILES (ZERO SCROLLING) ═══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 sm:h-40 bg-slate-900/60 rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : clients.map((app, idx) => {
          const brand = getAppBrandConfig(app);
          const launchUrl = `/api/auth/jump/${app.client_id}`;

          return (
            <motion.a
              key={app.id || app.client_id}
              href={launchUrl}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              className="group relative bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/50 rounded-2xl p-3.5 sm:p-4 flex flex-col items-center justify-between text-center transition-all duration-200 active:scale-95 shadow-lg overflow-hidden cursor-pointer"
            >
              {/* Top ambient glow */}
              <div className={`absolute -right-8 -top-8 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl transition-all ${brand.glow}`} />

              {/* Status Indicator (Top Right) */}
              <div className="self-end flex items-center gap-1 z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400">Ready</span>
              </div>

              {/* Centered App Icon */}
              <div className="my-1 sm:my-2 flex flex-col items-center z-10">
                <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${brand.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200`}>
                  {brand.icon}
                </div>
                
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight mt-2 group-hover:text-indigo-300 transition-colors">
                  {app.name}
                </h3>
                
                <span className={`text-[10px] font-bold uppercase tracking-wider ${brand.accentColor} mt-0.5 truncate max-w-[130px]`}>
                  {brand.tag}
                </span>
              </div>

              {/* 1-Tap Launch Button Pill */}
              <div className="w-full mt-1.5 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[10px] font-black text-indigo-400 group-hover:text-white transition-colors z-10">
                <span>Launch</span>
                <ArrowUpRight size={12} className="stroke-[2.5]" />
              </div>
            </motion.a>
          );
        })}

        {!loading && clients.length === 0 && !error && (
          <div className="col-span-full h-36 bg-slate-900/40 flex flex-col items-center justify-center text-slate-500 space-y-2 rounded-2xl border-2 border-dashed border-white/5 p-4 text-center">
            <AppWindow size={28} className="opacity-30" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No applications configured</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Portal;



