import React, { useState, useEffect } from 'react';
import { User, Key, Camera, CheckCircle2, Shield, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export const Settings: React.FC = () => {
    const [userData, setUserData] = useState<any>(null);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/profile/me')
            .then(r => r.json())
            .then(data => {
                setUserData(data);
                setFullName(data.full_name || '');
                setEmail(data.email || '');
            });
    }, []);

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
