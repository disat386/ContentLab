import React, { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import { ShieldAlert, RefreshCw, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';

export default function App() {
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firebase connection established successfully.");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        } else {
          console.error("Firebase connection test failed:", error);
        }
      }
    };
    testConnection();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <MainContent />
      <Footer />
      <PopupBlockedNotice />
    </div>
  );
}

function MainContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-auurio-accent" />
        </motion.div>
      </div>
    );
  }

  return (
    <main className="flex-1">
      {user ? <Dashboard /> : <LandingPage />}
    </main>
  );
}

function PopupBlockedNotice() {
  const { popupBlocked, signIn } = useAuth();

  return (
    <AnimatePresence>
      {popupBlocked && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 right-6 z-[60] max-w-sm w-full"
        >
          <div className="glass-card border-orange-500/50 bg-orange-500/10 backdrop-blur-2xl p-6 shadow-[0_0_50px_rgba(249,115,22,0.2)]">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-orange-500/20 p-2 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-auurio-accent" />
              </div>
              <div>
                <h4 className="font-bold text-white">Browser Blocked Popup</h4>
                <p className="text-xs text-white/60">
                  Auurio SSO requires a popup window. Please click below to manually sync your session.
                </p>
              </div>
            </div>
            <button
              onClick={() => signIn()}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sync Auurio Session
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
