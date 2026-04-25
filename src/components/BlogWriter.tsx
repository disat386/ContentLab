import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  generateOutline, 
  generateFullContent, 
  optimizeSEO,
  generateImagePrompts,
} from '../lib/gemini';
import { wordPressService, WordPressSite } from '../lib/wordpress';
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
  Download,
  BookOpen,
  Image as ImageIcon,
  Save,
  Check,
  Zap,
  Calendar,
  List,
  Terminal,
  ShoppingCart,
  TrendingUp,
  FileText,
  Loader2,
  Globe,
  Link2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { downloadMarkdown, downloadAsDocx, downloadAsTxt, downloadAsHtml } from '../lib/download';
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

const CONTENT_TEMPLATES = [
  {
    id: 'listicle',
    name: 'Listicle',
    description: 'Bestseller curated lists.',
    tagline: '10 Best Ways to...',
    audience: 'Casual readers, Beginners',
    tone: 'Conversational',
    length: 'Medium article (800-1200 words)',
    prefix: '10 Best ',
    icon: 'List'
  },
  {
    id: 'howto',
    name: 'How-to Guide',
    description: 'Expert instructions.',
    tagline: 'Step-by-step instruction...',
    audience: 'Professionals, Learners',
    tone: 'Technical',
    length: 'Long-form post (1500-2500 words)',
    prefix: 'How to ',
    icon: 'Terminal'
  },
  {
    id: 'review',
    name: 'Product Review',
    description: 'Persuasive evaluation.',
    tagline: 'Honest evaluation of...',
    audience: 'Potential buyers, Techies',
    tone: 'Persuasive',
    length: 'Short update (300-500 words)',
    prefix: 'Honest Review: ',
    icon: 'ShoppingCart'
  },
  {
    id: 'thought-leadership',
    name: 'Thought Leadership',
    description: 'Industry future & vision.',
    tagline: 'The future of industry...',
    audience: 'Executives, Visionaries',
    tone: 'Professional',
    length: 'Authority Pillar (3000+ words)',
    prefix: 'The Future of ',
    icon: 'TrendingUp'
  }
];

