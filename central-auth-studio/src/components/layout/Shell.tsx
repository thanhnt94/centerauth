import React, { useState, useEffect } from 'react';
import { 
  Shield, LayoutGrid, Users, Settings, 
  History, LogOut, Menu, Bell,
  Database, RefreshCw, Bot, Activity,
  ChevronDown, ChevronRight, Key, Volume2, Sliders,
  Image as ImageIcon, Search, FileAudio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const location = useLocation();
  
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{username: string, role: string, avatar_initial: string} | null>(null);
  
  // Accordion open/close states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    site: true,
    user: true,
    aichat: true,
    tts: true,
    images: true,
    telegram: true,
    queue: true
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    // Fetch dynamic user info
    fetch('/api/auth/me')
      .then(async res => {
        if (res.status === 401) {
          window.location.href = '/auth/login';
          return;
        }
        if (!res.ok) throw new Error('Identity fetch failed');
        return res.json();
      })
      .then(data => {
        if (data && !data.error) {
          setUser(data);
        } else {
          window.location.href = '/auth/login';
        }
      })
      .catch(err => {
        console.error('Failed to fetch user:', err);
        window.location.href = '/auth/login';
      });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sections = [
    {
      key: 'site',
      title: 'Site Management',
      items: [
        { icon: <LayoutGrid size={20} />, label: 'Portal', path: '/portal', color: 'text-indigo-400' },
      ]
    },
    {
      key: 'user',
      title: 'User Management',
      items: [
        { icon: <Settings size={20} />, label: 'Account', path: '/settings', color: 'text-indigo-300' },
      ]
    }
  ];

  if (user?.role === 'admin') {
    // Add admin site tools
    sections[0].items.push(
      { icon: <Database size={20} />, label: 'Clients', path: '/admin/clients', color: 'text-sky-400' },
      { icon: <RefreshCw size={20} />, label: 'Sync', path: '/admin/sync', color: 'text-amber-400' },
      { icon: <History size={20} />, label: 'Audit Logs', path: '/admin/logs', color: 'text-amber-400' },
      { icon: <Settings size={20} />, label: 'Settings', path: '/admin/settings', color: 'text-slate-400' }
    );

    // Add admin user tools
    sections[1].items.push(
      { icon: <Users size={20} />, label: 'Identities', path: '/admin/users', color: 'text-emerald-400' }
    );

    // Add AI section
    sections.push({
      key: 'aichat',
      title: 'AI Chat Space',
      items: [
        { icon: <Bot size={20} />, label: 'AI Chat', path: '/admin/aichat', color: 'text-indigo-400' },
        { icon: <History size={20} />, label: 'AI Gallery', path: '/admin/ai-gallery', color: 'text-indigo-300' },
        { icon: <Key size={20} />, label: 'AI Settings', path: '/admin/ai-settings', color: 'text-indigo-300' },
        { icon: <Sliders size={20} />, label: 'AI Failover Pool', path: '/admin/ai-failover', color: 'text-indigo-400' },
      ]
    });

    // Add TTS section
    sections.push({
      key: 'tts',
      title: 'TTS Space',
      items: [
        { icon: <Volume2 size={20} />, label: 'TTS Create', path: '/admin/tts', color: 'text-indigo-400' },
        { icon: <FileAudio size={20} />, label: 'TTS Gallery', path: '/admin/tts-gallery', color: 'text-indigo-300' },
        { icon: <Key size={20} />, label: 'TTS Settings', path: '/admin/tts-settings', color: 'text-indigo-400' },
      ]
    });

    // Add Image Space section
    sections.push({
      key: 'images',
      title: 'Image Space',
      items: [
        { icon: <Search size={20} />, label: 'Image Search', path: '/admin/image-search', color: 'text-sky-400' },
        { icon: <ImageIcon size={20} />, label: 'Image Gallery', path: '/admin/images', color: 'text-sky-300' },
        { icon: <Key size={20} />, label: 'Image Settings', path: '/admin/image-settings', color: 'text-sky-400' },
      ]
    });

    // Add Queue section
    sections.push({
      key: 'queue',
      title: 'Queue Manager',
      items: [
        { icon: <Activity size={20} />, label: 'Queue Logs', path: '/admin/queue', color: 'text-emerald-400' },
        { icon: <Sliders size={20} />, label: 'Queue Settings', path: '/admin/queue-settings', color: 'text-emerald-300' }
      ]
    });

    // Add Telegram section
    sections.push({
      key: 'telegram',
      title: 'Telegram Space',
      items: [
        { icon: <Bot size={20} />, label: 'Telegram Console', path: '/admin/telegram', color: 'text-indigo-400' }
      ]
    });
  }

  // Auto-expand sections that have active items on location changes
  useEffect(() => {
    sections.forEach(s => {
      if (s.items.some(i => location.pathname === i.path)) {
        setExpandedSections(prev => ({ ...prev, [s.key]: true }));
      }
    });
  }, [location.pathname, user]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const allItems = sections.flatMap(s => s.items);

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans selection:bg-indigo-500/30">
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop / Drawer) */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-50 transition-all duration-300 ease-in-out bg-slate-950/95 backdrop-blur-2xl border-r border-white/5
          w-[280px] sm:w-80 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}`}
      >
        <div className="flex flex-col h-full p-4 sm:p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
             <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)] shrink-0">
               <Shield className="text-white" size={20} />
             </div>
             {(isSidebarOpen || window.innerWidth < 1024) && (
               <motion.div 
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="flex flex-col"
               >
                 <span className="text-base font-black tracking-tight text-white">CENTRAL<span className="text-indigo-500">AUTH</span></span>
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Enterprise Identity</span>
               </motion.div>
             )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
            {sections.map((section) => {
              const isExpanded = expandedSections[section.key];
              const showLabels = isSidebarOpen || window.innerWidth < 1024;
              return (
                <div key={section.key} className="space-y-1">
                  {showLabels && user?.role === 'admin' && (
                    <button
                      onClick={() => toggleSection(section.key)}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span>{section.title}</span>
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                  )}
                  
                  <AnimatePresence initial={false}>
                    {(!isSidebarOpen || isExpanded || window.innerWidth < 1024 || user?.role !== 'admin') && (
                      <motion.div
                        initial={isSidebarOpen ? { height: 0, opacity: 0 } : undefined}
                        animate={isSidebarOpen ? { height: 'auto', opacity: 1 } : undefined}
                        exit={isSidebarOpen ? { height: 0, opacity: 0 } : undefined}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden space-y-1 pl-0.5"
                      >
                        {section.items.map((item) => {
                          const isActive = location.pathname === item.path;
                          return (
                            <Link 
                              key={item.path}
                              to={item.path}
                              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 group
                                ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                            >
                              <div className={`${isActive ? 'text-white' : item.color} group-hover:scale-105 transition-transform shrink-0`}>
                                {item.icon}
                              </div>
                              {showLabels && (
                                <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                  {item.label}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="pt-4 border-t border-white/5">
             <button 
               onClick={() => window.location.href = '/api/auth/logout'}
               className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all group cursor-pointer"
             >
               <LogOut className="shrink-0" size={18} />
               {(isSidebarOpen || window.innerWidth < 1024) && (
                 <span className="text-xs font-black uppercase tracking-wider">Logout Session</span>
               )}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-[100dvh] overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-20'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-30 px-3 sm:px-8 h-12 sm:h-16 shrink-0 flex items-center justify-between transition-all duration-200 border-b border-white/5
          ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl shadow-lg' : 'bg-slate-950/60 backdrop-blur-md'}`}>
          <div className="flex items-center gap-2.5 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Toggle Menu"
            >
              <Menu size={18} />
            </button>
            <div className="h-4 sm:h-5 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {allItems.find(i => location.pathname === i.path)?.label || 'CentralAuth'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Systems Online</span>
            </div>

            <button 
              onClick={() => navigate('/settings')}
              className="relative p-1.5 sm:p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Notifications"
            >
              <Bell size={17} />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            </button>

            <div 
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-white/10 cursor-pointer hover:opacity-85 transition-all"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-white">{user?.username || 'User'}</p>
                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{user?.role || 'Member'}</p>
              </div>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-xs text-white shadow-md uppercase">
                {user?.avatar_initial || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 lg:p-8 max-w-[1500px] w-full mx-auto pb-16 lg:pb-8 flex flex-col">
          {children}
        </div>

        {/* ═══════════ MOBILE-FIRST BOTTOM DOCKED NAVIGATION BAR ═══════════ */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-950/95 backdrop-blur-2xl border-t border-white/10 z-50 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
          <Link
            to="/portal"
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
              location.pathname === '/portal' 
                ? 'text-indigo-400 bg-indigo-500/15' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={18} />
            <span className="text-[9px] font-black uppercase tracking-wider">Launchpad</span>
          </Link>

          <Link
            to="/settings"
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
              location.pathname === '/settings' 
                ? 'text-indigo-400 bg-indigo-500/15' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings size={18} />
            <span className="text-[9px] font-black uppercase tracking-wider">Account</span>
          </Link>

          {user?.role === 'admin' && (
            <Link
              to="/admin/telegram"
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
                location.pathname.startsWith('/admin') 
                  ? 'text-indigo-400 bg-indigo-500/15' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot size={18} />
              <span className="text-[9px] font-black uppercase tracking-wider">Admin</span>
            </Link>
          )}

          <button
            onClick={() => (window.location.href = '/api/auth/logout')}
            className="flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
          >
            <LogOut size={18} />
            <span className="text-[9px] font-black uppercase tracking-wider">Logout</span>
          </button>
        </nav>
      </main>
    </div>
  );
};

