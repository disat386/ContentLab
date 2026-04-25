import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Zap, 
  Loader2, 
  FileText, 
  CheckCircle2, 
  Clock,
  Layers,
  Download,
  Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { generateOutline, generateFullContent, generateImagePrompts } from '../lib/gemini';
import { wordPressService, WordPressSite } from '../lib/wordpress';
import { downloadAsTxt, downloadMarkdown, downloadAsDocx, downloadAsHtml } from '../lib/download';
import ReactMarkdown from 'react-markdown';

interface BulkTask {
  id: string;
  topic: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: string;
}

const BulkWriter: React.FC = () => {
  const { user, profile } = useAuth();
  const [inputText, setInputText] = useState('');
  const [tasks, setTasks] = useState<BulkTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState({
    tone: 'Professional',
    audience: 'General',
    length: 'Medium article (800-1200 words)',
    externalLinks: '',
    autoExternalLinks: false,
    includeImages: false,
    imageCount: 2
  });

  const [wpSites, setWpSites] = useState<WordPressSite[]>([]);
  const [selectedWpSite, setSelectedWpSite] = useState<string>('');
  const [publishToWp, setPublishToWp] = useState(false);

  React.useEffect(() => {
    if (user) {
      wordPressService.getSites(user.uid).then(setWpSites);
    }
  }, [user]);

  const parseTasks = () => {
    const lines = inputText.split('\n').filter(line => line.trim().length > 0);
    const newTasks: BulkTask[] = lines.map((line) => ({
      id: Math.random().toString(36).substr(2, 9),
      topic: line.trim(),
      status: 'pending'
    }));
    setTasks([...tasks, ...newTasks]);
    setInputText('');
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const processBulk = async () => {
    if (!user || !profile) return;
    
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) return;

    const totalCreditsNeeded = pendingTasks.length * (1 + (config.includeImages ? config.imageCount : 0));
    if (profile.credits < totalCreditsNeeded) {
      alert(`Insufficient Credits. You need ${totalCreditsNeeded} credits for this batch (${pendingTasks.length} articles + assets).`);
      return;
    }

    setIsProcessing(true);

    for (const task of pendingTasks) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'processing' } : t));

      try {
        const costPerArticle = 1 + (config.includeImages ? config.imageCount : 0);
        await updateDoc(doc(db, 'users', user.uid), { credits: increment(-costPerArticle) });

        const outlineRes = await generateOutline({
          topic: task.topic,
          tone: config.tone,
          audience: config.audience,
          length: config.length,
          externalLinks: config.externalLinks,
          autoExternalLinks: config.autoExternalLinks
        });

        let contentRes = await generateFullContent({
          topic: task.topic,
          tone: config.tone,
          audience: config.audience,
          length: config.length,
          outline: outlineRes,
          externalLinks: config.externalLinks,
          autoExternalLinks: config.autoExternalLinks
        });

        // Image Logic - Contextual Insertion
        if (config.includeImages && contentRes) {
          const prompts = await generateImagePrompts(contentRes);
          if (prompts && prompts.length > 0) {
            const sections = contentRes.split('\n## ');
            let finalContent = sections[0];
            const maxToInsert = Math.min(config.imageCount, prompts.length);
            let insertedCount = 0;

            for (let i = 1; i < sections.length; i++) {
              if (insertedCount < maxToInsert) {
                const cleanPrompt = prompts[insertedCount].replace(/[\n\r"]/g, '').trim();
                const seed = Math.floor(Math.random() * 1000000);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + ', professional editorial journalism photography, high resolution, cinematic lighting')}?width=1280&height=720&nologo=true&seed=${seed}`;
                finalContent += `\n\n![${cleanPrompt}](${imageUrl})\n\n## ` + sections[i];
                insertedCount++;
              } else {
                finalContent += `\n## ` + sections[i];
              }
            }
            
            // Backup for short articles or lack of H2s
            if (insertedCount < maxToInsert) {
              for (let j = insertedCount; j < maxToInsert; j++) {
                const cleanPrompt = prompts[j].replace(/[\n\r"]/g, '').trim();
                const seed = Math.floor(Math.random() * 1000000);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + ', professional editorial journalism photography, high resolution, cinematic lighting')}?width=1280&height=720&nologo=true&seed=${seed}`;
                finalContent += `\n\n![${cleanPrompt}](${imageUrl})`;
              }
            }
            contentRes = finalContent;
          }
        }

        // WP Publish Logic
        if (publishToWp && selectedWpSite) {
          const site = wpSites.find(s => s.id === selectedWpSite);
          if (site) {
            await wordPressService.publishPost(site, {
              title: task.topic,
              content: contentRes || '',
              status: 'draft'
            });
          }
        }

        await addDoc(collection(db, 'library'), {
          userId: user.uid,
          title: task.topic,
          content: contentRes,
          type: 'blog',
          createdAt: serverTimestamp(),
          status: 'draft'
        });

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', result: contentRes } : t));
      } catch (err) {
        console.error(err);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed', error: 'Generation failed' } : t));
      }
    }

    setIsProcessing(false);
  };

  const [previewTask, setPreviewTask] = useState<BulkTask | null>(null);
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [editedResult, setEditedResult] = useState('');

  const savePreviewEdit = async () => {
    if (!previewTask) return;
    setTasks(prev => prev.map(t => t.id === previewTask.id ? { ...t, result: editedResult } : t));
    setIsEditingPreview(false);
    
    // Also update in Firebase IF it was saved there (BulkWriter saves to 'content' collection)
    // For simplicity, we update the local state which is what 'Download' uses.
    setPreviewTask({ ...previewTask, result: editedResult });
  };

  const downloadAll = () => {
    const completed = tasks.filter(t => t.status === 'completed' && t.result);
    if (completed.length === 0) return;

    const zipContent = completed.map(t => `TITLE: ${t.topic}\n\n${t.result}`).join('\n\n' + '='.repeat(50) + '\n\n');
    const blob = new Blob([zipContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk_generation_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
            <Layers className="w-10 h-10 text-auurio-accent" />
            Bulk AI Writer
          </h1>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Scalable Content Production Factory</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
             <div className="text-[10px] text-white/40 font-black uppercase mb-1">Available Credits</div>
             <div className="text-xl font-black text-auurio-yellow">{profile?.credits || 0}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-8">
           {/* Entry Console */}
           <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-2xl">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                 <Plus className="w-4 h-4 text-auurio-accent" /> Batch Entry Console
              </h3>
              
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your topic list here...&#10;Topic 1&#10;Topic 2&#10;Topic 3..."
                rows={10}
                className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-sm focus:outline-none focus:border-auurio-accent transition-all mb-4 font-mono leading-relaxed"
              />
              
              <button 
                onClick={parseTasks}
                className="w-full py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-auurio-accent transition-all flex items-center justify-center gap-2"
              >
                Add to Queue
              </button>
           </div>

           {/* Batch Config */}
           <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6">Engine Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-white/30">Tone</label>
                    <select 
                      value={config.tone}
                      onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                    >
                       <option>Professional</option>
                       <option>Casual</option>
                       <option>Technical</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-white/30">Audience</label>
                    <select 
                      value={config.audience}
                      onChange={(e) => setConfig({ ...config, audience: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                    >
                       <option>General</option>
                       <option>Experts</option>
                       <option>Beginners</option>
                    </select>
                 </div>
              </div>

               <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] uppercase font-black text-white/30 flex items-center gap-2">
                        <Zap className="w-3 h-3 text-auurio-accent" /> Auto-Cite Authority Sources
                     </label>
                     <button 
                        onClick={() => setConfig({ ...config, autoExternalLinks: !config.autoExternalLinks })}
                        className={`w-8 h-4 rounded-full transition-all relative ${config.autoExternalLinks ? 'bg-auurio-accent' : 'bg-white/10'}`}
                     >
                        <motion.div 
                           animate={{ x: config.autoExternalLinks ? 16 : 0 }}
                           className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full" 
                        />
                     </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] uppercase font-black text-white/30 flex items-center gap-2">
                        <Plus className="w-3 h-3 text-auurio-yellow" /> Generate AI Images
                     </label>
                     <button 
                        onClick={() => setConfig({ ...config, includeImages: !config.includeImages })}
                        className={`w-8 h-4 rounded-full transition-all relative ${config.includeImages ? 'bg-auurio-yellow' : 'bg-white/10'}`}
                     >
                        <motion.div 
                           animate={{ x: config.includeImages ? 16 : 0 }}
                           className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full" 
                        />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <label className="text-[10px] uppercase font-black text-white/30 flex items-center gap-2">
                        <Globe className="w-3 h-3 text-blue-500" /> Auto-Sync WordPress
                     </label>
                     <button 
                        onClick={() => setPublishToWp(!publishToWp)}
                        className={`w-8 h-4 rounded-full transition-all relative ${publishToWp ? 'bg-blue-500' : 'bg-white/10'}`}
                     >
                        <motion.div 
                           animate={{ x: publishToWp ? 16 : 0 }}
                           className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full" 
                        />
                     </button>
                  </div>

                  {publishToWp && wpSites.length > 0 && (
                     <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-white/30">Target Site</label>
                        <select 
                           value={selectedWpSite}
                           onChange={(e) => setSelectedWpSite(e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                        >
                           <option value="">Select WP Site</option>
                           {wpSites.map(s => <option key={s.id} value={s.id}>{s.siteUrl}</option>)}
                        </select>
                     </div>
                  )}
                  
                  <div className="space-y-1.5">
                     <label className="text-[10px] uppercase font-black text-white/30">Manual Citations (Optional)</label>
                     <textarea 
                        value={config.externalLinks}
                        onChange={(e) => setConfig({ ...config, externalLinks: e.target.value })}
                        placeholder="URLs to insert into every article..."
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-auurio-accent resize-none"
                     />
                  </div>
               </div>
           </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Queue Status ({tasks.length})</h3>
              <div className="flex gap-2">
                 {tasks.length > 0 && (
                   <button 
                     onClick={() => setTasks([])}
                     disabled={isProcessing}
                     className="text-[10px] uppercase font-black text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1.5"
                   >
                     <Trash2 className="w-3 h-3" /> Clear Queue
                   </button>
                 )}
              </div>
           </div>

           <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence>
                 {tasks.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="h-64 rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-white/20 gap-3"
                    >
                       <Clock className="w-10 h-10" />
                       <span className="text-[10px] uppercase font-black tracking-widest">Queue Empty</span>
                    </motion.div>
                 ) : (
                    tasks.map((task) => (
                      <motion.div 
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`group p-6 rounded-3xl border transition-all ${
                          task.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 
                          task.status === 'processing' ? 'bg-auurio-accent/5 border-auurio-accent/40 animate-pulse' :
                          'bg-white/5 border-white/10'
                        }`}
                      >
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                               <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                                 task.status === 'completed' ? 'bg-green-500 text-black border-green-500' :
                                 task.status === 'processing' ? 'bg-auurio-accent text-black border-auurio-accent' :
                                 'bg-white/5 border-white/10 text-white/20'
                               }`}>
                                  {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                                   task.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                                   <FileText className="w-5 h-5" />}
                               </div>
                               <div>
                                  <div className="text-sm font-black text-white line-clamp-1">{task.topic}</div>
                                  <div className="text-[9px] uppercase font-black tracking-widest opacity-40">
                                     {task.status} {task.error && `• ${task.error}`}
                                  </div>
                               </div>
                            </div>
                            
                            {task.status === 'completed' && task.result && (
                               <button 
                                 onClick={() => setPreviewTask(task)}
                                 className="opacity-0 group-hover:opacity-100 p-2 text-auurio-accent hover:underline text-[10px] font-black uppercase tracking-widest transition-all"
                               >
                                  View
                               </button>
                            )}

                            {task.status === 'pending' && !isProcessing && (
                               <button 
                                 onClick={() => removeTask(task.id)}
                                 className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-400 transition-all"
                               >
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            )}
                         </div>
                      </motion.div>
                    ))
                 )}
              </AnimatePresence>
           </div>

           {tasks.length > 0 && (
             <div className="pt-8 space-y-4">
                <button 
                   disabled={isProcessing || tasks.filter(t => t.status === 'pending').length === 0}
                   onClick={processBulk}
                   className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                      isProcessing ? 'bg-white/5 text-white/20' : 'bg-auurio-accent text-black hover:scale-[1.02] active:scale-95 shadow-[0_20px_50px_rgba(255,255,255,0.1)]'
                   }`}
                >
                   {isProcessing ? (
                      <>
                         <Loader2 className="w-4 h-4 animate-spin" />
                         Processing Batch...
                      </>
                   ) : (
                      <>
                         <Zap className="w-4 h-4" />
                         Start Production Cluster ({tasks.filter(t => t.status === 'pending').length} Tasks)
                      </>
                   )}
                </button>

                {tasks.some(t => t.status === 'completed') && (
                   <button 
                      onClick={downloadAll}
                      className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                   >
                      <Download className="w-3.5 h-3.5" />
                      Download Completed Assets (.txt)
                   </button>
                )}
             </div>
           )}
        </div>
      </div>

      <AnimatePresence>
        {previewTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setPreviewTask(null)}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-5xl h-full bg-black border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]"
             >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                   <div>
                      <h2 className="text-xl font-black text-white">{previewTask.topic}</h2>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Production Output Preview</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                         onClick={() => {
                            if (isEditingPreview) {
                               savePreviewEdit();
                            } else {
                               setEditedResult(previewTask.result || '');
                               setIsEditingPreview(true);
                            }
                         }}
                         className={`px-6 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${isEditingPreview ? 'bg-green-500 border-green-500 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
                      >
                         {isEditingPreview ? 'Save Edits' : 'Edit Article'}
                      </button>
                      
                      <div className="relative group">
                         <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all">
                            <Download className="w-5 h-5" />
                         </button>
                         <div className="absolute right-0 top-full mt-2 w-48 glass bg-black/95 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 space-y-1 z-50">
                            {[
                               { label: 'Markdown', ext: 'MD', fn: downloadMarkdown, color: 'text-orange-500' },
                               { label: 'Plain Text', ext: 'TXT', fn: downloadAsTxt, color: 'text-blue-500' },
                               { label: 'MS Word', ext: 'DOC', fn: downloadAsDocx, color: 'text-indigo-500' },
                               { label: 'HTML Page', ext: 'HTM', fn: downloadAsHtml, color: 'text-green-500' }
                            ].map(opt => (
                               <button 
                                 key={opt.ext}
                                 onClick={() => opt.fn(previewTask.topic, previewTask.result || '')} 
                                 className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors"
                               >
                                 <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center ${opt.color} font-black text-[9px]`}>{opt.ext}</div>
                                 <span className="text-xs font-bold text-white/80">{opt.label}</span>
                               </button>
                            ))}
                         </div>
                      </div>

                      <button 
                        onClick={() => {
                           setPreviewTask(null);
                           setIsEditingPreview(false);
                        }}
                        className="p-3 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-auurio-accent transition-all"
                      >
                         Close
                      </button>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-12 lg:p-24 custom-scrollbar bg-[#050505]">
                   {isEditingPreview ? (
                      <div className="max-w-4xl mx-auto space-y-4">
                         <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4 italic">Standard Markdown Editor</div>
                         <textarea 
                           value={editedResult}
                           onChange={(e) => setEditedResult(e.target.value)}
                           className="w-full bg-black/40 border border-white/10 rounded-3xl p-8 text-lg leading-relaxed text-white/80 focus:border-auurio-accent outline-none min-h-[600px] transition-all"
                           spellCheck="false"
                         />
                      </div>
                   ) : (
                      <div className="max-w-4xl mx-auto">
                         <div className="mb-24 space-y-8">
                            <div className="flex items-center gap-4">
                               <span className="h-px flex-1 bg-white/10" />
                               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-auurio-accent">Batch Output</span>
                               <span className="h-px flex-1 bg-white/10" />
                            </div>
                            <h1 className="text-4xl md:text-7xl font-black text-white leading-[0.95] tracking-tighter text-center uppercase">
                               {previewTask.topic}
                            </h1>
                         </div>

                         <div className="prose prose-invert max-w-none 
                           prose-p:text-white/70 prose-p:text-2xl prose-p:leading-relaxed prose-p:mb-12 prose-font-light
                           prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter 
                           prose-h2:text-6xl prose-h2:mt-40 prose-h2:mb-16 prose-h2:uppercase prose-h2:pb-8 prose-h2:border-b-4 prose-h2:border-auurio-accent/20
                           prose-h3:text-4xl prose-h3:mt-24 prose-h3:mb-10
                           prose-strong:text-auurio-accent prose-strong:font-black
                           prose-blockquote:border-l-[12px] prose-blockquote:border-auurio-accent prose-blockquote:bg-white/5 prose-blockquote:py-16 prose-blockquote:px-16 prose-blockquote:rounded-r-[4rem] prose-blockquote:italic prose-blockquote:text-white/90 prose-blockquote:text-4xl prose-blockquote:font-black prose-blockquote:tracking-tight prose-blockquote:my-32 prose-blockquote:shadow-2xl
                           prose-li:text-white/80 prose-li:text-2xl prose-li:marker:text-auurio-accent
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
                              {previewTask.result || ''}
                            </ReactMarkdown>
                         </div>
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

export default BulkWriter;
