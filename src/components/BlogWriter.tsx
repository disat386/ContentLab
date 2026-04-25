import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  generateOutline, 
  generateFullContent, 
  optimizeSEO 
} from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Layout, 
  ChevronRight, 
  CheckCircle, 
  Copy,
  Plus,
  AlertCircle,
  Search,
  Download
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { downloadMarkdown } from '../lib/download';
import ReactMarkdown from 'react-markdown';

interface Voice {
  id: string;
  name: string;
  tone: string;
  audience: string;
  style: string;
}

interface Outline {
  Title: string;
  Headings: Array<{ title: string; description: string } | string>;
}

export default function BlogWriter({ initialTopic }: { initialTopic?: string }) {
  const { user, profile } = useAuth();
  
  // Step State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input State
  const [topic, setTopic] = useState(initialTopic || '');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [keywords, setKeywords] = useState('');
  const [length, setLength] = useState('Medium article (800-1200 words)');
  const [selectedVoice, setSelectedVoice] = useState('Default');

  // Generation State
  const [outline, setOutline] = useState<Outline | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [seoData, setSeoData] = useState<{
    seoScore: number;
    readabilityGrade: string;
    metaTitle: string;
    metaDescription: string;
    urlSlug: string;
    suggestedChanges: string[];
    keywordDensity: Record<string, number>;
  } | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    if (!user) return;
    const path = 'brandVoices';
    const unsub = onSnapshot(query(collection(db, path), where('userId', '==', user.email || user.uid)), (snap) => {
      setVoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Voice)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsub();
  }, [user]);

  const handleGenerateOutline = async () => {
    if (!topic) return;
    setLoading(true);
    setError(null);
    try {
      const voice = voices.find(v => v.id === selectedVoice);
      const res = await generateOutline({ 
        topic, 
        audience: audience || 'General', 
        tone, 
        keywords: keywords.split(',').map(k => k.trim()),
        length,
        brandVoice: voice
      });
      setOutline(res);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Outline generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!profile) {
      setError('Profile not loaded. Please sign in again.');
      return;
    }
    if (profile.credits < 1) {
      setError('Insufficient Credits. Please top up in your Auurio Hub.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Deduct credit
      const userIdentifier = user?.email || user?.uid;
      try {
        await updateDoc(doc(db, 'users', userIdentifier!), { credits: increment(-1) });
      } catch (err) {
        // Log but don't block if credit deduction fails locally (it might be managed by Hub)
        console.warn("Credit deduction failed:", err);
      }

      const voice = voices.find(v => v.id === selectedVoice);
      const res = await generateFullContent({
        topic,
        audience,
        tone,
        outline,
        length,
        keywords: keywords.split(','),
        brandVoice: voice
      });
      setContent(res);
      setStep(3);

      // Save to library as draft
      const libraryPath = 'library';
      try {
        await addDoc(collection(db, libraryPath), {
          userId: userIdentifier,
          title: topic,
          content: res,
          outline: outline,
          type: 'blog',
          status: 'draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, libraryPath);
      }

    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        if (err.message.includes('{')) {
          setError('System Error: Access Denied. Check credits or Hub database connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Content generation failed due to a system error.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!content) return;
    setLoading(true);
    try {
      const res = await optimizeSEO(content, keywords.split(','));
      setSeoData(res);
      setStep(4);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'SEO analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      alert('Content copied to clipboard!');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* Sidebar - Pipeline Status */}
      <div className="lg:col-span-3 space-y-4">
        <div className="glass-card">
          <h3 className="text-sm uppercase tracking-widest font-black text-white/40 mb-6 px-1">Pipeline</h3>
          <div className="space-y-2">
            <PipelineStep num={1} label="Configure" active={step === 1} done={step > 1} />
            <PipelineStep num={2} label="Smart Outline" active={step === 2} done={step > 2} />
            <PipelineStep num={3} label="Full Generation" active={step === 3} done={step > 3} />
            <PipelineStep num={4} label="SEO Optimizer" active={step === 4} done={step > 4} />
          </div>
        </div>

        {step === 4 && seoData && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card bg-auurio-accent/5 border-auurio-accent/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-bold text-white/60">SEO Score</span>
              <span className="text-2xl font-black text-auurio-accent">{seoData.seoScore}</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${seoData.seoScore}%` }}
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500" 
              />
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-[10px] uppercase font-bold text-white/20">Readability</div>
              <div className="text-sm font-medium">{seoData.readabilityGrade}</div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Workspace */}
      <div className="lg:col-span-9 flex flex-col min-h-[600px]">
        {/* Workspace Card */}
        <div className="glass-card flex-1 flex flex-col relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-20 glass flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="relative">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 border-t-2 border-auurio-accent rounded-full" />
                <Sparkles className="w-6 h-6 text-auurio-yellow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <h4 className="text-xl font-bold">Synthesizing...</h4>
                <p className="text-white/40 text-sm max-w-xs">Our AI is accessing the Auurio semantic engine to write your authority content.</p>
              </div>
            </div>
          )}

          <div className="p-1 flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Topic or Title</label>
                        <input
                          autoFocus
                          type="text"
                          value={topic}
                          onChange={e => setTopic(e.target.value)}
                          placeholder="e.g. The Impact of Quantum Computing on Modern Cybersecurity"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-auurio-accent transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold">SEO Keywords (comma separated)</label>
                        <input
                          type="text"
                          value={keywords}
                          onChange={e => setKeywords(e.target.value)}
                          placeholder="keyword1, keyword2..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-auurio-accent"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Target Audience</label>
                        <input
                          type="text"
                          value={audience}
                          onChange={e => setAudience(e.target.value)}
                          placeholder="e.g. IT Managers, Developers"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-auurio-accent"
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Tone & Style</label>
                        <select
                          value={tone}
                          onChange={e => setTone(e.target.value)}
                          className="custom-select"
                        >
                          <option>Professional</option>
                          <option>Technical</option>
                          <option>Conversational</option>
                          <option>Persuasive</option>
                          <option>Minimalist</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Article Length</label>
                        <select
                          value={length}
                          onChange={e => setLength(e.target.value)}
                          className="custom-select"
                        >
                          <option>Short update (300-500 words)</option>
                          <option>Medium article (800-1200 words)</option>
                          <option>Long-form post (1500-2500 words)</option>
                          <option>Authority Pillar (3000+ words)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Brand Voice</label>
                        <select
                          value={selectedVoice}
                          onChange={e => setSelectedVoice(e.target.value)}
                          className="custom-select"
                        >
                          <option value="Default">Default System Voice</option>
                          {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>}
                </motion.div>
              )}

              {step === 2 && outline && (
                <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <Layout className="w-6 h-6 text-auurio-accent" />
                      Smart Outline Review
                    </h3>
                    <button onClick={() => setStep(1)} className="text-xs hover:text-auurio-accent underline font-bold uppercase tracking-widest">Edit Inputs</button>
                  </div>
                  <div className="space-y-4">
                    <div className="p-6 glass bg-white/5 rounded-2xl border-white/10">
                      <h4 className="text-xl font-bold text-white mb-4 line-clamp-1">{outline.Title}</h4>
                      {outline.Headings?.map((h: { title?: string; description?: string } | string, i: number) => (
                        <div key={i} className="mb-4 pl-4 border-l-2 border-auurio-accent/20">
                          <p className="text-sm font-bold text-white/90">
                            {typeof h === 'string' ? h : h.title || 'Section'}
                          </p>
                          <p className="text-xs text-white/40 mt-1">
                            {typeof h === 'string' ? 'Section description' : h.description || 'Section description'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && content && (
                <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 prose prose-invert prose-orange max-w-none">
                  <div className="flex justify-end gap-2 mb-8 no-prose">
                    <button 
                      onClick={() => content && downloadMarkdown(topic, content)}
                      className="btn-outline flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-widest"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button onClick={handleCopy} className="btn-outline flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-widest">
                      <Copy className="w-4 h-4" /> Copy Full
                    </button>
                    <button onClick={() => setStep(2)} className="btn-outline flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-widest">
                      <Plus className="w-4 h-4" /> New Version
                    </button>
                  </div>
                   <ReactMarkdown>{content}</ReactMarkdown>
                </motion.div>
              )}

              {step === 4 && seoData && content && (
                <motion.div key="step4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 gap-8 grid grid-cols-1 md:grid-cols-2">
                   <div className="space-y-6">
                      <h3 className="text-xl font-bold">SEO Recommendations</h3>
                      <div className="space-y-3">
                        {seoData.suggestedChanges?.map((change: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            {change}
                          </div>
                        ))}
                      </div>

                      <div className="glass bg-white/5 p-4 rounded-xl border-white/10 space-y-4">
                        <div className="space-y-1">
                           <span className="text-[10px] uppercase font-bold text-white/20">Meta Title</span>
                           <p className="text-sm font-medium">{seoData.metaTitle}</p>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] uppercase font-bold text-white/20">Meta Description</span>
                           <p className="text-sm font-medium text-white/60">{seoData.metaDescription}</p>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] uppercase font-bold text-white/20">URL Slug</span>
                           <p className="text-sm font-mono text-auurio-accent font-bold">/{seoData.urlSlug}</p>
                        </div>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h3 className="text-xl font-bold">Keyword Density</h3>
                      <div className="space-y-4">
                        {Object.entries(seoData.keywordDensity || {}).map(([kw, count]) => (
                          <div key={kw} className="space-y-1">
                             <div className="flex justify-between text-xs font-bold">
                               <span className="text-white/60">{kw}</span>
                               <span className="text-auurio-yellow">{count}x</span>
                             </div>
                             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-auurio-yellow" style={{ width: `${Math.min(count * 5, 100)}%` }} />
                             </div>
                          </div>
                        ))}
                      </div>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Bar */}
          <div className="p-6 bg-white/5 border-t border-white/5 flex items-center justify-between">
            <div className="flex gap-4">
              {step > 1 && <button onClick={() => setStep(step - 1)} className="btn-outline py-2.5 px-6">Back</button>}
            </div>
            {step === 1 && <button onClick={handleGenerateOutline} disabled={!topic || loading} className="btn-primary py-3 px-8 flex items-center gap-2">Generate Outline <ChevronRight className="w-4 h-4" /></button>}
            {step === 2 && <button onClick={handleGenerateContent} disabled={loading} className="btn-primary py-3 px-8 flex items-center gap-2">Write Full Article <Sparkles className="w-4 h-4" /></button>}
            {step === 3 && <button onClick={handleOptimize} disabled={loading} className="btn-primary py-3 px-8 flex items-center gap-2">AI Optimizer <Search className="w-4 h-4" /></button>}
            {step === 4 && <button onClick={handleCopy} className="btn-primary py-3 px-8 flex items-center gap-2">Copy Published Post <CheckCircle className="w-4 h-4" /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineStep({ num, label, active, done }: { num: number, label: string, active: boolean, done: boolean }) {
  return (
    <div className={`flex items-center gap-4 p-3 rounded-xl transition-all ${active ? 'bg-auurio-accent/10 border border-auurio-accent/20' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ring-2 ring-offset-2 ring-offset-black transition-all ${done ? 'bg-green-500 ring-green-500 text-black' : active ? 'bg-auurio-accent ring-auurio-accent text-black' : 'bg-white/5 ring-white/10 text-white/40'}`}>
        {done ? <CheckCircle className="w-4 h-4" /> : num}
      </div>
      <span className={`text-sm font-bold uppercase tracking-tight ${active ? 'text-white' : done ? 'text-white/60' : 'text-white/20'}`}>
        {label}
      </span>
    </div>
  );
}
