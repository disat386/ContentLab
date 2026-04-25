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
  Wrench,
  Globe,
  Layers
} from 'lucide-react';
import IdeaLab from './IdeaLab';
import BlogWriter from './BlogWriter';
import Repurposer from './Repurposer';
import Library from './Library';
import BrandVoiceManager from './BrandVoiceManager';
import ToolsHub from './ToolsHub';
import WPConnection from './WPConnection';
import BulkWriter from './BulkWriter';

type Tab = 'idea' | 'writer' | 'bulk' | 'repurpose' | 'library' | 'voice' | 'tools' | 'wordpress';

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
      <div className="flex flex-col gap-4 mb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-auurio-accent/10 border border-auurio-accent/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-auurio-accent" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Workspace</h2>
              <p className="text-[10px] text-white/30 font-bold uppercase">Control Center v3.5</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
            <Zap className="w-4 h-4 text-auurio-yellow animate-pulse" />
            <span className="text-xs font-black text-white">{profile?.credits || 0} <span className="text-white/40">CREDITS</span></span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-xl p-1.5 rounded-3xl border border-white/5 w-fit overflow-x-auto no-scrollbar shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
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
            active={activeTab === 'bulk'} 
            onClick={() => setActiveTab('bulk')} 
            icon={<Layers className="w-4 h-4" />} 
            label="Bulk Writer" 
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
          <div className="w-[1px] h-6 bg-white/5 mx-2" />
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
          <TabButton 
            active={activeTab === 'wordpress'} 
            onClick={() => setActiveTab('wordpress')} 
            icon={<Globe className="w-4 h-4" />} 
            label="WordPress" 
          />
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
          {activeTab === 'bulk' && (
            <motion.div key="bulk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BulkWriter />
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
          {activeTab === 'wordpress' && (
            <motion.div key="wordpress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto py-8">
              <WPConnection />
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
