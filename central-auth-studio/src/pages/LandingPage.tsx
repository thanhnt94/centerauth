import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit, Headphones, Flame, BookOpen, ArrowRight, Sparkles, Globe, ChevronRight, ChevronLeft } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [appLinks, setAppLinks] = useState<{ [key: string]: string }>({
    quiz: 'http://localhost:5080',
    pod: 'http://localhost:5020',
    vocab: 'http://localhost:5090',
    note: 'http://localhost:5070'
  });

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            navigate('/portal');
            return;
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    const fetchRealLinks = async () => {
      try {
        const res = await fetch('/api/auth/portal-apps');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const links: { [key: string]: string } = {};
            data.forEach((client: any) => {
              const cid = client.client_id || '';
              const url = client.app_url || '';
              if (url) {
                if (cid.includes('quiz')) links.quiz = url;
                else if (cid.includes('pod')) links.pod = url;
                else if (cid.includes('vocab')) links.vocab = url;
                else if (cid.includes('remi') || cid.includes('note')) links.note = url;
              }
            });
            setAppLinks(prev => ({ ...prev, ...links }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch landing app URLs:", err);
      }
    };
    fetchRealLinks();
  }, []);

  const getDomainLink = (subdomain: string, fallback: string) => {
    if (appLinks[subdomain]) return appLinks[subdomain];

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      if (subdomain === 'quiz') return 'http://localhost:5080';
      if (subdomain === 'pod') return 'http://localhost:5020';
      if (subdomain === 'vocab') return 'http://localhost:5090';
      if (subdomain === 'note') return 'http://localhost:5070';
    }
    
    // Otherwise, dynamically determine domain
    const parts = window.location.hostname.split('.');
    if (parts.length >= 2) {
      const mainDomain = parts.slice(-2).join('.');
      return `http://${subdomain}.${mainDomain}`;
    }
    return fallback;
  };

  const apps = [
    {
      id: 'quiz',
      name: 'QuizMind',
      shortDesc: 'Trắc nghiệm thông minh',
      description: 'Luyện tập qua hàng ngàn câu hỏi thông minh, tự động phân tích điểm yếu và cá nhân hóa lộ trình học của bạn.',
      icon: <BrainCircuit size={80} strokeWidth={1.5} />,
      mobileIcon: <BrainCircuit size={64} strokeWidth={1.5} />,
      gradient: 'from-blue-500 to-indigo-500',
      bgLight: 'bg-blue-50',
      textAccent: 'text-blue-600',
      link: getDomainLink('quiz', 'http://quiz.mindstack.click')
    },
    {
      id: 'pod',
      name: 'PodLearn',
      shortDesc: 'Học qua Video & Podcast',
      description: 'Đắm chìm trong nội dung thực tế với phụ đề thông minh. Tra từ vựng trực tiếp ngay trên video và tự động lưu trữ ngữ cảnh.',
      icon: <Headphones size={80} strokeWidth={1.5} />,
      mobileIcon: <Headphones size={64} strokeWidth={1.5} />,
      gradient: 'from-pink-500 to-rose-500',
      bgLight: 'bg-pink-50',
      textAccent: 'text-pink-600',
      link: getDomainLink('pod', 'http://pod.mindstack.click')
    },
    {
      id: 'vocab',
      name: 'Vocaburn',
      shortDesc: 'Spaced Repetition',
      description: 'Đảm bảo bạn không bao giờ quên những gì đã học với thuật toán lặp lại ngắt quãng tối ưu. Học ít nhưng nhớ lâu.',
      icon: <Flame size={80} strokeWidth={1.5} />,
      mobileIcon: <Flame size={64} strokeWidth={1.5} />,
      gradient: 'from-orange-500 to-amber-500',
      bgLight: 'bg-orange-50',
      textAccent: 'text-orange-600',
      link: getDomainLink('vocab', 'http://vocab.mindstack.click')
    },
    {
      id: 'note',
      name: 'RemiNote',
      shortDesc: 'Ghi chú & Flashcard',
      description: 'Xây dựng "bộ não thứ hai" của bạn. Hệ thống tự động liên kết các khái niệm ghi chú lại với nhau thành mạng lưới tri thức.',
      icon: <BookOpen size={80} strokeWidth={1.5} />,
      mobileIcon: <BookOpen size={64} strokeWidth={1.5} />,
      gradient: 'from-emerald-500 to-teal-500',
      bgLight: 'bg-emerald-50',
      textAccent: 'text-emerald-600',
      link: getDomainLink('note', 'http://note.mindstack.click')
    }
  ];

  const [activeApp, setActiveApp] = useState(apps[0]);

  // Handle active dot for mobile scrolling
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.clientWidth;
    const index = Math.round(scrollLeft / width);
    if (index !== mobileActiveIndex) {
      setMobileActiveIndex(index);
      if (index > 0 && index <= apps.length) {
        setActiveApp(apps[index - 1]);
      } else if (index === 0) {
        setActiveApp(apps[0]);
      }
    }
  };

  const scrollToSlide = (index: number) => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <span className="text-gray-400 text-sm font-medium animate-pulse">Initializing Identity Hub...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden font-sans text-slate-900 selection:bg-indigo-200 relative">
      
      {/* Background Ambient Orbs (Shared) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none transition-colors duration-1000 ease-in-out" style={{ backgroundColor: 'var(--tw-bg-opacity)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeApp.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.8 }}
            className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] bg-gradient-to-br ${activeApp.gradient} opacity-10`}
          />
        </AnimatePresence>
      </div>

      {/* Navigation (Shared) - Seamless & Transparent */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Globe size={16} className="text-white" />
          </div>
          <span className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">Mind<span className="text-indigo-600">Stack</span></span>
        </div>
        <div className="flex items-center gap-4 lg:gap-6">
          <Link to="/auth/login" className="hidden sm:block text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
            Đăng nhập
          </Link>
          <Link to="/auth/login" className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-600 transition-all shadow-md">
            Bắt đầu
          </Link>
        </div>
      </nav>

      {/* ======================================================== */}
      {/* MOBILE LAYOUT: Fullscreen Onboarding Flow                */}
      {/* ======================================================== */}
      <div className="flex lg:hidden flex-1 relative w-full h-full flex-col pt-16">
        {/* Horizontal Scroll Snap Container */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-20"
          style={{ scrollBehavior: 'smooth', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          {/* Slide 0: Welcome */}
          <div className="min-w-full w-full h-full snap-center flex flex-col justify-center items-center px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-indigo-600 text-xs font-bold uppercase tracking-wider shadow-sm mb-6">
              <Sparkles size={14} className="text-indigo-500" />
              Cộng đồng tri thức
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-[1.2] mb-4">
              Học tập. Ghi nhớ. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500">
                Làm chủ mọi thứ.
              </span>
            </h1>
            <p className="text-slate-600 font-medium">
              MindStack kết nối các công cụ mạnh mẽ nhất giúp bạn tiếp thu nhanh hơn và không bao giờ quên.
            </p>
            <button onClick={() => scrollToSlide(1)} className="mt-8 flex items-center justify-center gap-2 animate-bounce text-indigo-500 hover:text-indigo-600 transition-colors">
              <span className="text-xs font-bold tracking-widest uppercase">Vuốt để khám phá</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Slides 1-4: Apps */}
          {apps.map((app) => (
            <div key={app.id} className="min-w-full w-full h-full snap-center flex flex-col justify-center items-center px-8 pb-10 text-center">
               <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className={`relative p-8 mb-8 rounded-[2.5rem] ${app.bgLight} shadow-inner flex items-center justify-center`}
                >
                  <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${app.gradient} opacity-20 blur-xl`} />
                  <div className={`${app.textAccent} relative z-10`}>
                     {app.mobileIcon}
                  </div>
                </motion.div>
                
                <h2 className="text-3xl font-black text-slate-900 mb-4">{app.name}</h2>
                <p className="text-slate-600 font-medium leading-relaxed mb-8">
                  {app.description}
                </p>

                <a 
                  href={app.link}
                  className={`px-8 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r ${app.gradient} shadow-lg flex items-center gap-2 w-full justify-center max-w-[280px]`}
                >
                  Mở ứng dụng <ArrowRight size={18} />
                </a>
            </div>
          ))}
        </div>

        {/* Mobile Fixed Bottom Area (Dots + Prev/Next Buttons) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-12 pb-6 px-6 flex flex-col items-center pointer-events-none">
          <div className="flex items-center gap-6 mb-6 pointer-events-auto">
            
            {/* Prev Button */}
            <button 
              onClick={() => scrollToSlide(mobileActiveIndex - 1)} 
              className={`p-2 rounded-full bg-white shadow-sm border border-slate-100 text-slate-600 transition-all active:scale-95 ${mobileActiveIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-slate-50'}`}
              aria-label="Trang trước"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Pagination Dots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className={`h-2 rounded-full transition-all duration-300 ${mobileActiveIndex === i ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-300'}`} 
                />
              ))}
            </div>

            {/* Next Button */}
            <button 
              onClick={() => scrollToSlide(mobileActiveIndex + 1)} 
              className={`p-2 rounded-full bg-white shadow-sm border border-slate-100 text-slate-600 transition-all active:scale-95 ${mobileActiveIndex === 4 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-slate-50'}`}
              aria-label="Trang sau"
            >
              <ChevronRight size={20} />
            </button>

          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP LAYOUT: Interactive Split Screen                 */}
      {/* ======================================================== */}
      <main className="hidden lg:flex flex-1 relative z-10 w-full max-w-7xl mx-auto items-center px-12 h-full gap-12 pt-12">
        {/* Left Column: Hero & Menu */}
        <div className="w-5/12 flex flex-col justify-center space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-indigo-600 text-xs font-bold uppercase tracking-wider shadow-sm">
              <Sparkles size={14} className="text-indigo-500" />
              Cộng đồng tri thức
            </div>
            
            <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Học tập. Ghi nhớ. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500">
                Làm chủ mọi thứ.
              </span>
            </h1>
            
            <p className="text-base text-slate-600 font-medium leading-relaxed max-w-md">
              MindStack kết nối các công cụ mạnh mẽ nhất giúp bạn tiếp thu nhanh hơn và không bao giờ quên. 
              <span className="block mt-2 font-bold text-slate-800">Khám phá các ứng dụng bên dưới:</span>
            </p>
          </div>

          {/* Interactive Menu List */}
          <div className="flex flex-col gap-3">
            {apps.map((app) => (
              <button
                key={app.id}
                onMouseEnter={() => setActiveApp(app)}
                onClick={() => setActiveApp(app)}
                className={`group flex items-center justify-between w-full text-left p-4 rounded-2xl transition-all duration-300 border ${
                  activeApp.id === app.id 
                    ? 'bg-white border-slate-200 shadow-md scale-105 ml-2' 
                    : 'bg-transparent border-transparent hover:bg-white/50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl transition-colors ${activeApp.id === app.id ? app.bgLight : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                    <div className={activeApp.id === app.id ? app.textAccent : 'text-slate-400 group-hover:text-slate-600'}>
                      {React.cloneElement(app.icon, { size: 20, strokeWidth: 2 })}
                    </div>
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${activeApp.id === app.id ? 'text-slate-900' : ''}`}>{app.name}</h3>
                    <p className={`text-xs font-medium ${activeApp.id === app.id ? 'text-slate-500' : 'opacity-0 h-0'} transition-all`}>
                      {app.shortDesc}
                    </p>
                  </div>
                </div>
                {activeApp.id === app.id && (
                  <motion.div layoutId="arrow">
                    <ChevronRight size={20} className={app.textAccent} />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Dynamic Showcase */}
        <div className="w-7/12 h-[80%] items-center justify-center relative flex">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeApp.id}
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-lg aspect-square relative"
            >
              {/* Glass Card Container */}
              <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] rounded-[3rem] p-12 flex flex-col justify-center items-center text-center gap-8 group">
                
                {/* Floating Icon */}
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className={`relative p-8 rounded-full ${activeApp.bgLight} shadow-inner flex items-center justify-center`}
                >
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${activeApp.gradient} opacity-20 blur-xl animate-pulse`} />
                  <div className={`${activeApp.textAccent} relative z-10`}>
                     {activeApp.icon}
                  </div>
                </motion.div>

                <div className="space-y-4">
                  <h2 className="text-3xl font-black text-slate-900">{activeApp.name}</h2>
                  <p className="text-base text-slate-600 font-medium leading-relaxed px-4">
                    {activeApp.description}
                  </p>
                </div>

                <a 
                  href={activeApp.link}
                  className={`mt-4 px-8 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r ${activeApp.gradient} shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 flex items-center gap-2`}
                >
                  Mở ứng dụng <ArrowRight size={18} />
                </a>

              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      {/* Custom Styles for hiding scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};