export default function BlogWriter({ initialTopic }: { initialTopic?: string }) {
  const { user, profile } = useAuth();
  
  // Step State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input State
  const [topic, setTopic] = useState(initialTopic || '');
  const [workingTitle, setWorkingTitle] = useState('');
  const [subheading, setSubheading] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [keywords, setKeywords] = useState('');
  const [externalLinks, setExternalLinks] = useState('');
  const [autoExternalLinks, setAutoExternalLinks] = useState(false);
  const [length, setLength] = useState('Medium article (800-1200 words)');
  const [selectedVoice, setSelectedVoice] = useState('Default');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [includeImages, setIncludeImages] = useState(false);
  const [imageCount, setImageCount] = useState(2);

  const handleTemplateSelect = (templateId: string) => {
    const template = CONTENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setAudience(template.audience);
    setTone(template.tone);
    setLength(template.length);
    
    // Add prefix if topic is empty or already has a different prefix
    if (!topic || topic === '') {
      const newTopic = template.prefix;
      setTopic(newTopic);
      // Sync working title if it was empty or matched old topic
      if (!workingTitle || workingTitle === '') setWorkingTitle(newTopic);
    } else {
      // Basic check to see if we should prepend
      const hasPrefix = CONTENT_TEMPLATES.some(t => topic.toLowerCase().startsWith(t.prefix.toLowerCase()));
      if (!hasPrefix) {
        const newTopic = template.prefix + topic;
        setTopic(newTopic);
        if (workingTitle === topic) setWorkingTitle(newTopic);
      }
    }
  };

  // Generation State
  const [outline, setOutline] = useState<Outline | null>(null);
  const [editingOutline, setEditingOutline] = useState<Outline | null>(null);
  const [isEditingOutline, setIsEditingOutline] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  // WordPress State
  const [wpSites, setWpSites] = useState<WordPressSite[]>([]);
  const [selectedWpSite, setSelectedWpSite] = useState<string>('');
  const [publishDest, setPublishDest] = useState<'app' | 'wordpress'>('app');
  const [wpStatus, setWpStatus] = useState<'publish' | 'draft' | 'future'>('draft');
  const [wpPublishLoading, setWpPublishLoading] = useState(false);

  useEffect(() => {
    if (user) {
      wordPressService.getSites(user.uid).then(setWpSites);
    }
  }, [user]);

  const [scheduledDate, setScheduledDate] = useState('');

  // Metadata State
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [urlSlug, setUrlSlug] = useState('');
  const [saveStatus, setSaveStatus] = useState<null | 'saving' | 'saved'>(null);

  const [seoData, setSeoData] = useState<{
    seoScore: number;
    readabilityGrade: string;
    metaTitle: string;
    metaDescription: string;
    urlSlug: string;
    suggestedChanges: Array<{ field: string; suggestion: string; advice?: string }>;
    keywordDensity: Record<string, number>;
  } | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    if (!user) return;
    const path = 'brandVoices';
    const unsub = onSnapshot(query(collection(db, path), where('userId', 'in', [user.uid, user.email || ''])), (snap) => {
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
      const template = CONTENT_TEMPLATES.find(t => t.id === selectedTemplate);
      const res = await generateOutline({ 
        topic, 
        audience: audience || 'General', 
        tone, 
        keywords: keywords.split(',').map(k => k.trim()),
        length,
        brandVoice: voice,
        template: template?.name,
        externalLinks,
        autoExternalLinks
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
      setError('Insufficient Credits: Your Auurio account has reached its limit. Please top up in the Hub.');
      return;
    }

    setLoading(true);
    setError(null);
    
    // Calculate total cost
    const imageCredits = includeImages ? imageCount : 0;
    const totalCost = 1 + imageCredits;

    if (profile.credits < totalCost) {
      setError(`Insufficient Credits: This generation requires ${totalCost} credits (${1} for text + ${imageCredits} for images). Please top up in the Hub.`);
      setLoading(false);
      return;
    }

    try {
      // 1. Deduct Credits
      const userRef = doc(db, 'users', user!.uid);
      try {
        await updateDoc(userRef, { credits: increment(-totalCost) });
      } catch (err) {
        console.warn("Credit deduction warning:", err);
      }

      // 2. Execute with Smart Rotation
      const voice = voices.find(v => v.id === selectedVoice);
      const template = CONTENT_TEMPLATES.find(t => t.id === selectedTemplate);
      let res = await generateFullContent({
        topic,
        audience,
        tone,
        outline,
        length,
        keywords: keywords.split(','),
        brandVoice: voice,
        template: template?.name,
        externalLinks,
        autoExternalLinks
      });

      // 3. Image Insertion Logic
      if (includeImages && res) {
        const prompts = await generateImagePrompts(res);
        if (prompts && prompts.length > 0) {
          // Identify insertion points (after headings or long paragraphs)
          const searchPattern = /\n\n(?=[A-Z])/g;
          const pieces = res.split(searchPattern);
          let insertedCount = 0;
          const maxToInsert = Math.min(imageCount, prompts.length);
          
          // Try to insert every few pieces to spread them out
          const interval = Math.max(1, Math.floor(pieces.length / (maxToInsert + 1)));
          
          const enhancedPieces = pieces.map((piece, idx) => {
            if (idx > 0 && idx % interval === 0 && insertedCount < maxToInsert) {
              const rawPrompt = prompts[insertedCount];
              const cleanPrompt = rawPrompt.replace(/[\n\r"]/g, '').trim();
              const seed = Math.floor(Math.random() * 1000000);
              const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + ', wide angle, highly crystalline, photorealistic, 8k, f/1.8, bokeh, masterpiece')}?width=1024&height=768&nologo=true&seed=${seed}`;
              insertedCount++;
              return `\n\n![${cleanPrompt}](${imageUrl})\n\n${piece}`;
            }
            return piece;
          });
          
          res = enhancedPieces.join('\n\n');
          
          // Backup insert if split didn't yield enough spots
          if (insertedCount < maxToInsert) {
             const remaining = maxToInsert - insertedCount;
             for(let i=0; i<remaining; i++) {
                const rawPrompt = prompts[insertedCount];
                const cleanPrompt = rawPrompt.replace(/[\n\r"]/g, '').trim();
                const seed = Math.floor(Math.random() * 1000100);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + ', wide angle, highly crystalline, photorealistic, 8k, f/1.8, bokeh, masterpiece')}?width=1024&height=768&nologo=true&seed=${seed}`;
                res += `\n\n![${cleanPrompt}](${imageUrl})`;
                insertedCount++;
             }
          }
        }
      }

      setContent(res);
      setStep(3);

      // 3. Save to Library
      const libraryPath = 'library';
      try {
        const docRef = await addDoc(collection(db, libraryPath), {
          userId: user?.email || user?.uid,
          title: topic,
          workingTitle: workingTitle || topic,
          subheading,
          content: res,
          outline: outline,
          type: 'blog',
          status: 'draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setCurrentDocId(docRef.id);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, libraryPath);
      }

    } catch (err) {
      console.error("Content Generation Error:", err);
      
      // User-friendly error mapping
      if (err instanceof Error) {
        if (err.message.includes('SYSTEM_EXHAUSTED')) {
          setError('System Capacity Reached: All AI nodes are currently busy. Please wait 1-2 minutes.');
        } else if (err.message.includes('AI Quota Exceeded') || err.message.includes('429')) {
          setError('Rate Limit: You are generating content too fast. Please wait 60 seconds.');
        } else if (err.message.includes('Permission Denied') || err.message.includes('{')) {
          setError('Authentication Error: Please ensure you have an active subscription in the Auurio Hub.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected system error occurred. Our engineers have been notified.');
      }

      // Optional: Refund credit if deduction happened but generation failed?
      // For now we follow the "deduct before" rule which is stricter.
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
      setMetaTitle(res.metaTitle || '');
      setMetaDescription(res.metaDescription || '');
      setUrlSlug(res.urlSlug || '');
      setStep(4);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'SEO analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleToggle = async () => {
    if (!currentDocId || !scheduledDate) return;
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, 'library', currentDocId), {
        scheduledPublishDate: scheduledDate,
        status: 'scheduled',
        updatedAt: serverTimestamp()
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `library/${currentDocId}`);
      setSaveStatus(null);
    }
  };

  const handleSaveMetadata = async () => {
    if (!currentDocId) return;
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, 'library', currentDocId), {
        metaTitle,
        metaDescription,
        urlSlug,
        updatedAt: serverTimestamp()
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `library/${currentDocId}`);
      setSaveStatus(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!topic || !user) return;
    setSaveStatus('saving');
    try {
      await addDoc(collection(db, 'library'), {
        userId: user.uid,
        topic,
        workingTitle: workingTitle || topic,
        subheading,
        audience,
        tone,
        keywords,
        length,
        selectedVoice,
        selectedTemplate,
        type: 'blog_draft',
        status: 'draft_input',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'library');
      setSaveStatus(null);
    }
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      alert('Content copied to clipboard!');
    }
  };

  const handleUpdateContent = async () => {
    if (!currentDocId || !content) return;
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, 'library', currentDocId), {
        content,
        updatedAt: serverTimestamp()
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
      setIsEditingContent(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `library/${currentDocId}`);
      setSaveStatus(null);
    }
  };

  const handleWordPressPublish = async () => {
    if (!content || !selectedWpSite || !user) return;
    const site = wpSites.find(s => s.id === selectedWpSite);
    if (!site) return;

    setWpPublishLoading(true);
    setError(null);
    try {
      await wordPressService.publishPost(site, {
        title: topic,
        content: content,
        status: wpStatus,
        date: wpStatus === 'future' ? scheduledDate : undefined
      });
      setStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WordPress publishing failed');
    } finally {
      setWpPublishLoading(false);
    }
  };

  const handleFinishLocal = async () => {
    setLoading(true);
    try {
      await handleSaveMetadata();
      setStep(6);
    } catch {
      setError('Failed to finalize draft');
    } finally {
      setLoading(false);
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
            <PipelineStep num={5} label="Publish" active={step === 5} done={step > 5} />
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
                  {/* Template Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black flex items-center gap-2">
                       <BookOpen className="w-3 h-3 text-auurio-accent" /> Content Templates
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {CONTENT_TEMPLATES.map(temp => {
                        const Icon = { List, Terminal, ShoppingCart, TrendingUp }[temp.icon] || FileText;
                        return (
                          <button
                            key={temp.id}
                            onClick={() => handleTemplateSelect(temp.id)}
                            className={`group p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${selectedTemplate === temp.id ? 'bg-auurio-accent/10 border-auurio-accent shadow-[0_0_20px_rgba(255,165,0,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`p-1.5 rounded-lg transition-colors ${selectedTemplate === temp.id ? 'bg-auurio-accent/20 text-auurio-accent' : 'bg-white/5 text-white/20 group-hover:text-white/40'}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className={`text-xs font-black uppercase transition-colors ${selectedTemplate === temp.id ? 'text-auurio-accent' : 'text-white/60 group-hover:text-white'}`}>{temp.name}</div>
                            </div>
                            <div className="text-[10px] text-white/40 font-bold uppercase tracking-tight mb-1">{temp.description}</div>
                            <div className="text-[9px] text-white/20 font-medium leading-tight line-clamp-1 italic">{temp.tagline}</div>
                            {selectedTemplate === temp.id && (
                              <motion.div layoutId="temp-active" className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-auurio-accent shadow-[0_0_10px_orange]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-widest text-white/20 font-black">Working Title (Internal)</label>
                          <span className="text-[9px] text-white/10 font-bold uppercase">Private Drafting</span>
                        </div>
                        <input
                          type="text"
                          value={workingTitle}
                          onChange={e => setWorkingTitle(e.target.value)}
                          placeholder="Internal name for this draft..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-auurio-accent/50 transition-all text-white/60"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={`text-xs uppercase tracking-widest font-bold transition-colors ${selectedTemplate ? 'text-auurio-accent' : 'text-white/40'}`}>Topic or Title</label>
                        <input
                          autoFocus
                          type="text"
                          value={topic}
                          onChange={e => {
                            const val = e.target.value;
                            if (workingTitle === topic || !workingTitle) setWorkingTitle(val);
                            setTopic(val);
                          }}
                          placeholder="e.g. The Impact of Quantum Computing on Modern Cybersecurity"
                          className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-lg font-bold focus:outline-none transition-all ${selectedTemplate ? 'border-auurio-accent/30 focus:border-auurio-accent bg-auurio-accent/5' : 'border-white/10 focus:border-auurio-accent'}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-white/20 font-black">Subheading (Optional)</label>
                        <input
                          type="text"
                          value={subheading}
                          onChange={e => setSubheading(e.target.value)}
                          placeholder="A catchy secondary hook..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-auurio-accent"
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
                        <label className="text-xs uppercase tracking-widest text-white/40 font-bold flex items-center justify-between gap-2">
                           <div className="flex items-center gap-2">
                             <Link2 className="w-3.5 h-3.5 text-auurio-accent" /> External Links / Citations
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] text-white/30">Auto-Cite</span>
                             <button 
                                onClick={() => setAutoExternalLinks(!autoExternalLinks)}
                                className={`w-8 h-4 rounded-full transition-all relative ${autoExternalLinks ? 'bg-auurio-accent' : 'bg-white/10'}`}
                             >
                                <motion.div 
                                   animate={{ x: autoExternalLinks ? 16 : 0 }}
                                   className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm" 
                                />
                             </button>
                           </div>
                        </label>
                        <textarea
                          rows={2}
                          value={externalLinks}
                          onChange={e => setExternalLinks(e.target.value)}
                          placeholder={autoExternalLinks ? "AI will auto-cite authority sources. Add specific URLs here if needed..." : "Paste URLs you want referenced in the article..."}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-auurio-accent resize-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={`text-xs uppercase tracking-widest font-bold transition-colors ${selectedTemplate ? 'text-auurio-accent' : 'text-white/40'}`}>Target Audience</label>
                        <select
                          value={audience}
                          onChange={e => setAudience(e.target.value)}
                          className={`custom-select ${selectedTemplate ? 'border-auurio-accent/30 bg-auurio-accent/5' : ''}`}
                        >
                          <option value="">Select Target Audience</option>
                          <option>General Public</option>
                          <option>Business Professionals</option>
                          <option>Tech Enthusiasts</option>
                          <option>Small Business Owners</option>
                          <option>Students & Educators</option>
                          <option>Health & Wellness Seekers</option>
                          <option>Finance & Investment Enthusiasts</option>
                          <option>Parents & Families</option>
                          <option>Creatives & Designers</option>
                          <option>Marketers & Content Creators</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className={`text-xs uppercase tracking-widest font-bold transition-colors ${selectedTemplate ? 'text-auurio-accent' : 'text-white/40'}`}>Tone & Style</label>
                        <select
                          value={tone}
                          onChange={e => setTone(e.target.value)}
                          className={`custom-select ${selectedTemplate ? 'border-auurio-accent/30 bg-auurio-accent/5' : ''}`}
                        >
                          <option>Professional</option>
                          <option>Technical</option>
                          <option>Conversational</option>
                          <option>Persuasive</option>
                          <option>Minimalist</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className={`text-xs uppercase tracking-widest font-bold transition-colors ${selectedTemplate ? 'text-auurio-accent' : 'text-white/40'}`}>Article Length</label>
                        <select
                          value={length}
                          onChange={e => setLength(e.target.value)}
                          className={`custom-select ${selectedTemplate ? 'border-auurio-accent/30 bg-auurio-accent/5' : ''}`}
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

                      {/* AI Image Generation Settings */}
                      <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/10 mt-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs uppercase tracking-widest font-black flex items-center gap-2">
                             <ImageIcon className={`w-4 h-4 ${includeImages ? 'text-auurio-accent' : 'text-white/20'}`} />
                             Include AI Assets
                          </label>
                          <button 
                            onClick={() => setIncludeImages(!includeImages)}
                            className={`w-10 h-5 rounded-full transition-all relative ${includeImages ? 'bg-auurio-accent' : 'bg-white/10'}`}
                          >
                            <motion.div 
                              animate={{ x: includeImages ? 20 : 0 }}
                              className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full" 
                            />
                          </button>
                        </div>
                        
                        {includeImages && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 pt-2">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] text-white/40 font-bold uppercase">Image Density</span>
                                <span className="text-xs font-black text-auurio-accent">{imageCount} Images</span>
                             </div>
                             <input 
                               type="range" 
                               min="1" 
                               max="6" 
                               value={imageCount}
                               onChange={(e) => setImageCount(parseInt(e.target.value))}
                               className="w-full accent-auurio-accent bg-white/5 rounded-lg h-1"
                             />
                             <div className="p-3 rounded-xl bg-auurio-accent/5 border border-auurio-accent/20 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase">
                                   <Zap className="w-3 h-3 text-auurio-yellow" /> Total Generation Cost
                                </div>
                                <span className="text-xs font-black text-auurio-accent">{1 + imageCount} Credits</span>
                             </div>
                          </motion.div>
                        )}
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
                    <div className="flex items-center gap-4">
                       {!isEditingOutline ? (
                         <button 
                            onClick={() => {
                               setEditingOutline(JSON.parse(JSON.stringify(outline)));
                               setIsEditingOutline(true);
                            }}
                            className="text-xs font-black uppercase tracking-widest text-auurio-accent hover:underline"
                         >
                            Edit Outline
                         </button>
                       ) : (
                         <button 
                            onClick={() => {
                               setOutline(editingOutline);
                               setIsEditingOutline(false);
                            }}
                            className="bg-auurio-accent text-black px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"
                         >
                            Save Changes
                         </button>
                       )}
                       <button onClick={() => setStep(1)} className="text-xs hover:text-auurio-accent underline font-bold uppercase tracking-widest text-white/40">Edit Inputs</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-6 glass bg-white/5 rounded-2xl border border-white/10">
                      {isEditingOutline ? (
                        <div className="space-y-6">
                           <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-black text-white/30">Main Title</label>
                              <input 
                                 type="text"
                                 value={editingOutline?.Title}
                                 onChange={e => setEditingOutline(prev => prev ? { ...prev, Title: e.target.value } : null)}
                                 className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold focus:border-auurio-accent outline-none"
                              />
                           </div>
                           <div className="space-y-4">
                              <label className="text-[10px] uppercase font-black text-white/30">Structure Components</label>
                              {editingOutline?.Headings.map((h, i) => (
                                 <div key={i} className="space-y-2 p-4 bg-black/20 rounded-xl border border-white/5">
                                    <input 
                                       type="text"
                                       value={typeof h === 'string' ? h : h.title}
                                       onChange={e => {
                                          const newHeadings = [...editingOutline.Headings];
                                          if (typeof h === 'string') newHeadings[i] = e.target.value;
                                          else newHeadings[i] = { ...h, title: e.target.value };
                                          setEditingOutline({ ...editingOutline, Headings: newHeadings });
                                       }}
                                       className="w-full bg-transparent border-b border-white/10 pb-1 text-sm font-bold text-white focus:border-auurio-accent outline-none"
                                    />
                                    <textarea 
                                       value={typeof h === 'string' ? '' : h.description}
                                       onChange={e => {
                                          const newHeadings = [...editingOutline.Headings];
                                          const desc = e.target.value;
                                          if (typeof h === 'string') newHeadings[i] = { title: h, description: desc };
                                          else newHeadings[i] = { ...h, description: desc };
                                          setEditingOutline({ ...editingOutline, Headings: newHeadings });
                                       }}
                                       placeholder="Section description/instructions..."
                                       rows={2}
                                       className="w-full bg-transparent text-xs text-white/40 focus:text-white/60 outline-none resize-none"
                                    />
                                 </div>
                              ))}
                           </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-xl font-bold text-white mb-6 bg-white/5 p-4 rounded-xl border border-white/10">{outline.Title}</h4>
                          <div className="space-y-6">
                            {outline.Headings?.map((h: { title?: string; description?: string } | string, i: number) => (
                              <div key={i} className="relative pl-10">
                                <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-auurio-accent/10 border border-auurio-accent/20 flex items-center justify-center text-[10px] font-black text-auurio-accent">
                                   {i + 1}
                                </div>
                                <p className="text-base font-bold text-white/90">
                                  {typeof h === 'string' ? h : h.title || 'Section'}
                                </p>
                                <p className="text-sm text-white/40 mt-2 leading-relaxed">
                                  {typeof h === 'string' ? 'Section description' : h.description || 'Section description'}
                                </p>
                                {i < (outline.Headings?.length || 0) - 1 && (
                                   <div className="absolute left-3 top-6 bottom-[-24px] w-px bg-white/5" />
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditingOutline && (
                     <motion.div initial={{ opacity: 20, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between pt-8 border-t border-white/5">
                        <div className="flex items-center gap-8">
                           <div className="flex items-center gap-3">
                              <div className="text-xs font-bold text-white/60">Include AI Assets</div>
                              <button 
                                 onClick={() => setIncludeImages(!includeImages)}
                                 className={`w-10 h-5 rounded-full transition-all relative ${includeImages ? 'bg-auurio-accent' : 'bg-white/10'}`}
                              >
                                 <motion.div 
                                    animate={{ x: includeImages ? 20 : 0 }}
                                    className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" 
                                 />
                              </button>
                           </div>
                           
                           {includeImages && (
                             <div className="flex items-center gap-4 border-l border-white/10 pl-8">
                                <span className="text-[10px] uppercase font-black text-white/30">Quantity</span>
                                <div className="flex items-center gap-2">
                                   {[2, 3, 5, 8].map(c => (
                                     <button 
                                       key={c}
                                       onClick={() => setImageCount(c)}
                                       className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all border ${imageCount === c ? 'bg-auurio-accent border-auurio-accent text-black' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                     >
                                       {c}
                                     </button>
                                   ))}
                                </div>
                             </div>
                           )}
                        </div>

                        <button
                          onClick={handleGenerateContent}
                          className="bg-auurio-accent text-black px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-[0_20px_50px_rgba(255,165,0,0.2)] flex items-center gap-3 group"
                        >
                          <Zap className="w-5 h-5 group-hover:animate-pulse" />
                          Construct Final Content
                        </button>
                     </motion.div>
                  )}
                </motion.div>
              )}

              {step === 3 && content && (
                <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-full relative overflow-hidden">
                  {/* Floating Inspector Sidebar (Desktop) */}
                  <div className="absolute right-8 top-32 bottom-8 w-80 hidden xl:flex flex-col gap-6 z-30">
                     <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass-card p-6 border-auurio-accent/20 bg-auurio-accent/5">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                           <Zap className="w-3 h-3 text-auurio-accent" /> Intelligence Report
                        </h4>
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white/60">Semantic Authority</span>
                              <span className="text-sm font-black text-white">96%</span>
                           </div>
                           <div className="flex items-center justify-between">
                               <span className="text-xs font-bold text-white/60">Readability</span>
                               <span className="text-sm font-black text-auurio-accent">Pro</span>
                            </div>
                            <div className="space-y-2">
                               <div className="flex items-center justify-between text-[9px] font-black uppercase text-white/20">Keyword Distribution</div>
                               <div className="flex flex-wrap gap-1">
                                  {topic.split(' ').slice(0, 3).map(kw => (
                                     <span key={kw} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/40 font-black">{kw}</span>
                                  ))}
                               </div>
                            </div>
                        </div>
                     </motion.div>

                     <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card p-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-6">Distribution Readiness</h4>
                        <div className="space-y-4">
                           {[
                              { label: 'LinkedIn Hook', status: true },
                              { label: 'Twitter Thread', status: true },
                              { label: 'WP Schema', status: false },
                              { label: 'OG Graph', status: true }
                           ].map(item => (
                              <div key={item.label} className="flex items-center justify-between">
                                 <span className="text-[10px] font-bold text-white/40 uppercase">{item.label}</span>
                                 {item.status ? <Check className="w-3 h-3 text-green-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-white/10" />}
                              </div>
                           ))}
                        </div>
                     </motion.div>
                  </div>
                  <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 p-6 bg-black/80 backdrop-blur-3xl border-b border-white/5 no-prose">
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Editorial Hub</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative group">
                        <button 
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white flex items-center gap-2 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-48 glass bg-black/95 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 space-y-1 z-50">
                          <button onClick={() => downloadMarkdown(topic, content)} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 font-black text-[9px]">MD</div>
                            <span className="text-xs font-bold text-white/80">Markdown</span>
                          </button>
                          <button onClick={() => downloadAsTxt(topic, content)} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-[9px]">TXT</div>
                            <span className="text-xs font-bold text-white/80">Plain Text</span>
                          </button>
                          <button onClick={() => downloadAsDocx(topic, content)} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-[9px]">DOC</div>
                            <span className="text-xs font-bold text-white/80">MS Word</span>
                          </button>
                          <button onClick={() => downloadAsHtml(topic, content)} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 font-black text-[9px]">HTM</div>
                            <span className="text-xs font-bold text-white/80">HTML Page</span>
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => setIsEditingContent(!isEditingContent)} 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${isEditingContent ? 'bg-auurio-accent border-auurio-accent text-black' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
                      >
                        {isEditingContent ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        {isEditingContent ? 'Preview Mode' : 'Edit Article'}
                      </button>

                      {isEditingContent ? (
                        <button 
                          onClick={handleUpdateContent}
                          disabled={saveStatus === 'saving'}
                          className="px-6 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-auurio-accent transition-all flex items-center gap-2"
                        >
                          {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save Changes
                        </button>
                      ) : (
                        <button onClick={handleCopy} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white flex items-center gap-2">
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 p-6 md:p-12 lg:p-24 bg-[#0a0a0a]">
                     {isEditingContent ? (
                       <div className="max-w-5xl mx-auto space-y-6">
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                             Markdown Editor: Use standard syntax for headings, links, and formatting.
                          </div>
                          <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={40}
                            className="w-full bg-black/40 border border-white/10 rounded-3xl p-8 text-lg font-medium leading-relaxed text-white/80 focus:border-auurio-accent outline-none shadow-2xl transition-all"
                            spellCheck="false"
                          />
                       </div>
                     ) : (
                       <div className="max-w-4xl mx-auto">
                          {/* Premium Article Header */}
                          <div className="mb-24 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                             <div className="flex items-center gap-4">
                                <span className="h-px flex-1 bg-white/10" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-auurio-accent">Digital Artifact</span>
                                <span className="h-px flex-1 bg-white/10" />
                             </div>
                             
                             <h1 className="text-5xl md:text-8xl font-black text-white leading-[0.95] tracking-tighter text-center">
                                {topic}
                             </h1>

                             {subheading && (
                                <p className="text-xl md:text-2xl text-white/40 font-medium text-center max-w-2xl mx-auto italic leading-normal">
                                   {subheading}
                                </p>
                             )}

                             <div className="flex flex-wrap items-center justify-center gap-8 pt-12 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                   <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-auurio-accent to-auurio-yellow flex items-center justify-center text-black font-black text-xs">AI</div>
                                   <div className="text-left">
                                      <div className="text-[10px] font-black text-white uppercase tracking-tighter">Authored by Auurio CI</div>
                                      <div className="text-[9px] text-white/30 font-bold uppercase">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                   </div>
                                </div>
                                <div className="flex items-center gap-6 text-[10px] uppercase font-black text-white/40 tracking-[0.2em] bg-white/5 py-3 px-6 rounded-full border border-white/10">
                                   <div className="flex items-center gap-2">
                                      <BookOpen className="w-3.5 h-3.5 text-auurio-accent" /> {Math.ceil(content.split(/\s+/).length / 200)} MIN READ
                                   </div>
                                </div>
                             </div>
                          </div>

                          <div className="prose prose-invert prose-2xl max-w-none 
                            prose-p:text-white/70 prose-p:leading-relaxed prose-p:mb-12 prose-p:font-light prose-p:text-2xl
                            prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter 
                            prose-h2:text-6xl prose-h2:mt-40 prose-h2:mb-16 prose-h2:pb-8 prose-h2:border-b-4 prose-h2:border-auurio-accent/20 prose-h2:uppercase
                            prose-h3:text-4xl prose-h3:mt-24 prose-h3:mb-10 prose-h3:text-white/90
                            prose-strong:text-white prose-strong:font-black prose-strong:bg-white/5 prose-strong:px-2 prose-strong:rounded
                            prose-blockquote:border-l-[12px] prose-blockquote:border-auurio-accent prose-blockquote:bg-white/5 prose-blockquote:py-16 prose-blockquote:px-16 prose-blockquote:rounded-r-[4rem] prose-blockquote:italic prose-blockquote:text-white/90 prose-blockquote:text-4xl prose-blockquote:font-black prose-blockquote:tracking-tight prose-blockquote:my-32 prose-blockquote:shadow-2xl
                            prose-li:text-white/70 prose-li:text-2xl prose-li:mb-6 prose-li:marker:text-auurio-accent prose-li:marker:font-black
                            prose-img:rounded-[4rem] prose-img:border-2 prose-img:border-white/10 prose-img:shadow-[0_60px_150px_rgba(0,0,0,0.9)] prose-img:my-32 prose-img:hover:scale-[1.03] prose-img:transition-all prose-img:duration-1000
                            prose-a:text-auurio-accent prose-a:font-black prose-a:underline prose-a:underline-offset-8 hover:prose-a:text-white transition-all">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <div className="mb-12 last:mb-0">{children}</div>,
                                img: ({ ...props }) => (
                                  <div className="my-32 relative group">
                                    <div className="absolute -inset-8 bg-auurio-accent/20 blur-[100px] opacity-0 group-hover:opacity-40 transition-opacity rounded-[8rem]" />
                                    <img 
                                      {...props} 
                                      className="rounded-[4rem] border-2 border-white/10 shadow-2xl relative z-10 w-full object-cover aspect-video hover:scale-[1.02] transition-all duration-700 cursor-zoom-in" 
                                      referrerPolicy="no-referrer"
                                      loading="lazy"
                                    />
                                    {props.alt && (
                                      <div className="mt-8 text-center text-[10px] uppercase font-black tracking-[0.4em] text-white/20 italic">
                                        &mdash; ARCHIVE: {props.alt} &mdash;
                                      </div>
                                    )}
                                  </div>
                                )
                              }}
                            >
                              {content}
                            </ReactMarkdown>
                          </div>
                          
                          {/* Metrics Footer */}
                          <div className="mt-40 pt-12 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-12 no-prose">
                             <div className="space-y-2">
                                <div className="text-[10px] uppercase font-black text-white/20 tracking-widest">Metadata Yield</div>
                                <div className="text-3xl font-black text-white">{content.split(/\s+/).length} <span className="text-xs text-white/40">WORDS</span></div>
                             </div>
                             <div className="space-y-2">
                                <div className="text-[10px] uppercase font-black text-white/20 tracking-widest">Editorial Pass</div>
                                <div className="text-3xl font-black text-auurio-accent">SUCCESS</div>
                             </div>
                             <div className="space-y-2">
                                <div className="text-[10px] uppercase font-black text-white/20 tracking-widest">Visual Assets</div>
                                <div className="text-3xl font-black text-white/80">{(content.match(/!\[.*?\]\(.*?\)/g) || []).length} UNITS</div>
                             </div>
                             <div className="space-y-2">
                                <div className="text-[10px] uppercase font-black text-white/20 tracking-widest">Integrity Hash</div>
                                <div className="text-3xl font-black text-auurio-yellow">98.4%</div>
                             </div>
                          </div>
                       </div>
                     )}
                  </div>
                </motion.div>
              )}

               {step === 4 && seoData && content && (
                <motion.div key="step4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 gap-8 grid grid-cols-1 md:grid-cols-2">
                   <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                           <Search className="w-5 h-5 text-auurio-accent" />
                           Critical SEO Adjustments
                        </h3>
                        <div className="space-y-4">
                          {seoData.suggestedChanges?.map((change, i) => (
                            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl group hover:border-auurio-accent/30 transition-all">
                              <div className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-white/90">{typeof change === 'string' ? change : change.suggestion}</p>
                                  {(typeof change !== 'string' && change.advice) && (
                                    <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors leading-relaxed">
                                      <span className="text-auurio-accent font-bold uppercase text-[9px] mr-1">Advice:</span>
                                      {change.advice}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="glass bg-white/5 p-6 rounded-2xl border-white/10 space-y-6">
                        <div className="flex items-center justify-between">
                           <h4 className="text-sm font-black uppercase tracking-widest text-white/60 italic">Search Metadata</h4>
                           <button 
                             onClick={handleSaveMetadata}
                             disabled={!currentDocId || saveStatus === 'saving'}
                             className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${saveStatus === 'saved' ? 'text-green-500' : 'text-auurio-accent hover:opacity-80 disabled:opacity-30'}`}
                           >
                             {saveStatus === 'saving' ? <Sparkles className="w-3 h-3 animate-pulse" /> : saveStatus === 'saved' ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                             {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Applied' : 'Save Metadata'}
                           </button>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                             <label className="text-[10px] uppercase font-bold text-white/20 ml-1">Meta Title</label>
                             <input 
                               type="text"
                               value={metaTitle}
                               onChange={e => setMetaTitle(e.target.value)}
                               className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-auurio-accent"
                             />
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[10px] uppercase font-bold text-white/20 ml-1">Meta Description</label>
                             <textarea 
                               rows={3}
                               value={metaDescription}
                               onChange={e => setMetaDescription(e.target.value)}
                               className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-auurio-accent resize-none"
                             />
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[10px] uppercase font-bold text-white/20 ml-1">URL Slug</label>
                             <div className="flex items-center gap-2">
                               <span className="text-xs text-white/20 font-mono">/</span>
                               <input 
                                 type="text"
                                 value={urlSlug}
                                 onChange={e => setUrlSlug(e.target.value)}
                                 className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm font-mono text-auurio-accent focus:outline-none focus:border-auurio-accent"
                               />
                             </div>
                          </div>
                        </div>
                      </div>

                      <div className="glass bg-white/5 p-6 rounded-2xl border-white/10 space-y-6">
                        <div className="flex items-center justify-between">
                           <h4 className="text-sm font-black uppercase tracking-widest text-white/60 italic">Publishing Schedule</h4>
                           <button 
                             onClick={handleScheduleToggle}
                             disabled={!currentDocId || !scheduledDate || saveStatus === 'saving'}
                             className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-auurio-yellow hover:opacity-80 disabled:opacity-30 transition-all font-black"
                           >
                              <Calendar className="w-3 h-3" />
                              {saveStatus === 'saved' ? 'Scheduled' : 'Book Slots'}
                           </button>
                        </div>
                        <div className="space-y-4">
                           <div className="relative group">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-auurio-yellow transition-colors" />
                              <input 
                                type="datetime-local" 
                                value={scheduledDate}
                                onChange={e => setScheduledDate(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs text-white/60 focus:outline-none focus:border-auurio-yellow/50 transition-all"
                              />
                           </div>
                           <p className="text-[9px] text-white/20 italic text-center">Your post will be marked as "Scheduled" and staged for the Auurio publish engine.</p>
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

               {step === 5 && (
                 <motion.div key="step5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto space-y-8">
                   <div className="text-center space-y-2">
                     <h2 className="text-3xl font-black uppercase tracking-tight">Finalizing Your Masterpiece</h2>
                     <p className="text-white/40">Choose where this article should live.</p>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <button 
                       onClick={() => setPublishDest('app')}
                       className={`p-8 rounded-3xl border-2 transition-all text-left relative group ${publishDest === 'app' ? 'bg-auurio-accent/10 border-auurio-accent shadow-[0_0_40px_rgba(255,165,0,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                     >
                       <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                         <Save className={`w-6 h-6 ${publishDest === 'app' ? 'text-auurio-accent' : 'text-white/40'}`} />
                       </div>
                       <h3 className="text-xl font-bold mb-2">Save to Library</h3>
                       <p className="text-sm text-white/40 leading-relaxed font-medium">Keep it as a draft in your Auurio Library for further editing or manual export.</p>
                       {publishDest === 'app' && <motion.div layoutId="dest-active" className="absolute top-6 right-6 w-3 h-3 rounded-full bg-auurio-accent shadow-[0_0_15px_orange]" />}
                     </button>

                     <button 
                       onClick={() => setPublishDest('wordpress')}
                       className={`p-8 rounded-3xl border-2 transition-all text-left relative group ${publishDest === 'wordpress' ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                     >
                       <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                         <Globe className={`w-6 h-6 ${publishDest === 'wordpress' ? 'text-blue-500' : 'text-white/40'}`} />
                       </div>
                       <h3 className="text-xl font-bold mb-2">Publish to WordPress</h3>
                       <p className="text-sm text-white/40 leading-relaxed font-medium">Export directly to your connected WordPress websites as a draft or live post.</p>
                       {publishDest === 'wordpress' && <motion.div layoutId="dest-active" className="absolute top-6 right-6 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_#3b82f6]" />}
                     </button>
                   </div>

                   {publishDest === 'wordpress' && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-4 overflow-hidden">
                       <div className="glass-card border-blue-500/20 p-8 space-y-6">
                         <div className="space-y-4">
                           <label className="text-[10px] uppercase font-black tracking-widest text-white/40">Select Website</label>
                           {wpSites.length === 0 ? (
                             <div className="p-6 border border-dashed border-white/10 rounded-2xl text-center bg-white/5">
                               <p className="text-sm text-white/40 mb-4 font-medium italic">No websites connected.</p>
                               <p className="text-[10px] text-white/20 mb-4">Visit your WP Connection settings to add a site first.</p>
                             </div>
                           ) : (
                             <div className="grid grid-cols-1 gap-3">
                               {wpSites.map(site => (
                                 <button 
                                   key={site.id}
                                   onClick={() => setSelectedWpSite(site.id)}
                                   className={`flex items-center justify-between p-4 rounded-xl border transition-all ${selectedWpSite === site.id ? 'bg-blue-500/20 border-blue-500' : 'bg-black/20 border-white/5 hover:border-white/20'}`}
                                 >
                                   <div className="flex items-center gap-3">
                                      <Globe className="w-4 h-4 text-blue-400" />
                                      <span className="text-sm font-bold">{site.siteUrl}</span>
                                   </div>
                                   {selectedWpSite === site.id && <Check className="w-4 h-4 text-blue-500" />}
                                 </button>
                               ))}
                             </div>
                           )}
                         </div>

                         {selectedWpSite && (
                           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                             <div className="space-y-4">
                               <label className="text-[10px] uppercase font-black tracking-widest text-white/40">Publication Status</label>
                               <div className="space-y-2">
                                 {[
                                   { id: 'draft', label: 'Save as Draft', desc: 'Edits possible in WP' },
                                   { id: 'publish', label: 'Publish Live', desc: 'Visible to everyone' },
                                   { id: 'future', label: 'Schedule Post', desc: 'Publish at a set time' }
                                 ].map(st => (
                                   <button 
                                     key={st.id}
                                     onClick={() => setWpStatus(st.id as 'publish' | 'draft' | 'future')}
                                     className={`w-full flex flex-col p-4 rounded-xl border transition-all text-left ${wpStatus === st.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-white/5 hover:border-white/10'}`}
                                   >
                                     <span className="text-sm font-bold text-white">{st.label}</span>
                                     <span className="text-[10px] text-white/30">{st.desc}</span>
                                   </button>
                                 ))}
                               </div>
                             </div>

                             <div className="space-y-6">
                               {wpStatus === 'future' && (
                                 <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                   <label className="text-[10px] uppercase font-black tracking-widest text-white/40">Schedule Date/Time</label>
                                   <div className="relative group">
                                     <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-blue-500 transition-colors" />
                                     <input 
                                       type="datetime-local" 
                                       value={scheduledDate}
                                       onChange={e => setScheduledDate(e.target.value)}
                                       className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs text-white/60 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                                     />
                                   </div>
                                 </motion.div>
                               )}

                               <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 text-center">
                                 <Sparkles className="w-6 h-6 text-blue-500 mx-auto mb-3" />
                                 <p className="text-[11px] text-white/40 leading-relaxed font-medium">Auurio will format your Markdown to high-quality WordPress Blocks automatically.</p>
                               </div>
                             </div>
                           </motion.div>
                         )}
                       </div>
                     </motion.div>
                   )}
                 </motion.div>
               )}

               {step === 6 && (
                 <motion.div key="step6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-20 max-w-2xl mx-auto text-center space-y-8">
                   <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto ring-8 ring-green-500/10">
                     <CheckCircle className="w-12 h-12 text-green-500" />
                   </div>
                   <div className="space-y-3">
                     <h2 className="text-4xl font-black uppercase tracking-tight">Mission Accomplished</h2>
                     <p className="text-white/40 leading-relaxed max-w-md mx-auto">Your content has been successfully {publishDest === 'wordpress' ? 'published to WordPress' : 'saved to your library'}.</p>
                   </div>
                   <div className="grid grid-cols-2 gap-4 pt-4">
                     <button onClick={() => window.location.reload()} className="btn-primary py-4 px-8 flex items-center justify-center gap-2">
                       <Plus className="w-4 h-4" /> Write New Post
                     </button>
                     <button onClick={() => window.location.href = '/library'} className="btn-outline py-4 px-8 border-white/10 hover:bg-white/5">
                       View in Library
                     </button>
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
            {step === 1 && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveDraft}
                  disabled={!topic || saveStatus === 'saving'}
                  className="btn-outline py-3 px-6 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-white/10 hover:border-white/20"
                >
                  {saveStatus === 'saved' ? <Check className="w-4 h-4 text-green-500" /> : <Save className="w-4 h-4 text-white/40" />}
                  {saveStatus === 'saved' ? 'Draft Saved' : 'Save Draft'}
                </button>
                <button onClick={handleGenerateOutline} disabled={!topic || loading} className="btn-primary py-3 px-8 flex items-center gap-2">
                  Generate Outline <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {step === 2 && <button onClick={handleGenerateContent} disabled={loading} className="btn-primary py-3 px-8 flex items-center gap-2">Write Full Article <Sparkles className="w-4 h-4" /></button>}
            {step === 3 && <button onClick={handleOptimize} disabled={loading} className="btn-primary py-3 px-8 flex items-center gap-2">AI Optimizer <Search className="w-4 h-4" /></button>}
            {step === 4 && <button onClick={() => setStep(5)} disabled={loading} className="btn-primary py-3 px-8 flex items-center gap-2">Finalize & Publish <ChevronRight className="w-4 h-4" /></button>}
            {step === 5 && (
              <button 
                onClick={publishDest === 'wordpress' ? handleWordPressPublish : handleFinishLocal} 
                disabled={loading || wpPublishLoading || (publishDest === 'wordpress' && !selectedWpSite)} 
                className={`py-3 px-8 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${publishDest === 'wordpress' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20' : 'btn-primary'}`}
              >
                {wpPublishLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {publishDest === 'wordpress' ? 'Launch to WordPress' : 'Commit to Library'}
              </button>
            )}
            {step === 6 && (
              <button onClick={() => window.location.reload()} className="btn-primary py-3 px-8 flex items-center gap-2">
                Start Again <Plus className="w-4 h-4" />
              </button>
            )}
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
