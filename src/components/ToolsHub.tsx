import React, { useState } from 'react';
import { 
  Wrench, 
  Search, 
  Mail, 
  ShoppingBag, 
  Tags, 
  Type, 
  ListOrdered, 
  Minimize2, 
  Eraser, 
  Dna, 
  Map, 
  MessageSquare, 
  Video, 
  BookOpen, 
  FileCode,
  Loader2,
  Copy,
  Check,
  Download,
  Layers
} from 'lucide-react';
import { runSpecializedTool, ToolId } from '../lib/gemini';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { downloadMarkdown } from '../lib/download';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';

interface ToolSchema {
  id: ToolId;
  name: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
}

const TOOLS: ToolSchema[] = [
  { id: 'HeadlineAnalyzer', name: 'Headline Analyzer', description: 'Optimize for CTR and authority.', icon: <Search className="w-5 h-5" />, placeholder: 'Enter your headline ideas...' },
  { id: 'FAQGenerator', name: 'FAQ Generator', description: 'Generate authoritative Q&A.', icon: <MessageSquare className="w-5 h-5" />, placeholder: 'Enter article text for FAQs...' },
  { id: 'NewsletterGen', name: 'Newsletter Builder', description: 'Convert articles to email.', icon: <Mail className="w-5 h-5" />, placeholder: 'Paste your blog post content here...' },
  { id: 'ProductDesc', name: 'Product Narrator', description: 'Benefit-driven descriptions.', icon: <ShoppingBag className="w-5 h-5" />, placeholder: 'Enter product features or name...' },
  { id: 'MetaTags', name: 'SEO Meta Master', description: 'Harden your search presence.', icon: <Tags className="w-5 h-5" />, placeholder: 'Enter topic and main keywords...' },
  { id: 'IntroGen', name: 'Hook Generator', description: 'Stop the scroll instantly.', icon: <Type className="w-5 h-5" />, placeholder: 'Enter your article topic...' },
  { id: 'Outlining', name: 'Logic Outliner', description: 'Structural blueprinting.', icon: <ListOrdered className="w-5 h-5" />, placeholder: 'Enter complex topic or theme...' },
  { id: 'Summarizer', name: 'Exec Summarizer', description: 'Extract core significance.', icon: <Minimize2 className="w-5 h-5" />, placeholder: 'Paste long-form content...' },
  { id: 'GrammarFix', name: 'Authority Polish', description: 'Refine tone and flow.', icon: <Eraser className="w-5 h-5" />, placeholder: 'Paste text to polish...' },
  { id: 'ContentGap', name: 'Gap Analyzer', description: 'Find what others missed.', icon: <Dna className="w-5 h-5" />, placeholder: 'Enter a niche or topic...' },
  { id: 'AuthorityMap', name: 'Authority Mapper', description: 'Pillar & Cluster planning.', icon: <Map className="w-5 h-5" />, placeholder: 'Enter your core topic...' },
  { id: 'QuoraAnswer', name: 'Social Authority', description: 'Expert-level Q&A answers.', icon: <MessageSquare className="w-5 h-5" />, placeholder: 'Enter the question to answer...' },
  { id: 'VideoScript', name: 'Script Assistant', description: 'Text to Video scripts.', icon: <Video className="w-5 h-5" />, placeholder: 'Paste article for script...' },
  { id: 'CaseStudy', name: 'Case Study Architect', description: 'P-S-R structure template.', icon: <BookOpen className="w-5 h-5" />, placeholder: 'Enter client results/data...' },
  { id: 'WhitepaperBody', name: 'Whitepaper Engine', description: 'High-level industry data.', icon: <FileCode className="w-5 h-5" />, placeholder: 'Enter technical theme...' },
  { id: 'ExplainerGen', name: 'Bulk Production', description: 'Cluster-based article factory.', icon: <Layers className="w-5 h-5" />, placeholder: 'Access via Bulk Writer tab for full features.' },
];

export default function ToolsHub() {
  const { user } = useAuth();
  const [selectedTool, setSelectedTool] = useState<ToolSchema | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunTool = async () => {
    if (!selectedTool || !input || !user) return;
    setLoading(true);
    setError(null);
    try {
      // Deduct credit
      try {
        await updateDoc(doc(db, 'users', user.uid), { credits: increment(-1) });
      } catch (err) {
        console.warn("Credit deduction failed:", err);
      }

      const res = await runSpecializedTool(selectedTool.id, input);
      setResult(res);

      // Save to library
      const libraryPath = 'library';
      try {
        await addDoc(collection(db, libraryPath), {
          userId: user.uid,
          title: `Tool: ${selectedTool.name}`,
          content: res,
          type: 'tool-output',
          status: 'saved',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, libraryPath);
      }
    } catch (err) {
      console.error(err);
      setError('Operation failed. Please check your credits.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {!selectedTool ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((tool) => (
            <motion.button
              key={tool.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTool(tool)}
              className="glass-card group flex items-start gap-4 text-left hover:border-auurio-accent/50 transition-all cursor-pointer"
            >
              <div className="p-3 bg-white/5 rounded-xl group-hover:bg-auurio-accent/20 text-white/60 group-hover:text-auurio-accent transition-colors">
                {tool.icon}
              </div>
              <div>
                <h3 className="font-bold text-white group-hover:text-auurio-accent transition-colors">{tool.name}</h3>
                <p className="text-xs text-white/40 mt-1">{tool.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <button 
            onClick={() => { setSelectedTool(null); setResult(null); setInput(''); }}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
          >
            ← Back to Tools
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-auurio-accent/20 rounded-lg text-auurio-accent">
                    {selectedTool.icon}
                  </div>
                  <h2 className="text-xl font-bold">{selectedTool.name}</h2>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={selectedTool.placeholder}
                  className="w-full h-64 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-auurio-accent transition-colors resize-none placeholder:text-white/20"
                />
                <button
                  onClick={handleRunTool}
                  disabled={loading || !input}
                  className="w-full mt-6 btn-primary py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wrench className="w-5 h-5" />}
                  {loading ? 'Processing...' : `Run ${selectedTool.name}`}
                </button>
                {error && <p className="text-red-500 text-xs mt-4 text-center">{error}</p>}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="glass-card h-full min-h-[400px]">
                {!result && !loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                    <Loader2 className="w-12 h-12 opacity-5" />
                    <p className="text-sm font-medium">Output will appear here...</p>
                  </div>
                ) : loading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-auurio-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-white/40">AI is architecting your content...</p>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-auurio-accent">Generated Content</h3>
                      <div className="flex gap-2">
                        <button onClick={() => downloadMarkdown(selectedTool.name, result!)} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={handleCopy} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-invert prose-orange max-w-none flex-1 overflow-y-auto custom-scrollbar pr-4">
                      <ReactMarkdown>{result!}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
