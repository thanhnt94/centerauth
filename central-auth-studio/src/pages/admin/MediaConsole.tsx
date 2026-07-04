import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, Search, Download, Check, 
  ExternalLink, Copy, Loader2, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  title: string;
  url: string;
  thumbnail: string;
  provider: string;
}

interface SavedAsset {
  id: number;
  filename: string;
  local_path: string;
  provider: string;
  search_query: string;
  mime_type: string;
  size_bytes: number;
}

export const MediaConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'library'>('search');
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('auto');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Library state
  const [library, setLibrary] = useState<SavedAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Download state tracker: maps URL to true if downloading
  const [downloadingUrls, setDownloadingUrls] = useState<Record<string, boolean>>({});
  const [downloadSuccessUrls, setDownloadSuccessUrls] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  useEffect(() => {
    if (activeTab === 'library') {
      fetchLibrary();
    }
  }, [activeTab]);

  const fetchLibrary = async () => {
    setLibraryLoading(true);
    try {
      const res = await fetch('/api/chat/media/library');
      if (res.ok) {
        const data = await res.json();
        setLibrary(data);
      }
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch('/api/chat/media/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), provider, limit: 20 })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Search request failed');
      }

      const data = await res.json();
      setSearchResults(data);
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'An error occurred during search.');
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (item: SearchResult) => {
    setDownloadingUrls(prev => ({ ...prev, [item.url]: true }));
    try {
      const res = await fetch('/api/chat/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          provider: item.provider,
          query: query.trim() || item.title
        })
      });

      if (res.ok) {
        setDownloadSuccessUrls(prev => ({ ...prev, [item.url]: true }));
        // Remove success checkmark after 3 seconds
        setTimeout(() => {
          setDownloadSuccessUrls(prev => ({ ...prev, [item.url]: false }));
        }, 3000);
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to download image');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while downloading image');
    } finally {
      setDownloadingUrls(prev => ({ ...prev, [item.url]: false }));
    }
  };

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ImageIcon className="text-sky-400" size={32} />
            Central Media <span className="text-sky-400">Space</span>
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Search, download, and manage unified media assets for the entire ecosystem.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 shrink-0 self-start md:self-center">
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'search' 
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Internet Search
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'library' 
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Local Library ({activeTab === 'library' ? library.length : '...'})
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'search' ? (
          <motion.div 
            key="search-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Search Controls Form */}
            <form onSubmit={handleSearch} className="glass p-6 rounded-3xl border border-white/10 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Keyword Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
                  <input 
                    type="text" 
                    placeholder="Enter keywords (e.g. apple fruit, running cat)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
                  />
                </div>

                {/* Provider Select */}
                <select 
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="bg-slate-950/50 border border-white/10 text-white px-4 py-3 rounded-2xl focus:outline-none focus:border-sky-500/50 font-bold text-sm"
                >
                  <option value="auto">Auto (Priority List)</option>
                  <option value="wikimedia">Wikimedia Commons (Free)</option>
                  <option value="unsplash">Unsplash API</option>
                  <option value="pexels">Pexels API</option>
                  <option value="pixabay">Pixabay API</option>
                  <option value="google">Google Image Search</option>
                </select>

                {/* Submit button */}
                <button 
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="px-8 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/40 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-sky-500/25"
                >
                  {searching ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Search
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {searchError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm font-bold">
                {searchError}
              </div>
            )}

            {/* Search Results Grid */}
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {searchResults.map((item, idx) => (
                  <div key={idx} className="group glass rounded-3xl border border-white/5 overflow-hidden flex flex-col justify-between hover:border-sky-500/30 transition-all duration-300">
                    <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                      <img 
                        src={item.thumbnail || item.url} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-sky-400">
                        {item.provider}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <p className="text-slate-200 text-xs font-bold line-clamp-2 leading-relaxed" title={item.title}>
                        {item.title}
                      </p>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDownload(item)}
                          disabled={downloadingUrls[item.url]}
                          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            downloadSuccessUrls[item.url] 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-white/5 hover:bg-sky-500 hover:text-white border border-white/10 hover:border-sky-500 text-slate-300'
                          }`}
                        >
                          {downloadingUrls[item.url] ? (
                            <Loader2 className="animate-spin" size={12} />
                          ) : downloadSuccessUrls[item.url] ? (
                            <Check size={12} />
                          ) : (
                            <Download size={12} />
                          )}
                          {downloadSuccessUrls[item.url] ? 'Saved' : 'Save'}
                        </button>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !searching && !searchError && (
                <div className="h-64 glass rounded-[2.5rem] border border-white/5 border-dashed flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <Search size={40} className="opacity-20" />
                  <p className="text-xs font-black uppercase tracking-wider">Search terms to discover photos</p>
                </div>
              )
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="library-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Library Grid */}
            {libraryLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="aspect-video glass rounded-3xl animate-pulse border border-white/5" />
                ))}
              </div>
            ) : library.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {library.map((asset) => (
                  <div key={asset.id} className="group glass rounded-3xl border border-white/5 overflow-hidden flex flex-col justify-between hover:border-sky-500/30 transition-all duration-300">
                    <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                      <img 
                        src={asset.local_path} 
                        alt={asset.search_query}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-sky-400">
                        {asset.provider}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-slate-200 text-xs font-black truncate">{asset.search_query || 'Unnamed'}</p>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                          {formatSize(asset.size_bytes)} • {asset.mime_type?.split('/')[1]?.toUpperCase()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => copyToClipboard(asset.local_path, asset.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            copiedId === asset.id 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-sky-500 hover:text-white hover:border-sky-500'
                          }`}
                        >
                          {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === asset.id ? 'Copied' : 'Copy Path'}
                        </button>
                        <a 
                          href={asset.local_path} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 glass rounded-[2.5rem] border border-white/5 border-dashed flex flex-col items-center justify-center text-slate-500 space-y-3">
                <Database size={40} className="opacity-20" />
                <p className="text-xs font-black uppercase tracking-wider">No downloaded images in library yet</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
