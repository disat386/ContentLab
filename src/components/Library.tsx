import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  FileText, 
  Share2, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  Database,
  Grid,
  List,
  Sparkles,
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import WPConnection from './WPConnection';
import { downloadMarkdown } from '../lib/download';
import { Copy, Download, Check } from 'lucide-react';

interface LibraryItem {
  id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  createdAt: { toDate: () => Date };
  wpLink?: string;
}

interface WPConnection {
  id: string;
  siteUrl: string;
  username: string;
  appPassword: string;
}

export default function Library() {
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [showWP, setShowWP] = useState(false);
  const [wpConnections, setWpConnections] = useState<WPConnection[]>([]);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (selectedItem) {
      navigator.clipboard.writeText(selectedItem.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!user) return;
    const path = 'library';
    const userIdentifier = user.email || user.uid;
    const q = query(
      collection(db, path), 
      where('userId', '==', userIdentifier),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const path = 'wpConnections';
    const userIdentifier = user.email || user.uid;
    const unsub = onSnapshot(query(collection(db, path), where('userId', '==', userIdentifier)), (snap) => {
      setWpConnections(snap.docs.map(d => ({ id: d.id, ...d.data() } as WPConnection)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsub();
  }, [user]);

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Permanently delete this content?')) {
      const path = `library/${id}`;
      try {
        await deleteDoc(doc(db, 'library', id));
        if (selectedItem?.id === id) setSelectedItem(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handlePublishWP = async (item: LibraryItem, connection: { 
    username: string; 
    appPassword: string; 
    siteUrl: string; 
  }) => {
    setPublishing(item.id);
    try {
      const authHeader = btoa(`${connection.username}:${connection.appPassword}`);
      const res = await fetch(`${connection.siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authHeader}`
        },
        body: JSON.stringify({
          title: item.title,
          content: item.content,
          status: 'draft'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'WP API Error');
      }
      
      const data = await res.json();
      const path = `library/${item.id}`;
      try {
        await updateDoc(doc(db, 'library', item.id), {
          status: 'published',
          wpLink: data.link
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      
      alert('Draft published successfully to WordPress!');
    } catch (err) {
      const error = err as Error;
      alert(`Failed to publish: ${error.message}`);
    } finally {
      setPublishing(null);
    }
  };

  const filteredItems = items.filter(item => 
    filter === 'all' || item.type === filter
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* Content List */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
            <FilterBtn active={filter === 'blog'} onClick={() => setFilter('blog')} label="Blogs" />
            <FilterBtn active={filter === 'repurposed'} onClick={() => setFilter('repurposed')} label="Social" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-white/10 text-white' : 'text-white/20'}`}><Grid className="w-4 h-4" /></button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-white/10 text-white' : 'text-white/20'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white/10" /></div>
        ) : filteredItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
             <Database className="w-12 h-12 mb-4" />
             <p>Your library is empty. Start generating!</p>
          </div>
        ) : (
          <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
            <AnimatePresence mode="popLayout">
              {filteredItems.map(item => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedItem(item)}
                  className={`glass-card cursor-pointer transition-all border-white/5 hover:border-auurio-accent/30 ${selectedItem?.id === item.id ? 'ring-2 ring-auurio-accent bg-auurio-accent/5' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2 rounded-lg ${item.type === 'blog' ? 'bg-auurio-accent/10 text-auurio-accent' : 'bg-auurio-yellow/10 text-auurio-yellow'}`}>
                      {item.type === 'blog' ? <FileText className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                    </div>
                    <button onClick={(e) => handleDelete(item.id, e)} className="p-2 hover:bg-red-500/10 rounded-lg text-white/20 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold mb-2 line-clamp-1">{item.title}</h3>
                  <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-widest text-white/30">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.createdAt?.toDate().toLocaleDateString()}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/60">{item.status}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Sidebar - Detail View & WP Settings */}
      <div className="lg:col-span-4 h-full">
        <div className="glass-card flex flex-col h-[600px] sticky top-24">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-auurio-yellow" />
              Inspector
            </h3>
            <button onClick={() => setShowWP(!showWP)} className={`p-2 rounded-xl transition-colors ${showWP ? 'bg-auurio-accent text-black' : 'hover:bg-white/5 text-white/20'}`}>
               <Globe className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {showWP ? (
                <motion.div key="wp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <WPConnection />
                </motion.div>
              ) : selectedItem ? (
                <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold mb-2">{selectedItem.title}</h4>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-xs text-white/60 whitespace-pre-wrap max-h-64 overflow-y-auto mb-4">
                      <ReactMarkdown>{selectedItem.content}</ReactMarkdown>
                    </div>
                  </div>

                  {selectedItem.type === 'blog' && (
                    <div className="space-y-4">
                      <h5 className="text-[10px] uppercase font-black tracking-widest text-white/40">Publish Draft</h5>
                      <div className="space-y-2">
                        {wpConnections.length === 0 ? (
                          <div className="p-4 bg-white/5 rounded-xl text-[10px] text-white/40 italic flex items-center justify-center gap-2">
                            <AlertCircle className="w-3 h-3" /> No sites connected. Click the globe icon.
                          </div>
                        ) : (
                          wpConnections.map(conn => (
                            <button
                              key={conn.id}
                              disabled={publishing === selectedItem.id}
                              onClick={() => handlePublishWP(selectedItem, conn)}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
                            >
                              <div className="flex items-center gap-3">
                                <Globe className="w-4 h-4 text-auurio-accent" />
                                <span className="text-sm font-bold truncate max-w-[150px]">{new URL(conn.siteUrl).hostname}</span>
                              </div>
                              {publishing === selectedItem.id ? <Loader2 className="w-4 h-4 animate-spin text-auurio-accent" /> : <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-white" />}
                            </button>
                          ))
                        )}
                        {selectedItem.wpLink && (
                          <a href={selectedItem.wpLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] text-green-500 font-bold uppercase tracking-widest mt-2 hover:underline">
                            <CheckCircle className="w-3 h-3" /> View Published Draft
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-6 border-t border-white/5 flex gap-2">
                    <button 
                      onClick={() => downloadMarkdown(selectedItem.title, selectedItem.content)}
                      className="btn-outline flex-1 py-2 text-xs flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button onClick={handleCopy} className="btn-outline flex-1 py-2 text-xs flex items-center justify-center gap-2">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={() => handleDelete(selectedItem.id)} className="btn-outline flex-1 py-2 text-xs flex items-center justify-center gap-2 text-red-500 border-red-500/20 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/10 text-center px-8">
                  <Database className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">Select an item to view details or manage publishing.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-auurio-accent text-black' : 'text-white/40 hover:text-white'}`}
    >
      {label}
    </button>
  );
}
