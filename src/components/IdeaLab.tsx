import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateIdeas } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Award, Loader2, Bookmark, Check } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Idea {
  Title: string;
  BriefExplanation: string;
  Tag: string;
  ContentScore: string | number;
  SearchIntent: string;
  TargetKeyword: string;
}

export default function IdeaLab({ onSelectTopic }: { onSelectTopic: (topic: string) => void }) {
  const { user } = useAuth();
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('Traffic');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    if (!niche) return;
    setLoading(true);
    try {
      const result = await generateIdeas(niche, audience || 'General', goal);
      setIdeas(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveToLibrary = async (idea: Idea, index: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'library'), {
        userId: user.uid,
        title: idea.Title,
        content: `**Overview:** ${idea.BriefExplanation}\n\n**Tag:** ${idea.Tag}\n**Search Intent:** ${idea.SearchIntent}\n**Target Keyword:** ${idea.TargetKeyword}`,
        type: 'idea',
        status: 'saved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSavedIdeas(prev => new Set(prev).add(index));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="glass-card">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-auurio-yellow" />
          Idea Generation Engine
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Niche / Topic</label>
            <input
              type="text"
              placeholder="e.g. Sustainable Living"
              value={niche}
              onChange={e => setNiche(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-auurio-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Audience</label>
            <input
              type="text"
              placeholder="e.g. Eco-conscious Gen Z"
              value={audience}
              onChange={e => setAudience(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-auurio-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Content Goal</label>
            <select
              value={goal}
              onChange={e => setGoal(e.target.value)}
              className="custom-select"
            >
              <option>Traffic</option>
              <option>Sales</option>
              <option>Awareness</option>
              <option>Education</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !niche}
          className="mt-8 btn-primary w-full py-4 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          Generate 10 Viral Ideas
        </button>
      </div>

      {ideas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {ideas.map((idea, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card hover:border-auurio-accent/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-auurio-accent/10 px-3 py-1 rounded-full border border-auurio-accent/20">
                    <span className="text-[10px] font-black uppercase text-auurio-accent tracking-widest">
                      {idea.Tag}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    <Award className="w-3 h-3 text-auurio-yellow" />
                    Score: {idea.ContentScore}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-auurio-accent transition-colors">
                  {idea.Title}
                </h3>
                <p className="text-sm text-white/60 mb-6 leading-relaxed">
                  {idea.BriefExplanation}
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-white/20">Intent</span>
                      <span className="text-xs font-semibold text-auurio-yellow">{idea.SearchIntent}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-white/20">Keyword</span>
                      <span className="text-xs font-semibold text-white/80">{idea.TargetKeyword}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => saveToLibrary(idea, i)}
                      disabled={savedIdeas.has(i)}
                      className={`p-2 rounded-full border border-white/5 glass transition-all ${savedIdeas.has(i) ? 'text-green-500 border-green-500/30' : 'text-white/20 hover:text-white hover:border-white/30'}`}
                    >
                      {savedIdeas.has(i) ? <Check className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => onSelectTopic(idea.Title)}
                      className="p-2 bg-white/5 rounded-full hover:bg-auurio-accent text-white transition-all transform hover:scale-110 active:scale-95"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
