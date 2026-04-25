import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Edit3, 
  Share2, 
  Library as LibraryIcon, 
  User,
  Star,
  Plus,
  Zap,
  Wrench
} from 'lucide-react';
import IdeaLab from './IdeaLab';
import BlogWriter from './BlogWriter';
import Repurposer from './Repurposer';
import Library from './Library';
import BrandVoiceManager from './BrandVoiceManager';
import ToolsHub from './ToolsHub';

type Tab = 'idea' | 'writer' | 'repurpose' | 'library' | 'voice' | 'tools';

export default function Dashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('idea');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const handleSelectTopic = (topic: string) => {
    setSelectedTopic(topic);
    setActiveTab('writer');
  };

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen flex flex-col">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 mb-8 w-fit overflow-x-auto no-scrollbar">
        <TabButton 
          active={activeTab === 'idea'} 
          onClick={() => { setActiveTab('idea'); setSelectedTopic(null); }} 
          icon={<Sparkles className="w-4 h-4" />} 
          label="Idea Lab" 
        />
        <TabButton 
          active={activeTab === 'writer'} 
          onClick={() => setActiveTab('writer')} 
          icon={<Edit3 className="w-4 h-4" />} 
          label="AI Writer" 
        />
        <TabButton 
          active={activeTab === 'repurpose'} 
          onClick={() => setActiveTab('repurpose')} 
          icon={<Share2 className="w-4 h-4" />} 
          label="Repurposer" 
        />
        <TabButton 
          active={activeTab === 'tools'} 
          onClick={() => setActiveTab('tools')} 
          icon={<Wrench className="w-4 h-4" />} 
          label="Advanced Tools" 
        />
        <div className="w-[1px] h-6 bg-white/10 mx-2" />
        <TabButton 
          active={activeTab === 'library'} 
          onClick={() => setActiveTab('library')} 
          icon={<LibraryIcon className="w-4 h-4" />} 
          label="Library" 
        />
        <TabButton 
          active={activeTab === 'voice'} 
          onClick={() => setActiveTab('voice')} 
          icon={<User className="w-4 h-4" />} 
          label="Brand Voice" 
        />
        <div className="w-[1px] h-6 bg-white/10 mx-2" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-auurio-yellow/10 border border-auurio-yellow/20">
          <Zap className="w-4 h-4 text-auurio-yellow" />
          <span className="text-xs font-black text-auurio-yellow">{profile?.credits || 0} Credits</span>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'idea' && (
            <motion.div key="idea" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <IdeaLab onSelectTopic={handleSelectTopic} />
            </motion.div>
          )}
          {activeTab === 'writer' && (
            <motion.div key="writer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BlogWriter initialTopic={selectedTopic || undefined} />
            </motion.div>
          )}
          {activeTab === 'repurpose' && (
            <motion.div key="repurpose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Repurposer />
            </motion.div>
          )}
          {activeTab === 'library' && (
            <motion.div key="library" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Library />
            </motion.div>
          )}
          {activeTab === 'voice' && (
            <motion.div key="voice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BrandVoiceManager />
            </motion.div>
          )}
          {activeTab === 'tools' && (
            <motion.div key="tools" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ToolsHub />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Action Floating Bar (Optional Concept) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <div className="glass-card !p-2 flex items-center gap-2 rounded-full border-auurio-accent/20 shadow-2xl shadow-orange-500/10">
          <div className="flex -space-x-2 mr-2 ml-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-auurio-black bg-white/10 overflow-hidden flex items-center justify-center">
                <Star className="w-3 h-3 text-auurio-yellow fill-auurio-yellow" />
              </div>
            ))}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mr-4">Pro Active</span>
          <button 
            onClick={() => { setActiveTab('writer'); setSelectedTopic(null); }}
            className="bg-auurio-accent hover:bg-orange-600 p-3 rounded-full text-black transition-all transform hover:scale-110 active:scale-95"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm tracking-tight whitespace-nowrap ${active ? 'bg-auurio-accent text-black shadow-lg shadow-orange-500/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
    >
      {icon}
      {label}
    </button>
  );
}
