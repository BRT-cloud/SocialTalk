import React, { useRef, useEffect, useState, useMemo } from 'react';
import { WORLDS } from '../constants';
import { UserProfile, Scenario } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Star, Trophy, Map as MapIcon, ChevronRight, Sparkles, Sword, CheckCircle2, Flag, PartyPopper } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import confetti from 'canvas-confetti';

interface WorldMapProps {
  onSelectScenario: (scenario: Scenario) => void;
  profile: UserProfile | null;
  scenarios: Scenario[];
}

const WORLD_COLORS: Record<string, string> = {
  forest: '#10b981', // Emerald
  sea: '#00F2FF',    // Cyber Blue
  city: '#7000FF',   // Cyber Purple
  castle: '#ef4444', // Red
};

export default function WorldMap({ onSelectScenario, profile, scenarios }: WorldMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playSound } = useSound();
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [showSectorClear, setShowSectorClear] = useState<string | null>(null);
  const [transitioningWorld, setTransitioningWorld] = useState<string | null>(null);

  const isStageUnlocked = (scenario: Scenario) => {
    if (!profile) return false;
    return profile.unlockedStages?.includes(scenario.id) || scenario.id === 'stage-1';
  };

  const isStageCleared = (scenarioId: string) => {
    return profile?.clearedStages?.includes(scenarioId);
  };

  // Determine current world
  const currentWorldId = useMemo(() => {
    if (!profile) return 'forest';
    
    // Admin exception: if all stages are unlocked, show all worlds
    const allStagesCount = scenarios.length;
    const clearedCount = profile.clearedStages?.length || 0;
    const unlockedCount = profile.unlockedStages?.length || 0;
    
    if (profile.role === 'admin' && (unlockedCount === allStagesCount || clearedCount === allStagesCount)) {
      return 'all';
    }

    const firstUncleared = scenarios.find(s => !isStageCleared(s.id));
    return firstUncleared ? firstUncleared.world : 'castle';
  }, [profile, scenarios]);

  // Track sector completion and handle transition
  const [displayWorldId, setDisplayWorldId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (scenarios.length > 0) {
      const allUnlocked = profile.unlockedStages.length >= scenarios.length;
      if (allUnlocked || currentWorldId === 'all') {
        setDisplayWorldId('all');
        return;
      }
    }

    const worlds = ['forest', 'sea', 'city', 'castle'];
    const currentIndex = worlds.indexOf(currentWorldId);
    
    // If we just moved to a new world
    if (displayWorldId && displayWorldId !== 'all' && displayWorldId !== currentWorldId) {
      const prevWorldId = displayWorldId;
      const prevWorldScenarios = scenarios.filter(s => s.world === prevWorldId);
      const allPrevCleared = prevWorldScenarios.every(s => isStageCleared(s.id));

      const hasSeenClear = localStorage.getItem(`sector_clear_${prevWorldId}`);
      if (allPrevCleared && !hasSeenClear) {
        // Keep the old world visible during animation
        triggerSectorClear(prevWorldId, currentWorldId);
      } else {
        setDisplayWorldId(currentWorldId);
      }
    } else if (!displayWorldId) {
      setDisplayWorldId(currentWorldId);
    }
  }, [profile, scenarios, currentWorldId, displayWorldId]);

  const triggerSectorClear = (clearedWorldId: string, nextWorldId: string) => {
    const worldName = WORLDS.find(w => w.id === clearedWorldId)?.name || clearedWorldId;
    setShowSectorClear(worldName);
    localStorage.setItem(`sector_clear_${clearedWorldId}`, 'true');
    
    // Fireworks
    const duration = 6 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 100 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.5, y: 0.5 } });
    }, 300);

    playSound('CYBER_CLEAR');
    
    setTimeout(() => {
      setShowSectorClear(null);
      setTransitioningWorld(nextWorldId);
      // After fade out, switch the world
      setTimeout(() => {
        setDisplayWorldId(nextWorldId);
        setTransitioningWorld(null);
      }, 800);
    }, 7000);
  };

  const handleScenarioClick = (scenario: Scenario) => {
    playSound('WHOOSH');
    onSelectScenario(scenario);
  };

  // Find the current stage (first uncleared)
  const currentStageId = scenarios.find(s => !isStageCleared(s.id))?.id || scenarios[scenarios.length - 1]?.id;

  // Auto-focus on current stage
  useEffect(() => {
    if (scenarios.length > 0 && profile && currentStageId && displayWorldId) {
      const timer = setTimeout(() => {
        const targetEl = document.getElementById(currentStageId);
        if (targetEl && scrollRef.current) {
          targetEl.scrollIntoView({ 
            behavior: isFirstLoad ? 'auto' : 'smooth', 
            inline: 'center', 
            block: 'nearest' 
          });
          if (isFirstLoad) setIsFirstLoad(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentStageId, scenarios, profile, isFirstLoad, displayWorldId]);

  // Horizontal scroll with mouse wheel
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        el.scrollTo({
          left: el.scrollLeft + e.deltaY * 3,
          behavior: 'smooth'
        });
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }
  }, []);

  const visibleWorlds = displayWorldId === 'all' ? WORLDS : WORLDS.filter(w => w.id === displayWorldId);

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden relative font-sans">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00F2FF]/5 to-transparent pointer-events-none" />
      
      {/* Sector Clear Overlay */}
      <AnimatePresence>
        {showSectorClear && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ scale: 0.5, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-center space-y-12"
            >
              <div className="relative">
                <motion.h1 
                  animate={{ 
                    textShadow: [
                      "0 0 20px #00F2FF",
                      "0 0 60px #00F2FF",
                      "0 0 100px #7000FF",
                      "0 0 20px #00F2FF"
                    ],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="text-9xl md:text-[15rem] font-black text-white italic uppercase tracking-tighter leading-none"
                >
                  SECTOR <span className="text-cyber-blue">CLEAR</span>
                </motion.h1>
                <div className="absolute -inset-4 bg-cyber-blue/20 blur-[120px] -z-10 animate-pulse" />
              </div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-br from-cyber-blue/20 to-cyber-purple/20 border-2 border-cyber-blue/40 p-12 rounded-[3rem] max-w-3xl mx-auto backdrop-blur-xl shadow-[0_0_100px_rgba(0,242,255,0.2)]"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <PartyPopper size={64} className="text-cyber-blue mx-auto mb-6" />
                </motion.div>
                <h2 className="text-4xl font-black text-white mb-4 italic tracking-tight">MISSION ACCOMPLISHED</h2>
                <p className="text-2xl text-cyber-blue font-bold leading-relaxed">
                  당신은 <span className="text-white underline decoration-cyber-purple underline-offset-8">[{showSectorClear}]</span>을 정복하고<br />
                  <span className="text-white">진정한 소통의 기술</span>을 마스터했습니다!
                </p>
              </motion.div>
              
              <div className="flex flex-col items-center gap-4">
                <p className="text-slate-500 font-mono text-sm uppercase tracking-[0.8em] animate-pulse">
                  INITIALIZING NEXT SECTOR PROTOCOL...
                </p>
                <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 6 }}
                    className="h-full bg-cyber-blue"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative z-10 px-8 pt-8 pb-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyber-blue/10 border border-cyber-blue/50 rounded-xl flex items-center justify-center text-cyber-blue shadow-[0_0_20px_rgba(0,242,255,0.2)]">
            <MapIcon size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
              Social <span className="text-cyber-blue">Adventure</span> Map
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-cyber-blue animate-pulse" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                {displayWorldId === 'all' ? '전체 섹터 개방됨' : `${WORLDS.find(w => w.id === displayWorldId)?.name} 탐험 중`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4 backdrop-blur-xl">
            <div className="w-10 h-10 bg-cyber-purple/20 rounded-lg flex items-center justify-center text-cyber-purple shadow-[0_0_15px_rgba(112,0,255,0.3)]">
              <Flag size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">진행도</p>
              <p className="text-xl font-black text-white leading-none">
                {profile?.clearedStages?.length || 0} <span className="text-xs text-slate-500">/ 105</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Horizontal Scroll Area */}
      <motion.div 
        ref={scrollRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: transitioningWorld ? 0 : 1 }}
        transition={{ duration: 0.8 }}
        className="flex-1 overflow-x-auto overflow-y-auto flex items-start px-[5vw] md:px-[10vw] py-8 gap-8 md:gap-12 neon-scrollbar relative z-10"
      >
        {visibleWorlds.map((world) => {
          const worldScenarios = scenarios.filter(s => s.world === world.id).sort((a, b) => a.stage - b.stage);
          const worldColor = WORLD_COLORS[world.id];

          return (
            <div key={world.id} className="flex items-center gap-8 md:gap-12 my-auto">
              {/* World Divider/Header */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center gap-6 px-8 md:px-12 border-r border-white/10 h-[70%]">
                <div 
                  className="w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center text-white shadow-2xl rotate-45 border-4"
                  style={{ backgroundColor: `${worldColor}20`, borderColor: worldColor, boxShadow: `0 0 50px ${worldColor}60` }}
                >
                  <div className="-rotate-45 font-black text-3xl md:text-4xl uppercase italic">{world.name[0]}</div>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic" style={{ color: worldColor }}>{world.name}</h3>
                  <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">{worldScenarios.length} STAGES</p>
                  <p className="text-[10px] text-slate-600 mt-4 max-w-[150px] md:max-w-[200px] leading-relaxed font-medium">{world.desc}</p>
                </div>
              </div>

              {/* Stages Row */}
              <div className="flex items-center gap-8 md:gap-16">
                {worldScenarios.map((scenario) => {
                  const unlocked = isStageUnlocked(scenario);
                  const cleared = isStageCleared(scenario.id);
                  const isCurrent = scenario.id === currentStageId;
                  
                  return (
                    <motion.div
                      id={scenario.id}
                      key={scenario.id}
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.05 : 1,
                        zIndex: isCurrent ? 20 : 10,
                      }}
                      className="relative flex-shrink-0 py-4"
                    >
                      <button
                        onClick={() => unlocked && handleScenarioClick(scenario)}
                        disabled={!unlocked}
                        className={`
                          relative w-[75vw] sm:w-72 md:w-80 h-[55vh] min-h-[320px] max-h-[448px] rounded-[2rem] md:rounded-[2.5rem] border-4 overflow-hidden transition-all duration-500 group
                          ${unlocked 
                            ? cleared
                              ? 'border-emerald-500/50 opacity-80 grayscale-[0.3]'
                              : isCurrent
                                ? 'border-cyber-blue shadow-[0_0_60px_rgba(0,242,255,0.8)]'
                                : 'border-white/10 hover:border-white/40'
                            : 'border-white/5 opacity-30 grayscale pointer-events-none'
                          }
                          ${isCurrent ? 'ring-[8px] md:ring-[12px] ring-cyber-blue/20' : ''}
                        `}
                      >
                        {/* Background Image */}
                        <div className="absolute inset-0">
                          <img 
                            src={scenario.mediaUrl} 
                            alt={scenario.title}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent`} />
                        </div>

                        {/* Content Overlay */}
                        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-10">
                          <div className="flex justify-between items-start">
                            <div className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-black tracking-[0.2em] uppercase bg-black/80 border-2 ${
                              cleared ? 'border-emerald-500 text-emerald-400' : 'border-white/20 text-white'
                            }`}>
                              STAGE {scenario.stage}
                            </div>
                            {cleared ? (
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_#10b981]">
                                <CheckCircle2 size={20} className="text-black" />
                              </div>
                            ) : !unlocked ? (
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-black/60 rounded-full flex items-center justify-center border-2 border-white/10">
                                <Lock size={20} className="text-slate-500" />
                              </div>
                            ) : isCurrent && (
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-cyber-blue rounded-full flex items-center justify-center shadow-[0_0_40px_#00F2FF] animate-pulse">
                                <Sparkles size={20} className="text-black" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 md:space-y-4">
                            {scenario.isBoss && (
                              <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-cyber-purple uppercase tracking-[0.3em] drop-shadow-[0_0_10px_rgba(112,0,255,1)]">
                                <Sword size={14} /> BOSS BATTLE
                              </div>
                            )}
                            <h4 className="text-2xl md:text-3xl font-black text-white leading-none tracking-tighter uppercase italic drop-shadow-2xl">
                              {scenario.title}
                            </h4>
                            
                            {/* Situation Preview - Always visible but slightly dimmed by default */}
                            <p className="text-xs md:text-sm text-slate-300 line-clamp-3 leading-relaxed font-medium opacity-70 group-hover:opacity-100 transition-opacity duration-500">
                              {scenario.situation}
                            </p>

                            {cleared && (
                              <p className="text-[10px] md:text-xs font-black text-emerald-400 uppercase tracking-[0.4em] pt-2">MISSION COMPLETE</p>
                            )}
                          </div>
                        </div>

                        {/* Current Stage Glow Effect - Stronger Neon */}
                        {isCurrent && (
                          <div className="absolute inset-0 border-4 border-cyber-blue shadow-[inset_0_0_30px_rgba(0,242,255,0.4)] animate-pulse pointer-events-none" />
                        )}
                        
                        {/* Scanline Effect */}
                        <div className="scanline" />
                      </button>

                      {/* Connector Line */}
                      <div className="absolute top-1/2 -right-8 md:-right-16 w-8 md:w-16 h-[4px] bg-white/10 -translate-y-1/2" />
                    </motion.div>
                  );
                })}

                {/* Next Sector Locked Card */}
                {displayWorldId !== 'all' && displayWorldId !== 'castle' && (
                  <div className="relative flex-shrink-0 opacity-40 py-4">
                    <div className="w-[75vw] sm:w-72 md:w-80 h-[55vh] min-h-[320px] max-h-[448px] rounded-[2rem] md:rounded-[2.5rem] border-4 border-dashed border-white/10 flex flex-col items-center justify-center gap-6 bg-white/5">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-black/40 rounded-full flex items-center justify-center border-2 border-white/10">
                        <Lock size={32} className="text-slate-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-base md:text-lg font-black text-white/40 uppercase tracking-[0.3em]">NEXT SECTOR</p>
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">CLEAR ALL STAGES TO UNLOCK</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* End of Journey */}
        {displayWorldId === 'castle' || displayWorldId === 'all' ? (
          <div className="flex-shrink-0 w-[75vw] sm:w-72 md:w-80 h-[55vh] min-h-[320px] max-h-[448px] rounded-[2rem] md:rounded-[2.5rem] border-4 border-dashed border-white/10 flex flex-col items-center justify-center gap-6 bg-white/5 my-auto">
            <Trophy size={64} className="text-white/10 md:w-20 md:h-20" />
            <p className="text-base md:text-lg font-black text-white/20 uppercase tracking-[0.5em]">END OF JOURNEY</p>
          </div>
        ) : null}
      </motion.div>

      {/* Footer Progress */}
      <div className="px-8 py-6 bg-black/60 backdrop-blur-xl border-t border-white/5 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyber-blue animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SYSTEM STATUS: ONLINE</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GLOBAL PROGRESS</span>
            <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(profile?.clearedStages?.length || 0) / 105 * 100}%` }}
                className="h-full bg-gradient-to-r from-cyber-purple to-cyber-blue shadow-[0_0_15px_rgba(0,242,255,0.5)]"
              />
            </div>
            <span className="text-xs font-black text-cyber-blue">
              {Math.round((profile?.clearedStages?.length || 0) / 105 * 100)}%
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span>CYBER FANTASY OS v3.0.0</span>
          <div className="w-[1px] h-4 bg-white/10" />
          <span className="text-cyber-blue">ST_MAP_LOADED</span>
        </div>
      </div>

      <style>{`
        .neon-scrollbar::-webkit-scrollbar {
          height: 12px;
        }
        .neon-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          margin: 0 10vw;
        }
        .neon-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to right, #7000FF, #00F2FF);
          border-radius: 10px;
          box-shadow: 0 0 20px rgba(0, 242, 255, 0.6);
          border: 3px solid rgba(0, 0, 0, 0.5);
        }
        .neon-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to right, #8000FF, #00FFFF);
        }
        
        .scanline {
          width: 100%;
          height: 150px;
          z-index: 5;
          background: linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(0, 242, 255, 0.08) 50%, rgba(0, 0, 0, 0) 100%);
          opacity: 0.15;
          position: absolute;
          bottom: 100%;
          animation: scanline 8s linear infinite;
        }

        @keyframes scanline {
          0% { bottom: 100%; }
          100% { bottom: -100%; }
        }
      `}</style>
    </div>
  );
}
