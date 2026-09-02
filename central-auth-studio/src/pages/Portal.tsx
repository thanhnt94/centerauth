import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ExternalLink, 
  Rocket, 
  Shield, 
  AppWindow, 
  Zap, 
  AlertCircle, 
  Flame, 
  Clock, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  ArrowUpRight,
  Sparkles,
  Layers,
  Bot
} from 'lucide-react';
import type { Client } from '../types';

// Helper to determine app branding based on client_id or name
const getAppBrandConfig = (app: Client) => {
  const cid = (app.client_id || '').toLowerCase();
  const name = (app.name || '').toLowerCase();

  if (cid.includes('vocab') || name.includes('vocab')) {
    return {
      icon: <Flame size={22} className="text-white" />,
      gradient: 'from-orange-500 via-amber-500 to-rose-500',
      badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      tag: 'Flashcards & SRS',
      accentColor: 'text-orange-400',
      glow: 'group-hover:bg-orange-500/20',
      fallbackDesc: 'Master vocabulary with FSRS algorithms, AI audio, and active recall practice.'
    };
  }

  if (cid.includes('time') || name.includes('time')) {
    return {
      icon: <Clock size={22} className="text-white" />,
      gradient: 'from-violet-600 via-purple-600 to-indigo-600',
      badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      tag: 'Time Ledger & Habits',
      accentColor: 'text-violet-400',
      glow: 'group-hover:bg-violet-500/20',
      fallbackDesc: 'Track productive focus sessions, Pomodoro timers, and daily habit routines.'
    };
  }

  if (cid.includes('quiz') || name.includes('quiz')) {
    return {
      icon: <BookOpen size={22} className="text-white" />,
      gradient: 'from-sky-500 via-indigo-500 to-blue-600',
      badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      tag: 'Smart Quizzes & Exams',
      accentColor: 'text-sky-400',
      glow: 'group-hover:bg-sky-500/20',
      fallbackDesc: 'Interactive knowledge tests, multi-choice exams, and real-time review.'
    };
  }

  if (cid.includes('note') || name.includes('remi') || name.includes('note')) {
    return {
      icon: <FileText size={22} className="text-white" />,
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      tag: 'Smart Notes & Flow',
      accentColor: 'text-emerald-400',
      glow: 'group-hover:bg-emerald-500/20',
      fallbackDesc: 'Unified markdown notes, task reminders, and automated telegram alerts.'
    };
  }

  return {
    icon: <Rocket size={22} className="text-white" />,
    gradient: 'from-indigo-600 via-blue-600 to-purple-600',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    tag: 'Ecosystem App',
    accentColor: 'text-indigo-400',
    glow: 'group-hover:bg-indigo-500/20',
    fallbackDesc: app.app_description || 'Centralized satellite workspace connected via SSO.'
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
            deduped.append ? deduped.push(app) : deduped.push(app);
          }
        }
        setClients(deduped);
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
    <div className="space-y-4 sm:space-y-6">
      {/* ═══════════ MOBILE-COMPACT HERO HEADER ═══════════ */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-950 border border-indigo-500/20 p-4 sm:p-6 shadow-xl"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider text-indigo-400">
                <Sparkles size={11} className="text-indigo-400" />
                Ecosystem Hub
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Workspaces <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Launchpad</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xl mt-0.5">
              One-click SSO authorization into all your synchronized productivity tools.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-center">
              <span className="text-xs font-black text-indigo-400 block">{clients.length}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Apps Ready</span>
            </div>
          </div>
        </div>

        {/* Ambient background accent */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* ═══════════ ERROR BANNER ═══════════ */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-rose-400 text-xs font-bold"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle size={18} className="shrink-0 text-rose-400" />
            <span className="truncate">{error}</span>
          </div>
          <button 
            onClick={fetchApps}
            className="px-3 py-1.5 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 transition shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ═══════════ APPS GRID (APP-LIKE HIGH DENSITY) ═══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-slate-900/50 rounded-2xl sm:rounded-3xl animate-pulse border border-white/5" />
          ))
        ) : clients.map((app, idx) => {
          const brand = getAppBrandConfig(app);
          const launchUrl = `/api/auth/jump/${app.client_id}`;

          return (
            <motion.div
              key={app.id || app.client_id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group relative bg-slate-900/70 hover:bg-slate-900/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-indigo-500/10"
            >
              {/* Subtle top brand glow */}
              <div className={`absolute -right-12 -top-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl transition-all ${brand.glow}`} />

              <div>
                {/* Header Row: App Icon + Status */}
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${brand.gradient} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300`}>
                      {brand.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base sm:text-lg font-black text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                          {app.name}
                        </h3>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${brand.accentColor}`}>
                        {brand.tag}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                </div>

                {/* Description */}
                <p className="text-slate-400 text-xs font-medium line-clamp-2 mb-3 leading-relaxed relative z-10">
                  {app.app_description || brand.fallbackDesc}
                </p>
              </div>

              {/* Bottom Action & Sync Bar */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 relative z-10">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-400/90">
                    <Zap size={11} className="text-amber-400" />
                    Instant SSO
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Shield size={11} className="text-indigo-400" />
                    Secured
                  </span>
                </div>

                <a
                  href={launchUrl}
                  className="h-8 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black flex items-center gap-1 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <span>Launch</span>
                  <ArrowUpRight size={13} className="stroke-[2.5]" />
                </a>
              </div>
            </motion.div>
          );
        })}

        {!loading && clients.length === 0 && !error && (
          <div className="col-span-full h-48 bg-slate-900/40 flex flex-col items-center justify-center text-slate-500 space-y-2 rounded-3xl border-2 border-dashed border-white/5 p-6 text-center">
            <AppWindow size={36} className="opacity-30" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No applications configured yet</p>
            <p className="text-[11px] text-slate-500">Connect new applications in the admin studio.</p>
          </div>
        )}
      </div>

      {/* ═══════════ COMPACT NODE STATUS FOOTER ═══════════ */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Node: SG-1 (Active)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Tier 4 Identity</span>
          </div>
        </div>

        <div className="text-slate-600 hidden sm:block">
          CentralAuth Gateway v2.4 • InMind Ecosystem
        </div>
      </div>
    </div>
  );
};

export default Portal;

