import React, { useState, useEffect } from 'react';
import { User, Key, Camera, CheckCircle2, Shield, Mail, Send, ExternalLink, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export const Settings: React.FC = () => {
    const [userData, setUserData] = useState<any>(null);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);
    
    // Telegram Integration State
    const [tgConfig, setTgConfig] = useState<any>(null);

    const fetchTgConfig = async () => {
        try {
            const r = await fetch('/api/auth/profile/telegram');
            if (r.ok) {
                const data = await r.json();
                setTgConfig(data);
            }
        } catch (err) {
            console.error('Failed to fetch telegram config:', err);
        }
    };

    useEffect(() => {
        fetch('/api/profile/me')
            .then(r => r.json())
            .then(data => {
                setUserData(data);
                setFullName(data.full_name || '');
                setEmail(data.email || '');
            });
        fetchTgConfig();
    }, []);

    const handleToggleTgSetting = async (field: string, val: any) => {
        try {
            const res = await fetch('/api/auth/profile/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: val })
            });
            if (res.ok) {
                setTgConfig((prev: any) => prev ? { ...prev, [field]: val } : null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUnlinkTg = async () => {
        if (!confirm('Bạn có chắc chắn muốn hủy liên kết Telegram?')) return;
        try {
            const res = await fetch('/api/auth/profile/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unlink: true })
            });
            if (res.ok) {
                fetchTgConfig();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email,
                    old_password: oldPassword,
                    new_password: newPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
                setOldPassword('');
                setNewPassword('');
            } else {
                setMessage({ type: 'error', text: data.message || 'Cập nhật thất bại' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Lỗi kết nối server' });
        }
        setLoading(false);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        const formData = new FormData();
        formData.append('avatar', e.target.files[0]);

        try {
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setUserData({ ...userData, avatar_url: data.avatar_url });
                setMessage({ type: 'success', text: 'Đã cập nhật ảnh đại diện!' });
            }
        } catch (err) {
            alert('Lỗi upload ảnh');
        }
    };

    if (!userData) return <div className="p-10 text-slate-500 uppercase font-black text-xs tracking-widest">Loading Profile...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Account Settings</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Manage your identity and security preferences</p>
            </div>

            {message.text && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} text-sm font-bold flex items-center gap-3`}
                >
                    <CheckCircle2 size={18} />
                    {message.text}
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {/* Avatar Section */}
                <div className="md:col-span-1 space-y-6">
                    <div className="glass-card p-8 flex flex-col items-center text-center space-y-6">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-600/10 border-2 border-indigo-500/20 overflow-hidden flex items-center justify-center">
                                {userData.avatar_url ? (
                                    <img src={userData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={48} className="text-indigo-400" />
                                )}
                            </div>
                            <label className="absolute inset-0 flex items-center justify-center bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-[2.5rem]">
                                <Camera size={24} className="text-white" />
                                <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" />
                            </label>
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-white">{userData.username}</h4>
                            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mt-1">{userData.role}</p>
                        </div>
                    </div>

                    <div className="glass-card p-6 space-y-4">
                        <div className="flex items-center gap-4 text-slate-400">
                            <Shield size={18} className="text-emerald-500" />
                            <span className="text-xs font-bold uppercase tracking-widest">Identity Verified</span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400">
                            <Mail size={18} className="text-indigo-400" />
                            <span className="text-xs font-medium truncate">{userData.email}</span>
                        </div>
                    </div>

                    {/* Telegram Integration Card */}
                    {tgConfig && (
                        <div className="glass-card p-6 space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <MessageCircle className="text-sky-400" size={20} />
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wider">Telegram Link</h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Central Notification Bot</p>
                                </div>
                            </div>

                            {tgConfig.is_linked ? (
                                <div className="space-y-4">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                                        <CheckCircle2 className="text-emerald-400 shrink-0" size={16} />
                                        <span className="text-xs font-bold text-emerald-400">Connected to Telegram</span>
                                    </div>
                                    
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>Mục tiêu học nhắc nhở</span>
                                            <input 
                                                type="text" 
                                                value={tgConfig.reminder_time}
                                                onChange={(e) => handleToggleTgSetting('reminder_time', e.target.value)}
                                                className="bg-slate-950/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-16 text-center outline-none"
                                            />
                                        </div>
                                        
                                        <label className="flex items-center justify-between text-xs text-slate-400 cursor-pointer">
                                            <span>Nhắc nhở học tập (Active)</span>
                                            <input 
                                                type="checkbox" 
                                                checked={tgConfig.is_active}
                                                onChange={(e) => handleToggleTgSetting('is_active', e.target.checked)}
                                                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            />
                                        </label>
                                        
                                        <label className="flex items-center justify-between text-xs text-slate-400 cursor-pointer">
                                            <span>Cảnh báo mất Streak</span>
                                            <input 
                                                type="checkbox" 
                                                checked={tgConfig.streak_guard_enabled}
                                                onChange={(e) => handleToggleTgSetting('streak_guard_enabled', e.target.checked)}
                                                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            />
                                        </label>
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={handleUnlinkTg}
                                        className="w-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider py-3 rounded-xl transition-all mt-4"
                                    >
                                        Hủy liên kết Bot
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 text-slate-400">
                                    <p className="text-[11px] leading-relaxed">
                                        Liên kết tài khoản của bạn với Telegram Bot dùng chung để nhận thông báo nhắc nhở ôn tập từ vựng, cảnh báo mất chuỗi (streak) học.
                                    </p>
                                    
                                    <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 space-y-2 text-center">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Mã liên kết của bạn</span>
                                        <span className="text-lg font-mono font-black text-indigo-400 tracking-wider block select-all">
                                            {tgConfig.connect_token}
                                        </span>
                                    </div>

                                    <a 
                                        href={`https://t.me/${tgConfig.bot_username}?start=${tgConfig.connect_token}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full btn-primary h-12 text-xs flex justify-center items-center gap-2"
                                    >
                                        <Send size={14} />
                                        Mở Telegram Link
                                        <ExternalLink size={12} />
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Form Section */}
                <div className="md:col-span-2">
                    <form onSubmit={handleUpdateProfile} className="glass-card p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Full Name</label>
                                <input 
                                    type="text" 
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 transition-all text-white" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Email Address</label>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 transition-all text-white" 
                                />
                            </div>
                        </div>

                        <div className="pt-8 border-t border-white/5 space-y-6">
                            <div className="flex items-center gap-2">
                                <Key size={16} className="text-indigo-400" />
                                <h4 className="text-sm font-black text-white uppercase tracking-wider">Change Password</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Current Password</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••"
                                        value={oldPassword}
                                        onChange={e => setOldPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 transition-all text-white" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">New Password</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 transition-all text-white" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full btn-primary h-14 text-sm flex justify-center items-center gap-3"
                            >
                                {loading ? 'Processing...' : (
                                    <>
                                        <CheckCircle2 size={18} />
                                        Save Profile Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
