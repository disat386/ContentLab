import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { repurposeContent, generateImagePrompts } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Linkedin, 
  Twitter, 
  Mail, 
  Instagram, 
  Share2, 
  Copy, 
  Check, 
  Loader2,
  Sparkles,
  Camera,
  Palette,
  Users
} from 'lucide-react';
import { addDoc, collection, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface Voice {
  id: string;
  name: string;
  tone: string;
  audience: string;
  style: string;
}

export default function Repurposer() {
  const { user } = useAuth();
  const [sourceContent, setSourceContent] = useState('');
  const [repurposedItems, setRepurposedItems] = useState<{ [key: string]: string }>({});
  const [imagePrompts, setImagePrompts] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('Default');

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

  const handleRepurpose = async (platform: string) => {
    if (!sourceContent) return;
    setLoading(prev => ({ ...prev, [platform]: true }));
    try {
      const voice = voices.find(v => v.id === selectedVoice);
      const result = await repurposeContent(sourceContent, platform, voice);
      setRepurposedItems(prev => ({ ...prev, [platform]: result }));
      
      // Save repurposed content to library
      const libraryPath = 'library';
      try {
        await addDoc(collection(db, libraryPath), {
          userId: user!.uid,
          title: `Repurposed for ${platform}`,
          content: result,
          type: 'repurposed',
          status: 'draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, libraryPath);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleGenerateImagePrompts = async () => {
    if (!sourceContent) return;
    setLoading(prev => ({ ...prev, images: true }));
    try {
      const result = await generateImagePrompts("Article Visuals", sourceContent.substring(0, 1000));
      setImagePrompts(result.join('\n\n'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, images: false }));
    }
  };

  const handleCopy = (key: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Source Input */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-auurio-yellow" />
            <h2 className="text-lg font-bold">Brand Voice</h2>
          </div>
          <select
            value={selectedVoice}
            onChange={e => setSelectedVoice(e.target.value)}
            className="custom-select"
          >
            <option value="Default">Default Professional</option>
            {voices.map(voice => (
              <option key={voice.id} value={voice.id}>{voice.name}</option>
            ))}
          </select>
        </div>

        <div className="glass-card flex flex-col h-full">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-auurio-accent" />
            <h2 className="text-xl font-bold">Content Input</h2>
          </div>
          <p className="text-sm text-white/40 mb-4">Paste your blog post, article, or notes to transform them into social assets.</p>
          <textarea
            value={sourceContent}
            onChange={e => setSourceContent(e.target.value)}
            placeholder="Paste source content here..."
            className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm focus:outline-none focus:border-auurio-accent resize-none min-h-[400px] custom-scrollbar"
          />
          <div className="mt-6 flex gap-4">
            <button 
              onClick={handleGenerateImagePrompts}
              disabled={!sourceContent || loading.images}
              className="btn-outline flex-1 py-3 flex items-center justify-center gap-2"
            >
              {loading.images ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Generate Visual Prompts
            </button>
          </div>
        </div>
      </div>

      {/* Repurposed Outputs */}
      <div className="lg:col-span-7 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
           <PlatformBtn icon={<Linkedin />} label="LinkedIn" active={!!repurposedItems.LinkedIn} onClick={() => handleRepurpose('LinkedIn')} loading={loading.LinkedIn} />
           <PlatformBtn icon={<Twitter />} label="Twitter/X" active={!!repurposedItems.Twitter} onClick={() => handleRepurpose('Twitter')} loading={loading.Twitter} />
           <PlatformBtn icon={<Instagram />} label="Social" active={!!repurposedItems.Social} onClick={() => handleRepurpose('Social')} loading={loading.Social} />
           <PlatformBtn icon={<Mail />} label="Newsletter" active={!!repurposedItems.Newsletter} onClick={() => handleRepurpose('Newsletter')} loading={loading.Newsletter} />
        </div>

        <div className="space-y-6">
          <AnimatePresence>
            {imagePrompts && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card border-auurio-yellow/30 bg-auurio-yellow/5">
                <h3 className="font-bold flex items-center gap-2 mb-4 text-auurio-yellow">
                  <Palette className="w-4 h-4" />
                  Visual System Prompts
                </h3>
                <div className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed font-mono">
                  {imagePrompts}
                </div>
                <button 
                  onClick={() => handleCopy('prompts', imagePrompts)}
                  className="mt-4 text-[10px] uppercase font-black tracking-widest flex items-center gap-1 hover:text-auurio-yellow"
                >
                  {copied === 'prompts' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Copy Master Prompts
                </button>
              </motion.div>
            )}

            {Object.entries(repurposedItems).map(([platform, content]) => (
              <motion.div
                key={platform}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-auurio-accent" />
                    {platform} Edition
                  </h3>
                  <button 
                    onClick={() => handleCopy(platform, content)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                  >
                    {copied === platform ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-sm text-white/60 leading-relaxed">
                  {content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {Object.keys(repurposedItems).length === 0 && !imagePrompts && (
            <div className="h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
              <Sparkles className="w-12 h-12 mb-4" />
              <p>Select a platform above to start repurposing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformBtn({ icon, label, active, onClick, loading }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex flex-col items-center gap-3 p-4 rounded-2xl glass transition-all border border-white/5 hover:border-auurio-accent/30 ${active ? 'bg-auurio-accent/10 border-auurio-accent/40' : ''}`}
    >
      <div className={`p-2 rounded-xl ${active ? 'bg-auurio-accent text-black' : 'bg-white/5 text-white/60'}`}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
