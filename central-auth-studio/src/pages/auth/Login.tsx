import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Key, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

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
           window.location.href = data.redirect || (returnTo ? decodeURIComponent(returnTo) : '/');
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[150px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-10 relative z-10"
      >
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-[2.5rem] bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.3)] mx-auto"
          >
            <Shield size={40} className="text-white" />
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Central <span className="text-indigo-500">Auth</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Ecosystem Identity Node</p>
          </div>
        </div>

        <div className="glass p-10 rounded-[3.5rem] border border-white/10 shadow-2xl relative group overflow-hidden">
           {/* Animated border effect */}
           <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

           {error && (
             <motion.div 
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               className="mb-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs font-bold"
             >
               <AlertCircle size={16} />
               {error}
             </motion.div>
           )}

           <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Identity Hub ID</label>
                 <div className="relative group/input">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    <input 
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                      placeholder="Username or email"
                      className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-sm font-medium text-white outline-none focus:border-indigo-500/30 transition-all"
                    />
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Access Key</label>
                 <div className="relative group/input">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-sm font-medium text-white outline-none focus:border-indigo-500/30 transition-all"
                    />
                 </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>Authorize Session <ArrowRight size={16} /></>}
              </button>
           </form>
        </div>

        <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
           Protected by Mindstack Quantum Encryption
        </p>
      </motion.div>
    </div>
  );
};
