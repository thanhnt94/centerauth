import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Key, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  // Check if session is already active; if so, immediately redirect back to the client or portal
  React.useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get('client_id');
        
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            if (clientId) {
              window.location.href = `/api/auth/jump/${clientId}`;
            } else {
              window.location.href = '/portal';
            }
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };
    checkActiveSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Get params from URL (return_to, client_id etc)
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');
    const clientId = params.get('client_id');

    try {
      const formData = new FormData();
      formData.append('login_id', loginId);
      formData.append('password', password);
      if (remember) formData.append('remember', 'on');
      if (clientId) formData.append('client_id', clientId);

      const response = await fetch(`/api/auth/login${window.location.search}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData,
        redirect: 'follow'
      });

      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
           window.location.href = data.redirect || (returnTo ? decodeURIComponent(returnTo) : '/portal');
        } else {
           setError(data.message || 'Login failed. Please check your credentials.');
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || 'Authentication error. Please try again.');
      }
    } catch (err) {
      setError('Network error. Unable to reach identity server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-slate-950 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-indigo-600/20 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/20 blur-[100px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Top Status Bar Pill */}
      <div className="relative z-10 pt-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-[11px] font-black uppercase tracking-widest text-indigo-300">
          <Sparkles size={12} className="text-indigo-400" />
          <span>InMind Unified Identity</span>
        </div>
      </div>

      {/* Main Login Card (App-Like High-Density) */}
      <motion.div 
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10 my-auto shrink-0"
      >
        {/* App Logo & Title */}
        <div className="text-center mb-4 sm:mb-6 space-y-2">
          <motion.div 
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 shadow-xl shadow-indigo-600/30 border border-white/20 mx-auto flex items-center justify-center"
          >
            <Shield size={30} className="text-white drop-shadow-md" />
          </motion.div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Central<span className="text-indigo-400">Auth</span>
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Single Sign-On Gateway
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/85 backdrop-blur-2xl p-5 sm:p-6 rounded-[1.75rem] border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Subtle top accent gradient */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-3.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs font-bold"
            >
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span className="flex-1 leading-snug">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1 block">
                Account ID / Email
              </label>
              <div className="relative group/input">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" size={17} />
                <input 
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter username or email"
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl h-11 sm:h-12 pl-10 pr-3.5 text-sm sm:text-xs font-medium text-white outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1 block">
                Password
              </label>
              <div className="relative group/input">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" size={17} />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl h-11 sm:h-12 pl-10 pr-10 text-sm sm:text-xs font-medium text-white outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-slate-950 text-indigo-500 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stay signed in</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} className="stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Mobile Footer Ecosystem Pills */}
      <div className="relative z-10 pb-3 shrink-0 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 flex-wrap text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-amber-400">Vocaburn</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-violet-400">TimeHack</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-emerald-400">RemiNote</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-sky-400">QuizMind</span>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
          InMind Identity Node • Zero-Login Cross Launch
        </p>
      </div>
    </div>
  );
};

export default Login;
