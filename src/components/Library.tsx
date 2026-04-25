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
import { downloadMarkdown, downloadAsTxt, downloadAsDocx, downloadAsHtml } from '../lib/download';
import { Copy, Download, Check, FileCode, FileType, FileEdit } from 'lucide-react';

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
    const q = query(
      collection(db, path), 
      where('userId', 'in', [user.uid, user.email || '']),
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
    const unsub = onSnapshot(query(collection(db, path), where('userId', 'in', [user.uid, user.email || ''])), (snap) => {
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

  const [fullPreviewItem, setFullPreviewItem] = useState<LibraryItem | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full relative">
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
                    <div className="flex items-center justify-between mb-2">
                       <h4 className="text-lg font-bold">{selectedItem.title}</h4>
                       <button 
                         onClick={() => setFullPreviewItem(selectedItem)}
                         className="p-2 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/40 uppercase font-black hover:text-white transition-all"
                       >
                          Full Preview
                       </button>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-xs text-white/60 whitespace-pre-wrap max-h-64 overflow-y-auto mb-4 custom-scrollbar">
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
                  
                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={handleCopy} className="btn-outline py-2 text-xs flex items-center justify-center gap-2">
                         {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy Text'}
                       </button>
                       <button onClick={() => handleDelete(selectedItem.id)} className="btn-outline py-2 text-xs flex items-center justify-center gap-2 text-red-500 border-red-500/20 hover:bg-red-500/10">
                         <Trash2 className="w-4 h-4" /> Delete
                       </button>
                    </div>

                    <div className="relative group">
                       <button className="w-full bg-white text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-auurio-accent transition-all shadow-xl shadow-orange-500/10">
                          <Download className="w-4 h-4" /> Export Asset
                       </button>
                       <div className="absolute bottom-full left-0 right-0 mb-2 glass bg-black/95 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 space-y-1">
                          {[
                             { label: 'Markdown', fn: downloadMarkdown, icon: FileCode, ext: 'MD' },
                             { label: 'Plain Text', fn: downloadAsTxt, icon: FileType, ext: 'TXT' },
                             { label: 'MS Word', fn: downloadAsDocx, icon: FileEdit, ext: 'DOC' },
                             { label: 'HTML Page', fn: downloadAsHtml, icon: Globe, ext: 'HTML' }
                          ].map(opt => (
                             <button 
                               key={opt.ext}
                               onClick={() => opt.fn(selectedItem.title, selectedItem.content)}
                               className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg flex items-center gap-3 transition-colors"
                             >
                                <opt.icon className="w-3.5 h-3.5 text-white/40" />
                                <span className="text-xs font-bold text-white/80">{opt.label}</span>
                             </button>
                          ))}
                       </div>
                    </div>
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

      <AnimatePresence>
        {fullPreviewItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setFullPreviewItem(null)}
               className="absolute inset-0 bg-black/95 backdrop-blur-3xl" 
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 40 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 40 }}
               className="relative w-full max-w-6xl h-full bg-[#050505] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.9)]"
             >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                   <div>
                      <h2 className="text-2xl font-black text-white">{fullPreviewItem.title}</h2>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-[0.4em]">Artifact Registry Output</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="relative group">
                         <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-white/60 hover:text-white flex items-center gap-2">
                            <Download className="w-4 h-4" /> Download
                         </button>
                         <div className="absolute right-0 top-full mt-2 w-48 glass bg-black/95 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 space-y-1 z-50">
                            {[
                               { label: 'Markdown', fn: downloadMarkdown, ext: 'MD' },
                               { label: 'Plain Text', fn: downloadAsTxt, ext: 'TXT' },
                               { label: 'MS Word', fn: downloadAsDocx, ext: 'DOC' },
                               { label: 'HTML Page', fn: downloadAsHtml, ext: 'HTML' }
                            ].map(opt => (
                               <button 
                                 key={opt.ext}
                                 onClick={() => opt.fn(fullPreviewItem.title, fullPreviewItem.content)}
                                 className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors"
                               >
                                  <span className="text-xs font-bold text-white/80">{opt.label}</span>
                               </button>
                            ))}
                         </div>
                      </div>
                      <button 
                        onClick={() => setFullPreviewItem(null)}
                        className="px-6 py-2 bg-white text-black font-black text-[10px] uppercase rounded-xl hover:bg-auurio-accent transition-all"
                      >
                         Close
                      </button>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-12 md:p-24 custom-scrollbar">
                   <article className="max-w-4xl mx-auto">
                      {/* Premium Header in Library */}
                      <div className="mb-24 space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                         <div className="flex items-center gap-4">
                            <span className="h-px flex-1 bg-white/10" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-auurio-accent">Archive Registry Entry</span>
                            <span className="h-px flex-1 bg-white/10" />
                         </div>
                         <h1 className="text-5xl md:text-8xl font-black text-white leading-none tracking-tighter uppercase italic">
                            {fullPreviewItem.title}
                         </h1>
                         <div className="flex items-center justify-center gap-8 pt-12 border-t border-white/5">
                            <div className="text-[10px] uppercase font-black text-white/40 tracking-[0.3em]">Vault ID: {fullPreviewItem.id.substring(0,8).toUpperCase()}</div>
                            <div className="w-1.5 h-1.5 rounded-full bg-auurio-accent" />
                            <div className="text-[10px] uppercase font-black text-white/60 tracking-[0.3em]">{fullPreviewItem.type} Article</div>
                         </div>
                      </div>

                      <div className="prose prose-invert prose-2xl max-w-none 
                        prose-p:text-white/70 prose-p:leading-relaxed prose-p:mb-12 prose-font-light prose-p:text-2xl
                        prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter 
                        prose-h2:text-6xl prose-h2:mt-40 prose-h2:mb-16 prose-h2:uppercase prose-h2:pb-8 prose-h2:border-b-4 prose-h2:border-auurio-accent/20
                        prose-h3:text-4xl prose-h3:mt-24 prose-h3:mb-10
                        prose-strong:text-white prose-strong:font-black prose-strong:bg-white/5 prose-strong:px-2 prose-strong:rounded
                        prose-blockquote:border-l-[12px] prose-blockquote:border-auurio-accent prose-blockquote:bg-white/5 prose-blockquote:py-16 prose-blockquote:px-16 prose-blockquote:rounded-r-[4rem] prose-blockquote:italic prose-blockquote:text-white/90 prose-blockquote:text-4xl prose-blockquote:font-black prose-blockquote:tracking-tight prose-blockquote:my-32 prose-blockquote:shadow-2xl
                        prose-li:text-white/70 prose-li:marker:text-auurio-accent
                        prose-img:rounded-[4rem] prose-img:border-2 prose-img:border-white/10 shadow-2xl my-32 hover:scale-[1.02] transition-all duration-1000">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <div className="mb-12 last:mb-0">{children}</div>,
                            img: ({ ...props }) => (
                              <div className="my-32 relative group">
                                <div className="absolute -inset-8 bg-auurio-accent/20 blur-[100px] opacity-0 group-hover:opacity-40 transition-opacity rounded-[8rem]" />
                                <img 
                                  {...props} 
                                  className="rounded-[4rem] border-2 border-white/10 shadow-2xl relative z-10 w-full object-cover aspect-video" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )
                          }}
                        >
                           {fullPreviewItem.content}
                        </ReactMarkdown>
                      </div>
                   </article>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
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
