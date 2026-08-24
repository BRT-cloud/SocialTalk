import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { UserProfile, Scenario } from './types';
import { INITIAL_SCENARIOS, DEFAULT_UNLOCKED_STAGE_COUNT } from './constants';
import WorldMap from './components/WorldMap';
import Chatbot from './components/Chatbot';
import Dashboard from './components/Dashboard';
import Missions from './components/Missions';
import Store from './components/Store';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { Layout, Map as MapIcon, BarChart3, Target, LogOut, ShieldCheck, Sparkles, ShoppingCart, User as UserIcon, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from './hooks/useSound';

import { initializeDatabase } from './initData';

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'map' | 'chat' | 'dashboard' | 'missions' | 'store' | 'admin'>('map');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>(INITIAL_SCENARIOS);
  const [isScenariosLoaded, setIsScenariosLoaded] = useState(false);
  const { playSound } = useSound();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginNickname, setLoginNickname] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Load profile from Firestore (with LocalStorage offline backup)
  const loadProfile = async (name: string) => {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 10000)
    );

    const loadTask = async () => {
      const isAdmin = name === 'admin' || name === 'GM' || name === '관리자접속';
      const allStageIds = scenarios.map(s => s.id);

      const defaultProfile: UserProfile = {
        uid: name,
        displayName: name,
        email: '',
        exp: 0,
        wisdom: 0,
        level: 1,
        badges: [],
        role: isAdmin ? 'admin' : 'student',
        stats: { cognitive: 0, emotional: 0, behavioral: 0 },
        clearedWorlds: [],
        unlockedStages: isAdmin ? allStageIds : Array.from({ length: DEFAULT_UNLOCKED_STAGE_COUNT }, (_, i) => `stage-${i + 1}`),
        clearedStages: isAdmin ? allStageIds : [],
        competenceIndex: 0,
        schoolpingCompleted: [],
        inventory: { magnifier: 0, mirror: 0, hourglass: 0, advice: 0 }
      };

      try {
        const docRef = doc(db, 'users', name);
        const docSnap = await getDoc(docRef);
        let finalProfile = defaultProfile;
        
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          if (isAdmin) {
            finalProfile = {
              ...defaultProfile,
              ...data,
              role: 'admin',
              unlockedStages: allStageIds,
              clearedStages: allStageIds,
              inventory: { ...defaultProfile.inventory, ...(data.inventory || {}) }
            };
            // Auto-update DB for admin to ensure all stages are unlocked
            updateDoc(docRef, {
              role: 'admin',
              unlockedStages: allStageIds,
              clearedStages: allStageIds
            }).catch(e => console.error("Failed to auto-unlock admin stages", e));
          } else {
            // Load saved local profile to compare progress
            const savedRaw = localStorage.getItem(`socialtalk_profile_${name}`);
            let savedLocalProfile: UserProfile | null = null;
            if (savedRaw) {
              try {
                savedLocalProfile = JSON.parse(savedRaw);
              } catch (_) {}
            }

            // We merge the unlocked/cleared stages, choosing whichever has MORE progress!
            const cloudUnlocked = data.unlockedStages || [];
            const localUnlocked = savedLocalProfile?.unlockedStages || [];
            const defaultStages = Array.from({ length: DEFAULT_UNLOCKED_STAGE_COUNT }, (_, i) => `stage-${i + 1}`);
            const mergedUnlocked = Array.from(new Set([...defaultStages, ...cloudUnlocked, ...localUnlocked]));

            // Check if Firestore DB needs an update to make sure all default stages are unlocked
            const hasAllDefaultStages = defaultStages.every(id => cloudUnlocked.includes(id));
            if (!hasAllDefaultStages) {
              updateDoc(docRef, {
                unlockedStages: mergedUnlocked
              }).catch(e => console.error("Failed to sync default unlocked stages to Firestore", e));
            }

            const cloudCleared = data.clearedStages || [];
            const localCleared = savedLocalProfile?.clearedStages || [];
            const mergedCleared = Array.from(new Set([...cloudCleared, ...localCleared]));

            // Ensure we choose the maximum XP / wisdom/ level as well
            const maxExp = Math.max(data.exp || 0, savedLocalProfile?.exp || 0);
            const maxWisdom = Math.max(data.wisdom || 0, savedLocalProfile?.wisdom || 0);
            const maxLevel = Math.max(data.level || 1, savedLocalProfile?.level || 1);
            const maxCompetence = Math.max(data.competenceIndex || 0, savedLocalProfile?.competenceIndex || 0);

            // Merge of badges and clearedWorlds
            const mergedBadges = Array.from(new Set([...(data.badges || []), ...(savedLocalProfile?.badges || [])]));
            const mergedClearedWorlds = Array.from(new Set([...(data.clearedWorlds || []), ...(savedLocalProfile?.clearedWorlds || [])]));

            finalProfile = {
              ...defaultProfile,
              ...data,
              exp: maxExp,
              wisdom: maxWisdom,
              level: maxLevel,
              competenceIndex: maxCompetence,
              unlockedStages: mergedUnlocked,
              clearedStages: mergedCleared,
              badges: mergedBadges,
              clearedWorlds: mergedClearedWorlds,
              stats: {
                cognitive: Math.max(data.stats?.cognitive || 0, savedLocalProfile?.stats?.cognitive || 0),
                emotional: Math.max(data.stats?.emotional || 0, savedLocalProfile?.stats?.emotional || 0),
                behavioral: Math.max(data.stats?.behavioral || 0, savedLocalProfile?.stats?.behavioral || 0),
              },
              inventory: { 
                magnifier: Math.max(data.inventory?.magnifier || 0, savedLocalProfile?.inventory?.magnifier || 0),
                mirror: Math.max(data.inventory?.mirror || 0, savedLocalProfile?.inventory?.mirror || 0),
                hourglass: Math.max(data.inventory?.hourglass || 0, savedLocalProfile?.inventory?.hourglass || 0),
                advice: Math.max(data.inventory?.advice || 0, savedLocalProfile?.inventory?.advice || 0),
              }
            };
          }
        } else {
          // New user setup - double check if there's any existing local data first
          const savedRaw = localStorage.getItem(`socialtalk_profile_${name}`);
          if (savedRaw) {
            try {
              const parsed = JSON.parse(savedRaw);
              const defaultStages = Array.from({ length: DEFAULT_UNLOCKED_STAGE_COUNT }, (_, i) => `stage-${i + 1}`);
              const mergedUnlocked = Array.from(new Set([...defaultStages, ...(parsed.unlockedStages || [])]));
              finalProfile = { ...parsed, unlockedStages: mergedUnlocked };
              // Save to Firestore to sync
              setDoc(docRef, finalProfile).catch(e => console.error("Failed to sync offline user profile to database", e));
            } catch (_) {
              setDoc(docRef, defaultProfile).catch(e => console.error("Failed to create new user profile", e));
              finalProfile = defaultProfile;
            }
          } else {
            setDoc(docRef, defaultProfile).catch(e => console.error("Failed to create new user profile", e));
            finalProfile = defaultProfile;
          }
        }
        
        if (isAdmin) {
          initializeDatabase().catch(e => console.error("Failed to initialize database", e));
        }
        
        localStorage.setItem(`socialtalk_profile_${name}`, JSON.stringify(finalProfile));
        setProfile(finalProfile);
        return true;
      } catch (error: any) {
        console.error("Firestore loading error:", error);
        setAuthError(`DB 연결 에러: ${error?.message || String(error)}`);
        const saved = localStorage.getItem(`socialtalk_profile_${name}`);
        const defaultStages = Array.from({ length: DEFAULT_UNLOCKED_STAGE_COUNT }, (_, i) => `stage-${i + 1}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const mergedUnlocked = Array.from(new Set([...defaultStages, ...(parsed.unlockedStages || [])]));
            const restoredProfile = { ...parsed, unlockedStages: mergedUnlocked };
            localStorage.setItem(`socialtalk_profile_${name}`, JSON.stringify(restoredProfile));
            setProfile(restoredProfile);
            return true;
          } catch (_) {}
        }
        localStorage.setItem(`socialtalk_profile_${name}`, JSON.stringify(defaultProfile));
        setProfile(defaultProfile);
        return true;
      }
    };

    try {
      return await Promise.race([loadTask(), timeoutPromise]);
    } catch (error) {
      console.warn("Profile loading issue (timeout or error), loading offline data for", name);
      const isAdmin = name === 'admin' || name === 'GM' || name === '관리자접속';
      const allStageIds = scenarios.map(s => s.id);
      const defaultStages = Array.from({ length: DEFAULT_UNLOCKED_STAGE_COUNT }, (_, i) => `stage-${i + 1}`);
      const defaultProfile: UserProfile = {
        uid: name,
        displayName: name,
        email: '',
        exp: 0,
        wisdom: 0,
        level: 1,
        badges: [],
        role: isAdmin ? 'admin' : 'student',
        stats: { cognitive: 0, emotional: 0, behavioral: 0 },
        clearedWorlds: [],
        unlockedStages: isAdmin ? allStageIds : defaultStages,
        clearedStages: isAdmin ? allStageIds : [],
        competenceIndex: 0,
        schoolpingCompleted: [],
        inventory: { magnifier: 0, mirror: 0, hourglass: 0, advice: 0 }
      };

      const saved = localStorage.getItem(`socialtalk_profile_${name}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const mergedUnlocked = Array.from(new Set([...defaultStages, ...(parsed.unlockedStages || [])]));
          const restoredProfile = { ...parsed, unlockedStages: mergedUnlocked };
          localStorage.setItem(`socialtalk_profile_${name}`, JSON.stringify(restoredProfile));
          setProfile(restoredProfile);
          return true;
        } catch (_) {}
      }
      localStorage.setItem(`socialtalk_profile_${name}`, JSON.stringify(defaultProfile));
      setProfile(defaultProfile);
      return true;
    }
  };

  useEffect(() => {
    const savedNickname = localStorage.getItem('socialtalk_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
      loadProfile(savedNickname).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'scenarios'), (snapshot) => {
      const fetchedScenarios = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Scenario));
      fetchedScenarios.sort((a, b) => (Number(a.stage) || 0) - (Number(b.stage) || 0));
      
      const merged = [...fetchedScenarios];
      // Always merge INITIAL_SCENARIOS so missing static ones are guaranteed to be present!
      INITIAL_SCENARIOS.forEach(initScen => {
        if (!merged.find(s => s.id === initScen.id)) {
          merged.push(initScen);
        }
      });
      merged.sort((a, b) => (Number(a.stage) || 0) - (Number(b.stage) || 0));
      
      setScenarios(merged);
      setIsScenariosLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'scenarios');
    });
    return unsubscribe;
  }, []);

  // Listen for profile updates
  useEffect(() => {
    if (nickname) {
      const unsubscribe = onSnapshot(doc(db, 'users', nickname), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          
          setProfile(prev => {
            if (!prev) return data;
            
            // Merge arrays to take union of unlocked and cleared stages (avoiding downgrades if local is newer)
            const defaultStages = Array.from({ length: DEFAULT_UNLOCKED_STAGE_COUNT }, (_, i) => `stage-${i + 1}`);
            const mergedUnlocked = Array.from(new Set([
              ...defaultStages,
              ...(data.unlockedStages || []),
              ...(prev.unlockedStages || [])
            ]));
            
            const mergedCleared = Array.from(new Set([
              ...(data.clearedStages || []),
              ...(prev.clearedStages || [])
            ]));

            const mergedBadges = Array.from(new Set([
              ...(data.badges || []),
              ...(prev.badges || [])
            ]));

            const mergedClearedWorlds = Array.from(new Set([
              ...(data.clearedWorlds || []),
              ...(prev.clearedWorlds || [])
            ]));

            return {
              ...prev,
              ...data,
              unlockedStages: mergedUnlocked,
              clearedStages: mergedCleared,
              badges: mergedBadges,
              clearedWorlds: mergedClearedWorlds,
              exp: Math.max(data.exp || 0, prev.exp || 0),
              level: Math.max(data.level || 1, prev.level || 1),
              wisdom: Math.max(data.wisdom || 0, prev.wisdom || 0),
              competenceIndex: Math.max(data.competenceIndex || 0, prev.competenceIndex || 0),
              stats: {
                cognitive: Math.max(data.stats?.cognitive || 0, prev.stats?.cognitive || 0),
                emotional: Math.max(data.stats?.emotional || 0, prev.stats?.emotional || 0),
                behavioral: Math.max(data.stats?.behavioral || 0, prev.stats?.behavioral || 0),
              },
              inventory: {
                magnifier: Math.max(data.inventory?.magnifier || 0, prev.inventory?.magnifier || 0),
                mirror: Math.max(data.inventory?.mirror || 0, prev.inventory?.mirror || 0),
                hourglass: Math.max(data.inventory?.hourglass || 0, prev.inventory?.hourglass || 0),
                advice: Math.max(data.inventory?.advice || 0, prev.inventory?.advice || 0),
              }
            };
          });
        }
      }, (error) => {
        console.warn("Firestore snapshot listen for profile failed (running with offline data fallback):", error);
      });
      return unsubscribe;
    }
  }, [nickname, scenarios]);

  const isSigningInRef = useRef(false);

  const handleSimpleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginNickname.length < 2 || loginNickname.length > 10) {
      setAuthError('닉네임은 2~10자 사이여야 합니다.');
      return;
    }

    setIsSigningIn(true);
    isSigningInRef.current = true;
    setAuthError(null);
    playSound('WHOOSH');

    // Forced entry timeout: if loading takes more than 10 seconds, force entry
    const forcedEntryTimeout = setTimeout(() => {
      if (isSigningInRef.current) {
        // console.warn("Forced entry triggered due to timeout");
        localStorage.setItem('socialtalk_nickname', loginNickname);
        setNickname(loginNickname);
        setIsSigningIn(false);
        isSigningInRef.current = false;
      }
    }, 10000);

    try {
      const success = await loadProfile(loginNickname);
      clearTimeout(forcedEntryTimeout);
      
      if (success && isSigningInRef.current) {
        localStorage.setItem('socialtalk_nickname', loginNickname);
        setNickname(loginNickname);
      }
    } catch (error) {
      console.error("Login error:", error);
      if (isSigningInRef.current) {
        localStorage.setItem('socialtalk_nickname', loginNickname);
        setNickname(loginNickname);
      }
    } finally {
      setIsSigningIn(false);
      isSigningInRef.current = false;
    }
  };

  const handleLogout = () => {
    playSound('WHOOSH');
    localStorage.removeItem('socialtalk_nickname');
    setNickname(null);
    setProfile(null);
    setView('map');
  };

  const handleNavClick = (newView: typeof view) => {
    playSound('WHOOSH');
    setView(newView);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#050505]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#00F2FF] border-t-transparent rounded-full shadow-[0_0_15px_rgba(0,242,255,0.5)]"
        />
      </div>
    );
  }

  if (!nickname) {
    return (
      <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-[#050505] overflow-hidden relative">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/4 -left-1/4 w-full h-full bg-[#7000FF]/20 blur-[120px] rounded-full"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.1, 0.3, 0.1],
              rotate: [0, -120, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-[#00F2FF]/20 blur-[120px] rounded-full"
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-7xl w-full px-6 text-center relative z-10"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00F2FF]/10 border border-[#00F2FF]/20 rounded-full text-[#00F2FF] text-xs font-mono font-bold mb-12 uppercase tracking-[0.4em] shadow-[0_0_20px_rgba(0,242,255,0.1)]"
          >
            <ShieldCheck size={16} />
            최고의 소셜 어드벤처
          </motion.div>

          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] font-black text-white mb-8 tracking-tighter leading-[0.8] whitespace-nowrap overflow-visible flex justify-center items-center gap-2">
            <span className="neon-text-purple">소셜</span>
            <span className="neon-text-blue">톡</span>
          </h1>

          <p className="text-slate-400 text-lg mb-12 leading-relaxed font-light">
            당신의 대화 스킬을 레벨업하고 세상을 구하세요.
          </p>

          <form onSubmit={handleSimpleLogin} className="space-y-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#00F2FF] to-[#7000FF] rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-slate-500">
                  <UserIcon size={20} />
                </div>
                <input
                  type="text"
                  value={loginNickname}
                  onChange={(e) => setLoginNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl py-5 pl-12 pr-4 text-white font-bold tracking-tight focus:outline-none focus:border-[#00F2FF]/50 transition-all"
                  maxLength={10}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSigningIn || loginNickname.length < 2}
              className="cyber-button-primary w-full py-5 text-lg group shung-animation disabled:opacity-50 disabled:cursor-not-allowed relative z-30"
            >
              <span className="flex items-center justify-center gap-3">
                {isSigningIn ? '접속 중...' : '모험 시작'}
                {!isSigningIn && (
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    →
                  </motion.span>
                )}
              </span>
            </button>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-xs font-bold backdrop-blur-md"
              >
                {authError}
              </motion.div>
            )}
          </form>
          
          <div className="mt-8 text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em]">
            닉네임만으로 간편하게 시작하세요
          </div>
        </motion.div>

        {/* Bottom Decorative Rail */}
        <div className="absolute bottom-12 left-0 w-full overflow-hidden whitespace-nowrap opacity-10 pointer-events-none">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="flex gap-12 text-white font-black text-4xl uppercase italic"
          >
            <span>대화는 힘이다 • 말하기 실력을 키워라 • 소셜 모험이 기다린다 • 대화의 기술을 마스터하라 • </span>
            <span>대화는 힘이다 • 말하기 실력을 키워라 • 소셜 모험이 기다린다 • 대화의 기술을 마스터하라 • </span>
          </motion.div>
        </div>
        <div className="scanline" />
      </div>
    );
  }

  const handleSelectScenario = (scenario: Scenario) => {
    playSound('WHOOSH');
    setSelectedScenario(scenario);
    setView('chat');
  };

  const handleNextStage = (currentScenarioId: string) => {
    playSound('WHOOSH');
    const currentStageObj = scenarios.find(s => s.id === currentScenarioId);
    if (!currentStageObj) {
      setView('map');
      return;
    }
    const currentStageNum = Number(currentStageObj.stage);
    const nextScenario = scenarios.find(s => Number(s.stage) === currentStageNum + 1);
    
    if (nextScenario) {
      setSelectedScenario(nextScenario);
    } else {
      setView('map');
    }
  };

  const updateProfileState = (updater: UserProfile | ((prev: UserProfile | null) => UserProfile | null)) => {
    setProfile(prev => {
      const nextProfile = typeof updater === 'function' ? updater(prev) : updater;
      if (nextProfile && nextProfile.uid) {
        localStorage.setItem(`socialtalk_profile_${nextProfile.uid}`, JSON.stringify(nextProfile));
      }
      return nextProfile;
    });
  };

  return (
    <ErrorBoundary>
      <div className="h-[100dvh] flex flex-col bg-[#050505] overflow-hidden text-slate-200">
      {/* Header - Game Dashboard Style */}
      <header className="bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00F2FF] to-[#7000FF] rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-[0_0_15px_rgba(0,242,255,0.3)]">S</div>
            <div className="hidden lg:block">
              <h2 className="font-black text-white tracking-tight leading-none">소셜톡</h2>
              <p className="text-[10px] text-[#00F2FF] font-mono font-bold uppercase tracking-[0.2em] mt-1">시스템 온라인</p>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10 hidden lg:block" />

          {/* Player Stats Rail */}
          <div className="hidden xl:flex items-center gap-8">
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={10} className="text-[#00F2FF]" />
                플레이어 레벨
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[#00F2FF] font-mono font-black text-sm drop-shadow-[0_0_10px_rgba(0,242,255,0.8)]">LV.{profile?.level}</span>
                <div className="w-32 h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(profile?.exp || 0) % 100}%` }}
                    className="h-full bg-gradient-to-r from-[#00F2FF] to-[#7000FF] shadow-[0_0_20px_rgba(0,242,255,0.8)]"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={10} className="text-[#7000FF]" />
                지혜 포인트
              </p>
              <p className="text-[#7000FF] font-mono font-black text-xl drop-shadow-[0_0_15px_rgba(112,0,255,0.8)]">
                {profile?.wisdom?.toLocaleString()} <span className="text-[10px] opacity-70">WP</span>
              </p>
            </div>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          <NavBtn active={view === 'map'} onClick={() => handleNavClick('map')} icon={<MapIcon size={18}/>} label="월드 맵" />
          <NavBtn active={view === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={<BarChart3 size={18}/>} label="플레이어 통계" />
          <NavBtn active={view === 'missions'} onClick={() => handleNavClick('missions')} icon={<Target size={18}/>} label="오늘의 미션" />
          <NavBtn active={view === 'store'} onClick={() => handleNavClick('store')} icon={<ShoppingCart size={18}/>} label="전략 상점" />
          {profile?.role === 'admin' && (
            <NavBtn active={view === 'admin'} onClick={() => handleNavClick('admin')} icon={<Settings size={18}/>} label="관리자 설정" />
          )}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-white uppercase tracking-tight">{profile?.displayName}</p>
            <p className="text-[10px] text-[#00F2FF] font-mono font-bold uppercase tracking-widest">{profile?.role === 'admin' ? '게임 마스터' : '모험가'}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-[0_0_10px_rgba(0,242,255,0.1)]">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.displayName}`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'map' && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <WorldMap onSelectScenario={handleSelectScenario} profile={profile} scenarios={scenarios} />
            </motion.div>
          )}
          {view === 'chat' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
              <Chatbot scenario={selectedScenario} onBack={() => handleNavClick('map')} onNextStage={handleNextStage} profile={profile} scenarios={scenarios} onUpdateProfile={updateProfileState} />
            </motion.div>
          )}
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto">
              <Dashboard profile={profile} />
            </motion.div>
          )}
          {view === 'missions' && (
            <motion.div key="missions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto">
              <Missions profile={profile} />
            </motion.div>
          )}
          {view === 'store' && (
            <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto">
              <Store profile={profile} />
            </motion.div>
          )}
          {view === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto">
              <AdminPanel profile={profile} scenarios={scenarios} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden bg-[#0a0a0a] border-t border-white/5 px-6 py-3 flex items-center justify-around">
        <MobileNavBtn active={view === 'map'} onClick={() => handleNavClick('map')} icon={<MapIcon size={24}/>} />
        <MobileNavBtn active={view === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={<BarChart3 size={24}/>} />
        <MobileNavBtn active={view === 'missions'} onClick={() => handleNavClick('missions')} icon={<Target size={24}/>} />
        <MobileNavBtn active={view === 'store'} onClick={() => handleNavClick('store')} icon={<ShoppingCart size={24}/>} />
        {profile?.role === 'admin' && (
          <MobileNavBtn active={view === 'admin'} onClick={() => handleNavClick('admin')} icon={<Settings size={24}/>} />
        )}
      </nav>
      <PWAInstallPrompt />
    </div>
    </ErrorBoundary>
  );
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-mono text-xs tracking-widest shung-animation ${
        active ? 'bg-[#00F2FF]/10 text-[#00F2FF] shadow-[0_0_10px_rgba(0,242,255,0.2)] border border-[#00F2FF]/20' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavBtn({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-xl transition-all shung-animation ${
        active ? 'text-[#00F2FF] bg-[#00F2FF]/10' : 'text-slate-600'
      }`}
    >
      {icon}
    </button>
  );
}
