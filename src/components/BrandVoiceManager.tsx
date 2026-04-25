import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  User, 
  Target, 
  MessageSquare,
  Edit3
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface VoiceData {
  id: string;
  name: string;
  tone: string;
  audience: string;
  style: string;
}

export default function BrandVoiceManager() {
  const { user } = useAuth();
  const [voices, setVoices] = useState<VoiceData[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTone, setNewTone] = useState('Professional');
  const [newAudience, setNewAudience] = useState('');
  const [newStyle, setNewStyle] = useState('');

  React.useEffect(() => {
    if (!user) return;
    const path = 'brandVoices';
    const q = query(collection(db, path), where('userId', 'in', [user.uid, user.email || '']));
    const unsub = onSnapshot(q, (snap) => {
      setVoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as VoiceData)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsub();
  }, [user]);

  const handleSave = async () => {
    if (!user || !newName) return;
    const path = 'brandVoices';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        name: newName,
        tone: newTone,
        audience: newAudience,
        style: newStyle,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string) => {
    const path = `brandVoices/${id}`;
    try {
      await deleteDoc(doc(db, 'brandVoices', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Brand Voices</h2>
          <p className="text-sm text-white/40">Keep your AI writing consistent across all channels.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary py-2 px-4 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Voice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card border-auurio-accent/50"
            >
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-auurio-accent" />
                New Voice Profile
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Brand Name (e.g. Master Voice)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-auurio-accent"
                />
                <select
                  value={newTone}
                  onChange={e => setNewTone(e.target.value)}
                  className="custom-select"
                >
                  <option>Professional</option>
                  <option>Conversational</option>
                  <option>Witty</option>
                  <option>Technical</option>
                  <option>Persuasive</option>
                  <option>Authoritative</option>
                </select>
                <input
                  type="text"
                  placeholder="Target Audience"
                  value={newAudience}
                  onChange={e => setNewAudience(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-auurio-accent"
                />
                <textarea
                  placeholder="Special style instructions..."
                  value={newStyle}
                  onChange={e => setNewStyle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-auurio-accent min-h-[80px]"
                />
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSave} className="flex-1 btn-primary py-2 text-sm">Save</button>
                  <button onClick={() => setIsAdding(false)} className="px-3 btn-outline py-2 text-sm">Cancel</button>
                </div>
              </div>
            </motion.div>
          )}

          {voices.map((voice) => (
            <motion.div
              key={voice.id}
              layout
              className="glass-card relative group"
            >
              <button 
                onClick={() => handleDelete(voice.id)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-red-500/20 text-white/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-lg mb-4 text-auurio-accent">{voice.name}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-tighter w-16">Tone:</span>
                  <span className="text-white">{voice.tone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Target className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-tighter w-16">Audience:</span>
                  <span className="text-white">{voice.audience}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {voices.length === 0 && !isAdding && (
          <div className="md:col-span-2 lg:col-span-3 h-48 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
            <User className="w-12 h-12 mb-4" />
            <p>No brand voices created. Define your writing style to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}
