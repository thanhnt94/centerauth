import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  AppWindow, 
  AlertCircle, 
  Flame, 
  Clock, 
  BookOpen, 
  FileText, 
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';
import type { Client } from '../types';

// App brand configurations with distinctive vibrant styling
const getAppBrandConfig = (app: Client) => {
  const cid = (app.client_id || '').toLowerCase();
  const name = (app.name || '').toLowerCase();

  if (cid.includes('vocab') || name.includes('vocab')) {
    return {
      icon: <Flame size={28} className="text-white drop-shadow" />,
      gradient: 'from-amber-500 via-orange-500 to-rose-500',
      shadow: 'shadow-orange-500/25 group-hover:shadow-orange-500/40',
      badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      tag: 'SRS Flashcards',
      accentColor: 'text-orange-400',
      glow: 'group-hover:bg-orange-500/20'
    };
  }

  if (cid.includes('time') || name.includes('time')) {
    return {
      icon: <Clock size={28} className="text-white drop-shadow" />,
      gradient: 'from-violet-600 via-purple-600 to-indigo-600',
      shadow: 'shadow-purple-500/25 group-hover:shadow-purple-500/40',
      badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      tag: 'Time & Focus',
      accentColor: 'text-violet-400',
      glow: 'group-hover:bg-violet-500/20'
    };
  }

  if (cid.includes('quiz') || name.includes('quiz')) {
    return {
      icon: <BookOpen size={28} className="text-white drop-shadow" />,
      gradient: 'from-sky-500 via-blue-600 to-indigo-600',
      shadow: 'shadow-sky-500/25 group-hover:shadow-sky-500/40',
      badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      tag: 'Practice Quizzes',
      accentColor: 'text-sky-400',
      glow: 'group-hover:bg-sky-500/20'
    };
  }

  if (cid.includes('note') || name.includes('remi') || name.includes('note')) {
    return {
      icon: <FileText size={28} className="text-white drop-shadow" />,
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
      shadow: 'shadow-emerald-500/25 group-hover:shadow-emerald-500/40',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      tag: 'Notes & Docs',
      accentColor: 'text-emerald-400',
      glow: 'group-hover:bg-emerald-500/20'
    };
  }

  return {
    icon: <Rocket size={28} className="text-white drop-shadow" />,
    gradient: 'from-indigo-600 via-blue-600 to-purple-600',
    shadow: 'shadow-indigo-500/25 group-hover:shadow-indigo-500/40',
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
        window.location.href = '/auth/login?return_to=' + encodeURIComponent(window.location.pathname);
        return;
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Deduplicate clients by name / client_id defensively
        const seen = new Set<string>();
        const deduped: Client[] = [];
        for (const app of data) {
          if (app.client_id === 'timehack') continue; // Always skip legacy duplicate
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
      setError('Network communication error. Please check your connection.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto w-full h-full py-1 sm:py-2 select-none">
      {/* ═══════════ TOP APP LAUNCHPAD HEADER ═══════════ */}
      <div className="text-center mb-3 sm:mb-4 space-y-1 shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider text-indigo-400">
          <Sparkles size={11} className="text-indigo-400" />
          <span>Ecosystem Hub</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Workspaces <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Launchpad</span>
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
          Select an app to jump in with instant Single Sign-On.
        </p>
      </div>

      {/* ═══════════ ERROR BANNER ═══════════ */}
      {error && (
        <div className="mb-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-2 text-rose-400 text-xs font-bold shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
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

      {/* ═══════════ 2x2 APP LAUNCHER TILES (APP-LIKE NATIVE GRID) ═══════════ */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 my-auto">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 sm:h-44 bg-slate-900/60 rounded-[1.5rem] animate-pulse border border-white/5" />
          ))
        ) : clients.map((app, idx) => {
          const brand = getAppBrandConfig(app);
          const launchUrl = `/api/auth/jump/${app.client_id}`;

          return (
            <motion.a
              key={app.id || app.client_id}
              href={launchUrl}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
              className="group relative bg-slate-900/80 hover:bg-slate-900/95 border border-white/10 hover:border-indigo-500/50 rounded-[1.5rem] p-3.5 sm:p-4 flex flex-col items-center justify-between text-center transition-all duration-200 active:scale-95 shadow-xl overflow-hidden cursor-pointer backdrop-blur-xl"
            >
              {/* Ambient Glow */}
              <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl transition-all duration-300 pointer-events-none opacity-40 group-hover:opacity-70 ${brand.glow}`} />

              {/* Status Indicator (Top Right) */}
              <div className="self-end flex items-center gap-1 z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400">Ready</span>
              </div>

              {/* Centered App Squircle Icon */}
              <div className="my-1 sm:my-2 flex flex-col items-center z-10">
                <div className={`w-13 h-13 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.25rem] bg-gradient-to-br ${brand.gradient} flex items-center justify-center shadow-lg ${brand.shadow} group-hover:scale-105 transition-transform duration-200 border border-white/20`}>
                  {brand.icon}
                </div>
                
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight mt-2.5 group-hover:text-indigo-300 transition-colors">
                  {app.name}
                </h3>
                
                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${brand.accentColor} mt-0.5 truncate max-w-[130px]`}>
                  {brand.tag}
                </span>
              </div>

              {/* 1-Tap Launch Button Pill */}
              <div className="w-full mt-1 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[10px] font-black text-indigo-400 group-hover:text-white transition-colors z-10">
                <span>Launch</span>
                <ArrowUpRight size={12} className="stroke-[2.5]" />
              </div>
            </motion.a>
          );
        })}

        {!loading && clients.length === 0 && !error && (
          <div className="col-span-full h-36 bg-slate-900/40 flex flex-col items-center justify-center text-slate-500 space-y-2 rounded-[1.5rem] border-2 border-dashed border-white/5 p-4 text-center">
            <AppWindow size={28} className="opacity-30" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No applications found</p>
          </div>
        )}
      </div>

      {/* ═══════════ BOTTOM ECOSYSTEM STATUS CARD ═══════════ */}
      <div className="mt-3 shrink-0 p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-white">Central SSO Active</p>
            <p className="text-[9px] text-slate-400 font-medium">Session linked across all satellite services</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-400">
          <Zap size={12} className="fill-indigo-400" />
          <span>Instant Sync</span>
        </div>
      </div>
    </div>
  );
};

export default Portal;
