import React, { useState, useEffect } from 'react';
import { 
  Shield, LayoutGrid, Users, Settings, 
  History, LogOut, Menu, Bell,
  Database, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { UserLaunchpad } from '../../pages/UserLaunchpad';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{username: string, role: string, avatar_initial: string} | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    // Fetch dynamic user info
    fetch('/api/auth/me')
      .then(async res => {
        if (!res.ok) throw new Error('Identity fetch failed');
        return res.json();
      })
      .then(data => {
        if (!data.error) setUser(data);
      })
      .catch(err => {
        console.error('Failed to fetch user:', err);
        // Fallback to anonymous state if API fails
        setUser({ username: 'Unidentified', role: 'Explorer', avatar_initial: '?' });
      });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { icon: <LayoutGrid size={20} />, label: 'Portal', path: '/', color: 'text-indigo-400' },
  ];

  if (user?.role === 'admin') {
    menuItems.push(
      { icon: <Database size={20} />, label: 'Clients', path: '/admin/clients', color: 'text-sky-400' },
      { icon: <Users size={20} />, label: 'Identities', path: '/admin/users', color: 'text-emerald-400' },
      { icon: <RefreshCw size={20} />, label: 'Sync', path: '/admin/sync', color: 'text-amber-400' },
      { icon: <History size={20} />, label: 'Audit Logs', path: '/admin/logs', color: 'text-amber-400' },
      { icon: <Settings size={20} />, label: 'Settings', path: '/admin/settings', color: 'text-slate-400' }
    );
  }

  if (user && user.role !== 'admin') {
    return <UserLaunchpad user={user as any} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans">
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-50 transition-all duration-500 bg-slate-950/50 backdrop-blur-2xl border-r border-white/5
          ${isSidebarOpen ? 'w-80' : 'w-0 -translate-x-full lg:w-24 lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full p-8">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-20">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)]">
               <Shield className="text-white" size={24} />
             </div>
             {isSidebarOpen && (
               <motion.div 
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="flex flex-col"
               >
                 <span className="text-lg font-black tracking-tighter text-white">CENTRAL<span className="text-indigo-500">AUTH</span></span>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enterprise Identity</span>
               </motion.div>
             )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-4">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group
                    ${isActive ? 'bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.2)]' : 'hover:bg-white/5'}`}
                >
                  <div className={`${isActive ? 'text-white' : item.color} group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  {isSidebarOpen && (
                    <span className={`text-sm font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="pt-8 border-t border-white/5">
             <button 
               onClick={() => window.location.href = '/api/auth/logout'}
               className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-rose-500/10 transition-all group"
             >
               <LogOut className="text-slate-500 group-hover:text-rose-500" size={20} />
               {isSidebarOpen && (
                 <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-500">Logout Session</span>
               )}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-24'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-40 px-12 h-24 flex items-center justify-between transition-all duration-300
          ${scrolled ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'}`}>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 rounded-xl hover:bg-white/5 text-slate-400 transition-all"
            >
              <Menu size={20} />
            </button>
            <div className="h-8 w-[1px] bg-white/5" />
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
               {menuItems.find(i => location.pathname === i.path)?.label || 'Mindstack Ecosystem'}
            </h1>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Systems Online</span>
            </div>
            <button className="relative p-3 rounded-xl hover:bg-white/5 text-slate-400 transition-all">
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-slate-950" />
            </button>
            <div className="flex items-center gap-4 pl-4 border-l border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-white">{user?.username || 'Loading...'}</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role || 'User'}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-900 flex items-center justify-center font-black text-white shadow-xl uppercase">
                {user?.avatar_initial || '?'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-12 pb-24 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
