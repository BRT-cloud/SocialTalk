import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show our custom UI
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, so clear it
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
    // Optionally save to session storage so it doesn't show again in same session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if dismissed in this session
  useEffect(() => {
    if (sessionStorage.getItem('pwa-prompt-dismissed') === 'true') {
      setShowPrompt(false);
    }
  }, []);

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-6 right-6 md:left-auto md:right-8 md:bottom-8 md:w-96 z-[100]"
        >
          <div className="bg-[#0f0f19] border border-[#00F2FF]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,242,255,0.2)] backdrop-blur-xl relative">
            <button 
              onClick={handleClose}
              className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#00F2FF] to-[#7000FF] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                S
              </div>
              <div>
                <h3 className="text-white font-bold leading-none">소셜톡 앱 설치</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono">홈 화면에 추가하여 더 빠르게 접속하세요</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              설치하시면 주소창 없이 앱처럼 깔끔하게 소셜톡을 즐기실 수 있습니다. 오프라인에서도 기본 기능을 이용할 수 있어요!
            </p>

            <button
              onClick={handleInstall}
              className="w-full cyber-button-primary py-3 flex items-center justify-center gap-2 group shung-animation"
            >
              <Download size={18} className="group-hover:bounce-y" />
              <span>앱 설치하기</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
