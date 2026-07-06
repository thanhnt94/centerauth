import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, Search, Download, Check, 
  ExternalLink, Copy, Loader2, Database, Trash2, RefreshCw
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
  source_info?: string;
}

interface MediaConsoleProps {
  defaultTab?: 'search' | 'library' | 'settings';
}

export const MediaConsole: React.FC<MediaConsoleProps> = ({ defaultTab = 'search' }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'library' | 'settings'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('auto');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Library state
  const [library, setLibrary] = useState<SavedAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const libraryLimit = 24;

  // Replacing/Replacing-results state
  const [replacingAsset, setReplacingAsset] = useState<SavedAsset | null>(null);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [replaceProvider, setReplaceProvider] = useState('auto');
  const [replaceResults, setReplaceResults] = useState<SearchResult[]>([]);
  const [replaceSearching, setReplaceSearching] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replacingUrls, setReplacingUrls] = useState<Record<string, boolean>>({});
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // Settings state
  const [settings, setSettings] = useState({
    media_provider_priority: 'bing,wikimedia,unsplash,pexels,pixabay,google',
    media_crop_ratio: 'original',
    unsplash_access_key: '',
    pexels_api_key: '',
    pixabay_api_key: '',
    google_cse_api_key: '',
    google_cse_cx: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Download state tracker: maps URL to true if downloading
  const [downloadingUrls, setDownloadingUrls] = useState<Record<string, boolean>>({});
  const [downloadSuccessUrls, setDownloadSuccessUrls] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (activeTab === 'library') {
      fetchLibrary(1, '');
    } else if (activeTab === 'settings') {
      fetchSettings();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/chat/media/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load media settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch('/api/chat/media/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSettingsMessage('Settings saved successfully.');
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        const errData = await res.json();
        setSettingsMessage(`Error: ${errData.detail || 'Failed to save settings'}`);
      }
    } catch (err) {
      console.error(err);
      setSettingsMessage('Network error occurred.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchLibrary = async (page = libraryPage, searchVal = librarySearch) => {
    setLibraryLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: libraryLimit.toString(),
      });
      if (searchVal.trim()) {
        queryParams.append('search', searchVal.trim());
      }
      const res = await fetch(`/api/chat/media/library?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLibrary(data.assets || []);
        setLibraryTotal(data.total || 0);
        setLibraryPage(data.page || 1);
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

  const deleteAsset = async (id: number) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    try {
      const res = await fetch(`/api/chat/media/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLibrary(prev => prev.filter(item => item.id !== id));
      } else {
        const errData = await res.json();
        alert(`Failed to delete: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while deleting media asset');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/chat/media/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const newAsset = await res.json();
        setLibrary(prev => [newAsset, ...prev]);
      } else {
        const err = await res.json();
        alert(`Upload failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceQuery.trim()) return;

    setReplaceSearching(true);
    setReplaceError(null);
    setReplaceResults([]);
    try {
      const res = await fetch('/api/chat/media/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: replaceQuery.trim(), provider: replaceProvider, limit: 12 })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Search request failed');
      }

      const data = await res.json();
      setReplaceResults(data);
    } catch (err: any) {
      console.error(err);
      setReplaceError(err.message || 'An error occurred during search.');
    } finally {
      setReplaceSearching(false);
    }
  };

  const handleReplaceImage = async (item: SearchResult) => {
    if (!replacingAsset) return;
    setReplacingUrls(prev => ({ ...prev, [item.url]: true }));
    try {
      const res = await fetch(`/api/chat/media/${replacingAsset.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          provider: item.provider,
          query: replaceQuery.trim() || item.title
        })
      });

      if (res.ok) {
        const updatedAsset = await res.json();
        // Update library state
        setLibrary(prev => prev.map(asset => asset.id === replacingAsset.id ? updatedAsset : asset));
        setCacheBuster(Date.now());
        setReplacingAsset(null); // Close modal
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to replace image');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while replacing image');
    } finally {
      setReplacingUrls(prev => ({ ...prev, [item.url]: false }));
    }
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
        {activeTab === 'search' && (
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Search className="text-sky-400" size={32} />
              Image <span className="text-sky-400">Search</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">
              Search the internet for high quality images and save them directly to storage.
            </p>
          </div>
        )}
        {activeTab === 'library' && (
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <ImageIcon className="text-sky-400" size={32} />
              Image <span className="text-sky-400">Space</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">
              Manage downloaded media assets inside unified ecosystem library.
            </p>
          </div>
        )}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <ImageIcon className="text-sky-400" size={32} />
              Image <span className="text-sky-400">Settings</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">
              Configure search providers priority, cropping ratios, and credentials.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'search' && (
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
                  <option value="bing">Bing Image Search (Free)</option>
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
        )}
        {activeTab === 'library' && (
          <motion.div 
            key="library-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Upload Zone */}
            <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Upload Media Asset</h3>
              <div className="border border-white/10 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-950/20 hover:bg-slate-950/40 transition-colors relative group">
                <input 
                  type="file"
                  accept="image/*"
                  onChange={handleUploadFile}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin text-sky-400" size={32} />
                    <p className="text-xs font-bold text-slate-400">Uploading your asset to media vault...</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="text-slate-500 group-hover:text-sky-400 transition-colors" size={32} />
                    <div className="text-center">
                      <p className="text-xs font-black text-slate-200">Click or drag image to upload</p>
                      <p className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, JPEG, GIF up to 10MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3 text-slate-500" size={16} />
                <input 
                  type="text" 
                  value={librarySearch}
                  onChange={(e) => {
                    setLibrarySearch(e.target.value);
                    setLibraryPage(1);
                    fetchLibrary(1, e.target.value);
                  }}
                  placeholder="Search by keywords, file name, or source information..."
                  className="w-full bg-slate-900/50 border border-white/5 focus:border-sky-500 outline-none rounded-2xl py-3 pl-12 pr-4 text-xs text-white placeholder:text-slate-500"
                />
              </div>
            </div>

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
                        src={`${asset.local_path}?t=${cacheBuster}`} 
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
                        {asset.source_info && (
                          <p className="text-sky-400/80 text-[10px] font-bold truncate mt-0.5" title={asset.source_info}>
                            📍 {asset.source_info}
                          </p>
                        )}
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                          {formatSize(asset.size_bytes)} • {asset.mime_type?.split('/')[1]?.toUpperCase()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => copyToClipboard(`central-media://${asset.filename}`, asset.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            copiedId === asset.id 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-sky-500 hover:text-white hover:border-sky-500'
                          }`}
                        >
                          {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === asset.id ? 'Copied' : 'Copy Link'}
                        </button>
                        <a 
                          href={asset.local_path} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                          title="Open image in new tab"
                        >
                          <ExternalLink size={12} />
                        </a>
                        <button 
                          onClick={() => {
                            setReplacingAsset(asset);
                            setReplaceQuery(asset.search_query || '');
                            setReplaceProvider('auto');
                            setReplaceResults([]);
                            setReplaceError(null);
                          }}
                          className="p-2 bg-white/5 hover:bg-sky-600 border border-white/10 hover:border-sky-600 rounded-xl text-slate-400 hover:text-white transition-colors"
                          title="Replace image with new search"
                        >
                          <RefreshCw size={12} />
                        </button>
                        <button 
                          onClick={() => deleteAsset(asset.id)}
                          className="p-2 bg-white/5 hover:bg-rose-600 border border-white/10 hover:border-rose-600 rounded-xl text-slate-400 hover:text-white transition-colors"
                          title="Delete media asset"
                        >
                          <Trash2 size={12} />
                        </button>
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
            {/* Pagination Controls */}
            {libraryTotal > libraryLimit && (
              <div className="flex items-center justify-between border-t border-white/5 pt-6">
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  Showing {Math.min((libraryPage - 1) * libraryLimit + 1, libraryTotal)} - {Math.min(libraryPage * libraryLimit, libraryTotal)} of {libraryTotal} assets
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={libraryPage === 1}
                    onClick={() => {
                      const newPage = libraryPage - 1;
                      setLibraryPage(newPage);
                      fetchLibrary(newPage);
                    }}
                    className="px-3 py-1.5 bg-slate-900 border border-white/10 hover:bg-sky-500 hover:text-white rounded-xl text-xs font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={libraryPage * libraryLimit >= libraryTotal}
                    onClick={() => {
                      const newPage = libraryPage + 1;
                      setLibraryPage(newPage);
                      fetchLibrary(newPage);
                    }}
                    className="px-3 py-1.5 bg-slate-900 border border-white/10 hover:bg-sky-500 hover:text-white rounded-xl text-xs font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div 
            key="settings-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6 max-w-4xl"
          >
            {settingsLoading ? (
              <div className="glass p-8 rounded-3xl border border-white/10 flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-sky-400" size={32} />
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="glass p-8 rounded-[2rem] border border-white/10 space-y-6">
                {settingsMessage && (
                  <div className={`p-4 rounded-xl text-xs font-black uppercase tracking-wider ${
                    settingsMessage.includes('Error') 
                      ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  }`}>
                    {settingsMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Priority List */}
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Provider Priority Chain</label>
                    <input 
                      type="text" 
                      value={settings.media_provider_priority}
                      onChange={(e) => setSettings({ ...settings, media_provider_priority: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                      placeholder="e.g. bing,wikimedia,unsplash"
                    />
                    <p className="text-[10px] text-slate-500 font-bold leading-normal">
                      Comma separated order to search. Fallback order for "auto" searches.
                    </p>
                  </div>

                  {/* Crop Ratio */}
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Crop Ratio</label>
                    <select 
                      value={settings.media_crop_ratio}
                      onChange={(e) => setSettings({ ...settings, media_crop_ratio: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-sky-500/50 font-bold text-sm"
                    >
                      <option value="original">Original (No Crop)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="16:9">16:9 (Widescreen)</option>
                      <option value="4:3">4:3 (Standard)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 font-bold leading-normal">
                      Images downloaded from queue or search will be automatically cropped.
                    </p>
                  </div>

                  {/* API Keys Header */}
                  <div className="col-span-full border-t border-white/5 pt-4 mt-2">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">Provider API Credentials</h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">
                      Configure keys to enable Unsplash, Pexels, Pixabay, or Google search.
                    </p>
                  </div>

                  {/* Unsplash Key */}
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Unsplash Access Key</label>
                    <input 
                      type="password" 
                      value={settings.unsplash_access_key}
                      onChange={(e) => setSettings({ ...settings, unsplash_access_key: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                      placeholder="Enter Unsplash access key"
                    />
                  </div>

                  {/* Pexels Key */}
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Pexels API Key</label>
                    <input 
                      type="password" 
                      value={settings.pexels_api_key}
                      onChange={(e) => setSettings({ ...settings, pexels_api_key: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                      placeholder="Enter Pexels API key"
                    />
                  </div>

                  {/* Pixabay Key */}
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Pixabay API Key</label>
                    <input 
                      type="password" 
                      value={settings.pixabay_api_key}
                      onChange={(e) => setSettings({ ...settings, pixabay_api_key: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                      placeholder="Enter Pixabay API key"
                    />
                  </div>

                  <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4 mt-2">
                    {/* Google CSE Key */}
                    <div className="space-y-2">
                      <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Google Custom Search Key</label>
                      <input 
                        type="password" 
                        value={settings.google_cse_api_key}
                        onChange={(e) => setSettings({ ...settings, google_cse_api_key: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                        placeholder="Enter Google API key"
                      />
                    </div>

                    {/* Google CSE CX */}
                    <div className="space-y-2">
                      <label className="text-slate-400 text-xs font-black uppercase tracking-wider">Google CSE Engine ID (cx)</label>
                      <input 
                        type="text" 
                        value={settings.google_cse_cx}
                        onChange={(e) => setSettings({ ...settings, google_cse_cx: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                        placeholder="Enter CX search ID"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 flex justify-end">
                  <button 
                    type="submit"
                    disabled={settingsSaving}
                    className="px-8 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/40 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-sky-500/25"
                  >
                    {settingsSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Saving Configurations...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replace Image Modal */}
      <AnimatePresence>
        {replacingAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <RefreshCw size={16} className="text-sky-400 animate-spin-slow" />
                    Replace Image Content
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Filename: <code className="text-slate-400">{replacingAsset.filename}</code> (Vocaburn link will NOT change)
                  </p>
                </div>
                <button 
                  onClick={() => setReplacingAsset(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Search Form */}
              <form onSubmit={handleReplaceSearch} className="p-6 bg-slate-950/20 border-b border-white/5 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Search Query</label>
                  <input 
                    type="text"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    placeholder="Search keywords..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <div className="w-full md:w-48 space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Provider</label>
                  <select 
                    value={replaceProvider}
                    onChange={(e) => setReplaceProvider(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors cursor-pointer font-bold"
                  >
                    <option value="auto">Auto Select</option>
                    <option value="bing">Bing Search</option>
                    <option value="wikimedia">Wikimedia Commons</option>
                    <option value="unsplash">Unsplash</option>
                    <option value="pexels">Pexels</option>
                    <option value="pixabay">Pixabay</option>
                    <option value="google">Google Custom Search</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  disabled={replaceSearching}
                  className="w-full md:w-auto px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-xs font-black uppercase tracking-wider text-white rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  {replaceSearching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                  Search
                </button>
              </form>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
                {replaceSearching ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="animate-spin text-sky-400" size={32} />
                  </div>
                ) : replaceError ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-bold text-rose-400 uppercase tracking-wider text-center">
                    Error: {replaceError}
                  </div>
                ) : replaceResults.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {replaceResults.map((item, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => !replacingUrls[item.url] && handleReplaceImage(item)}
                        className="group relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-white/5 hover:border-sky-500/40 cursor-pointer transition-all duration-300"
                      >
                        <img 
                          src={item.thumbnail} 
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-3 text-center">
                          <p className="text-[10px] font-black uppercase tracking-wider text-white">
                            {replacingUrls[item.url] ? 'Overwriting...' : 'Click to Overwrite'}
                          </p>
                        </div>
                        <span className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-sky-400">
                          {item.provider}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-2">
                    <ImageIcon size={32} className="opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-wider">No search results to display</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
