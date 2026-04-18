import React, { useEffect, useState } from 'react';
import { 
  Search, Shield, Mail, Calendar, 
  Trash2, Edit2, UserPlus, Fingerprint,
  UserCheck, Activity, X, CheckCircle2
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User } from '../../types';

export const Identities: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    fetch('/admin/api/users')
      .then(r => r.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => {
        setUsers([
          { id: 1, username: 'admin', email: 'admin@aura.flow', full_name: 'Huy Nguyễn', role: 'admin', is_admin: true, is_active: true, created_at: '2026-04-10' },
          { id: 2, username: 'thanhnt', email: 'thanh@example.com', full_name: 'Thanh Nguyen', role: 'user', is_admin: false, is_active: true, created_at: '2026-04-15' },
        ] as any);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Identity Hub</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Centralized member directories & permissions</p>
        </div>
        <button className="btn-primary flex items-center gap-3">
          <UserPlus size={20} />
          <span>Provision User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Identities', value: users.length, icon: <Fingerprint className="text-indigo-400" /> },
          { label: 'Verified Global Sessions', value: '42', icon: <UserCheck className="text-emerald-400" /> },
          { label: 'Active in 24h', value: '18', icon: <Activity className="text-sky-400" /> },
          { label: 'Security Alerts', value: '0', icon: <Shield className="text-slate-500" /> },
        ].map((stat, i) => (
          <div key={i} className="glass-card flex items-center gap-6">
             <div className="p-4 bg-white/5 rounded-2xl">{stat.icon}</div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                <p className="text-xl font-black text-white mt-0.5">{stat.value}</p>
             </div>
          </div>
        ))}
      </div>

      <div className="relative max-w-xl">
        <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text" 
          placeholder="Search global identities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-950/50 border border-white/5 rounded-3xl py-5 pl-16 pr-8 text-sm outline-none focus:border-indigo-500/30 transition-all font-medium"
        />
      </div>

      <div className="glass rounded-[3rem] overflow-hidden border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Subject</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Role & Security</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Discovery</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Protection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              [1, 2, 3].map(i => <tr key={i} className="animate-pulse h-24" />)
            ) : filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-3xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 relative overflow-hidden group-hover:scale-110 transition-transform">
                       <span className="font-black text-lg">{user.username[0].toUpperCase()}</span>
                       {user.is_active && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{user.full_name || user.username}</div>
                      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase mt-1">
                        <Mail size={10} /> {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <div className={`px-4 py-2 rounded-2xl border ${user.is_admin ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'} text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2`}>
                    {user.is_admin ? <Shield size={12} /> : null}
                    {user.role}
                  </div>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Calendar size={14} className="opacity-50" />
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-10 py-8 text-right">
                  <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-4">
                    <button onClick={() => { setSelectedUser(user); setIsEditModalOpen(true); }} className="p-3 rounded-2xl bg-white/5 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 transition-all"><Edit2 size={16} /></button>
                    <button className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="glass p-10 rounded-[3.5rem] w-full max-w-lg border border-white/10 relative"
            >
               <button onClick={() => setIsEditModalOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl transition-all">
                 <X size={20} className="text-slate-500" />
               </button>
               
               <div className="mb-8">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tight">Provisioning System</h3>
                 <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                    <Fingerprint size={12} /> Editing: <span className="text-indigo-400">{selectedUser.username}</span>
                 </p>
               </div>

               <form onSubmit={async (e) => {
                 e.preventDefault();
                 try {
                   const res = await fetch(`/admin/api/users/${selectedUser.id}`, {
                     method: 'PUT',
                     headers: {'Content-Type': 'application/json'},
                     body: JSON.stringify({
                       full_name: selectedUser.full_name,
                       email: selectedUser.email,
                       role: selectedUser.role,
                       is_active: selectedUser.is_active
                     })
                   });
                   const data = await res.json();
                   if (!res.ok) throw new Error(data.message || 'Update failed');
                   
                   setIsEditModalOpen(false);
                   fetchUsers(); // Refresh the list
                 } catch (err) {
                   alert("Thao tác thất bại. Vui lòng kiểm tra lại log.");
                 }
               }} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Full Name</label>
                    <input 
                      type="text" 
                      value={selectedUser.full_name || ''} 
                      onChange={e => setSelectedUser({...selectedUser, full_name: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 transition-all text-white" 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Email Address</label>
                    <input 
                      type="email" 
                      value={selectedUser.email || ''} 
                      onChange={e => setSelectedUser({...selectedUser, email: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 transition-all text-white" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Auth Role</label>
                      <select 
                        value={selectedUser.role || 'user'} 
                        onChange={e => setSelectedUser({...selectedUser, role: e.target.value})}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 text-white appearance-none h-[54px]"
                      >
                        <option value="user">Standard User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Access Status</label>
                      <select 
                        value={selectedUser.is_active ? 'active' : 'suspended'} 
                        onChange={e => setSelectedUser({...selectedUser, is_active: e.target.value === 'active'})}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500/50 text-white appearance-none h-[54px]"
                      >
                         <option value="active">Active (Granted)</option>
                         <option value="suspended">Suspended (Denied)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 mt-6">
                    <button type="submit" className="w-full btn-primary h-14 text-sm flex justify-center items-center gap-2">
                       <CheckCircle2 size={18} /> Commit Changes
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
