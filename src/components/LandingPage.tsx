import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Brain, Globe, Zap, CheckCircle2, Shield, MousePointer2, Command } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { signIn } = useAuth();

  return (
    <div className="relative overflow-hidden bg-[#050505]">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Hero Section */}
      <section className="px-6 pt-32 pb-20 lg:pt-48 lg:pb-32 relative">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-12 shadow-[0_0_20px_rgba(255,165,0,0.1)]"
          >
            <div className="w-2 h-2 rounded-full bg-auurio-accent animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Next Gen Content Synthesis v4.0</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <h1 className="text-6xl md:text-[10rem] font-black leading-[0.85] tracking-tighter text-white uppercase italic">
              Create <br />
              <span className="text-auurio-accent not-italic">Authority</span>
            </h1>
            
            <p className="text-xl md:text-3xl text-white/40 font-medium max-w-4xl mx-auto leading-tight tracking-tight">
              Auurio ContentLab transforms your concepts into <span className="text-white">Professional-Grade Artifacts</span>. Powered by semantic intelligence and cinematic visualization.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center gap-6 mt-16"
          >
            <button
              onClick={() => signIn()}
              className="group relative px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl flex items-center gap-3 overflow-hidden transition-all hover:pr-14 active:scale-95"
            >
              <div className="absolute inset-0 bg-auurio-accent translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <span className="relative z-10">Initialize Workspace</span>
              <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-2" />
            </button>
            
            <button className="px-10 py-5 border border-white/10 text-white/60 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/5 transition-all flex items-center gap-2">
              <Command className="w-4 h-4" /> View Showcase
            </button>
          </motion.div>

          {/* Social Proof Logotypes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-32 pt-16 border-t border-white/5 w-full flex flex-col items-center gap-8"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Operational Excellence in 40+ Jurisdictions</div>
            <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-30 invert">
               <div className="h-6 w-32 bg-[url('https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg')] bg-contain bg-no-repeat bg-center grayscale" />
               <div className="h-6 w-32 bg-[url('https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg')] bg-contain bg-no-repeat bg-center grayscale" />
               <div className="h-6 w-32 bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg')] bg-contain bg-no-repeat bg-center grayscale" />
               <div className="h-6 w-32 bg-[url('https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg')] bg-contain bg-no-repeat bg-center grayscale" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Bento */}
      <section className="px-6 py-32 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col items-center gap-4 text-center mb-16">
             <div className="px-4 py-1.5 rounded-full bg-auurio-yellow/10 border border-auurio-yellow/20 text-[9px] font-black text-auurio-yellow uppercase tracking-[0.2em]">Platform Core</div>
             <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic">Built for Scale</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[300px]">
            <BentoCard 
              className="md:col-span-8 md:row-span-2"
              icon={<Brain className="w-8 h-8 text-auurio-accent" />}
              title="Semantic Synthesis Engine"
              description="Auurio CI analyzes real-time authority data to generate content that doesn't just rank—it dominates. Our model understands intent, nuance, and brand voice parity."
              tag="Proprietary AI"
              color="bg-auurio-accent"
            />
            <BentoCard 
              className="md:col-span-4"
              icon={<Zap className="w-8 h-8 text-auurio-yellow" />}
              title="Instant Deployment"
              description="Direct-to-CMS integration including WordPress, Ghost, and Webflow."
              tag="Real-time"
              color="bg-auurio-yellow"
            />
            <BentoCard 
              className="md:col-span-4"
              icon={<Globe className="w-8 h-8 text-blue-400" />}
              title="Global SEO"
              description="Multi-jurisdictional optimization for international search visibility."
              tag="Worldwide"
              color="bg-blue-500"
            />
            <BentoCard 
              className="md:col-span-6"
              icon={<Shield className="w-8 h-8 text-green-400" />}
              title="Copyright Shield"
              description="Advanced plagiarism protection and ethical AI fingerprinting for every output."
              tag="Security"
              color="bg-green-500"
            />
            <BentoCard 
              className="md:col-span-6"
              icon={<MousePointer2 className="w-8 h-8 text-purple-400" />}
              title="Interactive Editor"
              description="Seamless side-by-side editing with real-time AI suggestions and structural feedback."
              tag="Creative UX"
              color="bg-purple-500"
            />
          </div>
        </div>
      </section>

      {/* Unified Profile CTA */}
      <section className="px-6 py-32 overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-auurio-accent/5 blur-[160px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto rounded-[3rem] border border-white/10 bg-black/40 backdrop-blur-2xl p-12 md:p-24 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8">
             <Command className="w-12 h-12 text-white/5 group-hover:text-auurio-accent/20 transition-colors" />
          </div>
          
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-7xl font-black text-white mb-8 leading-[0.9] tracking-tighter uppercase">One Ecosystem, Infinite Content.</h2>
            <p className="text-lg text-white/40 mb-12 font-medium leading-relaxed">
              Your ContentLab workspace is integrated into the Auurio Hub. Share credits, voice profiles, and data assets across the entire suite of professional tools.
            </p>
            
            <div className="flex flex-wrap gap-4">
               {[
                 'Auurio SSO', 'Unified Credits', 'Asset Registry', 'Team Governance'
               ].map(benefit => (
                 <div key={benefit} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white/60 tracking-widest">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {benefit}
                 </div>
               ))}
            </div>

            <button onClick={() => signIn()} className="mt-16 px-12 py-6 bg-auurio-accent text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-white transition-all shadow-[0_20px_50px_rgba(255,165,0,0.2)] active:scale-95">
              Access Private Beta
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function BentoCard({ className, icon, title, description, tag, color }: { className: string, icon: React.ReactNode, title: string, description: string, tag: string, color: string }) {
  return (
    <motion.div
      whileHover={{ scale: 0.99 }}
      className={`relative p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 overflow-hidden group flex flex-col justify-end ${className}`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${color}/10 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="absolute top-8 right-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">{tag}</div>
      
      <div className="space-y-4 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
           {icon}
        </div>
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight uppercase mb-2">{title}</h3>
          <p className="text-sm text-white/40 leading-relaxed font-medium line-clamp-3 group-hover:line-clamp-none transition-all duration-500">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
