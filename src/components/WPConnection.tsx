import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { 
  Globe, 
  ShieldCheck, 
  ExternalLink, 
  Trash2, 
  Plus, 
  AlertCircle,
  Loader2,
  Key
} from 'lucide-react';

interface WPConn {
  id: string;
  siteUrl: string;
  username: string;
  appPassword?: string;
}

export default function WPConnection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WPConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const path = 'wpConnections';
    const q = query(collection(db, path), where('userId', 'in', [user.uid, user.email || '']));
    const unsub = onSnapshot(q, (snap) => {
      setConnections(snap.docs.map(d => ({ id: d.id, ...d.data() } as WPConn)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsub();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl || !username || !appPassword) return;
    setError(null);
    
    try {
      // Basic URL validation
      const url = new URL(siteUrl);
      if (url.protocol !== 'https:') {
        throw new Error('Must use HTTPS for WordPress Application Passwords.');
      }

      const path = 'wpConnections';
      try {
        await addDoc(collection(db, path), {
          userId: user!.uid,
          siteUrl: url.origin,
          username,
          appPassword, // Note: In a production app, this should ideally be encrypted or handled via a server proxy
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }

      setSiteUrl('');
      setUsername('');
      setAppPassword('');
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Disconnect this site?')) {
      const path = `wpConnections/${id}`;
      try {
        await deleteDoc(doc(db, 'wpConnections', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-auurio-accent" />
            WordPress Publishing
          </h3>
          <p className="text-sm text-white/40">Connect your WordPress sites to publish drafts directly.</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)} 
          className="btn-outline py-2 px-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
        >
          {showAdd ? 'Cancel' : <><Plus className="w-3 h-3" /> Connect Site</>}
        </button>
      </div>

      {showAdd && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          onSubmit={handleAdd} 
          className="glass-card border-auurio-accent/20 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
               <label className="text-[10px] uppercase font-bold text-white/40">Site URL (HTTPS)</label>
               <input 
                 type="url" 
                 required 
                 value={siteUrl}
                 onChange={e => setSiteUrl(e.target.value)}
                 placeholder="https://mysite.com"
                 className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-auurio-accent"
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] uppercase font-bold text-white/40">Username</label>
               <input 
                 type="text" 
                 required 
                 value={username}
                 onChange={e => setUsername(e.target.value)}
                 placeholder="admin"
                 className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-auurio-accent"
               />
             </div>
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-1">
               <Key className="w-3 h-3" /> Application Password
             </label>
             <input 
               type="password" 
               required 
               value={appPassword}
               onChange={e => setAppPassword(e.target.value)}
               placeholder="xxxx xxxx xxxx xxxx"
               className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-auurio-accent"
             />
             <p className="text-[10px] text-white/20">Create this in WP Admin {'>'} Users {'>'} Profile {'>'} Application Passwords.</p>
          </div>
          {error && <div className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
          <button type="submit" className="btn-primary w-full py-2.5">Authenticate & Connect</button>
        </motion.form>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
        ) : connections.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-3xl text-white/20">
             <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
             <p className="font-medium text-sm">No WordPress sites connected yet.</p>
          </div>
        ) : (
          connections.map(conn => (
            <div key={conn.id} className="glass-card flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 ring-1 ring-blue-500/30">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    {new URL(conn.siteUrl).hostname}
                    <ShieldCheck className="w-3 h-3 text-green-500" />
                  </h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">User: {conn.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <a href={conn.siteUrl} target="_blank" rel="noreferrer" className="p-2 hover:bg-white/5 rounded-lg text-white/20 hover:text-white">
                   <ExternalLink className="w-4 h-4" />
                 </a>
                 <button onClick={() => handleDelete(conn.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-white/20 hover:text-red-500 transition-colors">
                   <Trash2 className="w-4 h-4" />
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
