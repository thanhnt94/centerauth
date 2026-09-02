import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Key, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
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
        // Allow redirect to be handled by browser if it's a standard response
        redirect: 'follow'
      });

      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      if (response.ok) {
        // If it returns JSON success
        const data = await response.json();
        if (data.success) {
           window.location.href = data.redirect || (returnTo ? decodeURIComponent(returnTo) : '/portal');
        } else {
           setError(data.message || 'Login failed. Check your credentials.');
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || 'Authentication error. Please try again.');
      }
    } catch (err) {
      setError('Network error. Unable to connect to auth server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col justify-center items-center p-3 sm:p-6 relative overflow-hidden">
      {/* Background Ambient Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/15 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-4 sm:space-y-6 relative z-10 my-auto"
      >
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mx-auto"
          >
            <Shield size={28} className="text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              Central<span className="text-indigo-500">Auth</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Unified Ecosystem Gateway
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl p-5 sm:p-7 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
           {/* Top Accent line */}
           <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

           {error && (
             <motion.div 
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-400 text-xs font-bold"
             >
               <AlertCircle size={15} className="shrink-0" />
               <span className="flex-1">{error}</span>
             </motion.div>
           )}

           <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1 block">
                   Username or Email
                 </label>
                 <div className="relative group/input">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" size={16} />
                    <input 
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                      autoFocus
                      placeholder="Enter username / email"
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl h-11 pl-10 pr-3.5 text-xs font-medium text-white outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all placeholder:text-slate-600"
                    />
                 </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1 block">
                   Password
                 </label>
                 <div className="relative group/input">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" size={16} />
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl h-11 pl-10 pr-3.5 text-xs font-medium text-white outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all placeholder:text-slate-600"
                    />
                 </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                 <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-indigo-500 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keep session active</span>
                 </label>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Authorize Session</span>
                    <ArrowRight size={14} className="stroke-[2.5]" />
                  </>
                )}
              </button>
           </form>
        </div>

        <p className="text-center text-[9px] font-black uppercase tracking-wider text-slate-500">
           InMind Central Identity Node • TLS 1.3
        </p>
      </motion.div>
    </div>
  );
};

export default Login;

