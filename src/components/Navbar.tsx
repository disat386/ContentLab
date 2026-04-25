import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, LogOut, Wallet, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function Navbar() {
  const { user, profile, signIn, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ rotate: -20, scale: 0.5 }}
            animate={{ rotate: 0, scale: 1 }}
            className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20"
          >
            <Sparkles className="text-black w-6 h-6" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Content<span className="text-auurio-accent">Lab</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              by Auurio Ecosystem
            </p>
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center text-center">
          <h2 className="text-sm font-black text-white/90 uppercase tracking-widest animate-pulse">
            This application is still under construction
          </h2>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-tight">
            You can try if it works, then please share feedback on the <span className="text-auurio-accent">Auurio Hub</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2 glass px-3 py-1.5 rounded-full border-white/10">
                <Wallet className="w-4 h-4 text-auurio-yellow" />
                <span className="text-sm font-medium text-white/90">
                  {profile?.credits ?? '...'} Credits
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Avatar" />
              </div>
            </>
          ) : (
            <button
              onClick={() => signIn()}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
