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
  Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { generateOutline, generateFullContent } from '../lib/gemini';

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
    length: 'Medium',
    externalLinks: '',
    autoExternalLinks: false
  });

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

    if (profile.credits < pendingTasks.length) {
      alert(`Insufficient Credits. You need ${pendingTasks.length} credits for this batch.`);
      return;
    }

    setIsProcessing(true);

    for (const task of pendingTasks) {
      // Update local state to processing
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'processing' } : t));

      try {
        // 1. Deduct Credit
        await updateDoc(doc(db, 'users', user.uid), { credits: increment(-1) });

        // 2. Generate Outline (Internal step)
        const outlineRes = await generateOutline({
          topic: task.topic,
          tone: config.tone,
          audience: config.audience,
          length: config.length,
          externalLinks: config.externalLinks,
          autoExternalLinks: config.autoExternalLinks
        });

        // 3. Generate Full Content
        const contentRes = await generateFullContent({
          topic: task.topic,
          tone: config.tone,
          audience: config.audience,
          length: config.length,
          outline: outlineRes,
          externalLinks: config.externalLinks,
          autoExternalLinks: config.autoExternalLinks
        });

        // 4. Save to History
        await addDoc(collection(db, 'content'), {
          userId: user.uid,
          topic: task.topic,
          content: contentRes,
          type: 'article',
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
    </div>
  );
};

export default BulkWriter;
