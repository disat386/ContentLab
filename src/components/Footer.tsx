import React from 'react';

export default function Footer() {
  return (
    <footer className="py-12 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <p className="text-sm text-white/40">
            &copy; 2026 ContentLab. All rights reserved.
          </p>
          <p className="text-xs text-auurio-accent font-semibold uppercase tracking-widest mt-1">
            Part of the Auurio Ecosystem-
          </p>
        </div>

        <div className="flex items-center gap-8">
          <a
            href="https://auurio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            Auurio Portal
          </a>
          <a
            href="#"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            Privacy
          </a>
          <a
            href="#"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
