import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, Brain, Globe, Zap, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { signIn } = useAuth();

  return (
    <div className="pt-24">
      {/* Hero Section */}
      <section className="px-6 py-20 lg:py-32 relative overflow-hidden">
        {/* Atmospheric Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-auurio-accent/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-auurio-yellow/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8 border-white/10"
          >
            <Sparkles className="w-4 h-4 text-auurio-yellow" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/80">
              The Future of Content Creation
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl lg:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40"
          >
            Hyper-Personalized <br />
            <span className="text-auurio-accent">AI-Curated</span> Blogs
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg lg:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            ContentLab leverages the full power of the Auurio Ecosystem to synthesize professional, 
            SEO-optimized authority content from your interests in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => signIn()}
              className="btn-primary flex items-center gap-2 text-lg px-8 py-4 w-full sm:w-auto"
            >
              Start Curating
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="btn-outline px-8 py-4 w-full sm:w-auto">
              Explore Auurio Ecosystem
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Brain className="w-6 h-6 text-auurio-accent" />}
              title="Predictive Synthesis"
              description="Our AI doesn't just write; it predicts what your audience wants to read based on real-time ecosystem data."
            />
            <FeatureCard 
              icon={<Globe className="w-6 h-6 text-auurio-yellow" />}
              title="Global Authority"
              description="Establish your brand as an industry leader with content tailored for global search algorithms."
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6 text-orange-400" />}
              title="Unified Ecosystem"
              description="One account, one credit balance. Seamlessly move content between ContentLab, Motion, and Aura."
            />
          </div>
        </div>
      </section>

      {/* Social Proof / Ecosystem */}
      <section className="px-6 py-20">
        <div className="glass-card max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 p-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold mb-4">Unified Auurio Profile</h2>
            <p className="text-white/60 mb-6">
              ContentLab uses the shared Auurio backend. Your credits, history, and preferences stay in sync across the entire ecosystem.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 className="w-4 h-4 text-auurio-accent" />
                Shared Firebase Credits
              </li>
              <li className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 className="w-4 h-4 text-auurio-accent" />
                Centralized User History
              </li>
              <li className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 className="w-4 h-4 text-auurio-accent" />
                Auurio SSO Ready
              </li>
            </ul>
          </div>
          <div className="relative group">
            <div className="absolute inset-0 bg-auurio-accent/20 blur-2xl group-hover:bg-auurio-accent/30 transition-all" />
            <div className="relative glass p-8 rounded-3xl border-white/20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                  <Sparkles className="text-black w-10 h-10" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-xl uppercase tracking-tighter">Auurio</p>
                  <p className="text-[10px] uppercase font-black text-auurio-accent tracking-widest">Active session sync</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="glass-card"
    >
      <div className="mb-6">{icon}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-white/40 leading-relaxed text-sm">
        {description}
      </p>
    </motion.div>
  );
}
