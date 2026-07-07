import React, { useState, useRef, useEffect } from 'react';
import { Scenario, UserProfile, Attempt, Quest } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Sparkles, Award, Heart, Brain, CheckCircle2, XCircle, Info, Zap, Star, Sword, Terminal, Camera, BookOpen, Search, Eye, Hourglass, Lightbulb, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSound } from '../hooks/useSound';

interface ChatbotProps {
  scenario: Scenario | null;
  onBack: () => void;
  onNextStage: (nextScenarioId: string) => void;
  profile: UserProfile | null;
  scenarios: Scenario[];
  onUpdateProfile?: (profile: UserProfile) => void;
}

type Step = 'visual' | 'quest' | 'result';

export default function Chatbot({ scenario, onBack, onNextStage, profile, scenarios, onUpdateProfile }: ChatbotProps) {
  const [currentStep, setCurrentStep] = useState<Step>('visual');
  const [currentQuestIndex, setCurrentQuestIndex] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [showSchoolping, setShowSchoolping] = useState(false);
  const [showWorldClearOverlay, setShowWorldClearOverlay] = useState(false);
  
  // State for the current quest
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showExpAnimation, setShowExpAnimation] = useState(false);

  // Item states
  const [timeLeft, setTimeLeft] = useState(60);
  const [disabledOptions, setDisabledOptions] = useState<string[]>([]);
  const [showMirrorHint, setShowMirrorHint] = useState(false);
  const [showAdviceHint, setShowAdviceHint] = useState(false);
  const [activeItemAnimation, setActiveItemAnimation] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { playSound } = useSound();

  useEffect(() => {
    // Reset state when scenario changes
    setCurrentStep('visual');
    setCurrentQuestIndex(0);
    setInput('');
    setLoading(false);
    setShowSuccessOverlay(false);
    setShowSchoolping(false);
    setShowWorldClearOverlay(false);
    setIsAnswered(false);
    setIsCorrect(null);
    setSelectedOption(null);
    setShowExplanation(false);
    setShowExpAnimation(false);
    setTimeLeft(60);
    setDisabledOptions([]);
    setShowMirrorHint(false);
    setShowAdviceHint(false);
  }, [scenario?.id]);

  useEffect(() => {
    if (currentStep === 'quest' && !isAnswered && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (currentStep === 'quest' && timeLeft === 0 && !isAnswered) {
      setIsAnswered(true);
      setIsCorrect(false);
      if (scenario && scenario.quests[currentQuestIndex]) {
        saveAttempt(scenario.quests[currentQuestIndex], '시간 초과', false);
      }
    }
  }, [currentStep, isAnswered, timeLeft, currentQuestIndex, scenario]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentQuestIndex, loading, showExplanation]);

  if (!scenario) return null;

  const currentQuest = scenario.quests[currentQuestIndex] || scenario.quests[0];
  const isLastQuest = currentQuestIndex === scenario.quests.length - 1;

  const triggerSuccess = () => {
    playSound('SUCCESS');
    setShowSuccessOverlay(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00F2FF', '#7000FF', '#ffffff']
    });

    const currentStageNum = Number(scenario.stage);
    const nextScenario = scenarios.find(s => Number(s.stage) === currentStageNum + 1);

    setTimeout(() => {
      setShowSuccessOverlay(false);
      
      if (scenario.isSchoolping) {
        setShowSchoolping(true);
      } else if (nextScenario && nextScenario.world !== scenario.world) {
        setShowWorldClearOverlay(true);
      } else {
        setCurrentStep('result');
      }
    }, 5000);
  };

  const handleNextQuest = () => {
    playSound('WHOOSH');
    if (isLastQuest) {
      triggerSuccess();
    } else {
      setCurrentQuestIndex(prev => prev + 1);
      setIsAnswered(false);
      setIsCorrect(null);
      setSelectedOption(null);
      setInput('');
      setShowExpAnimation(false);
      setTimeLeft(60);
      setDisabledOptions([]);
      setShowMirrorHint(false);
      setShowAdviceHint(false);
    }
  };

  const handleUseItem = async (itemId: string) => {
    if (!profile || !profile.inventory || (profile.inventory[itemId as keyof typeof profile.inventory] || 0) <= 0) return;
    if (isAnswered) return;

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        [`inventory.${itemId}`]: increment(-1)
      });
      
      playSound('SUCCESS');
      setActiveItemAnimation(itemId);
      
      // Item specific confetti
      const colors = 
        itemId === 'magnifier' ? ['#00F2FF', '#ffffff'] :
        itemId === 'mirror' ? ['#7000FF', '#ffffff'] :
        itemId === 'hourglass' ? ['#EAB308', '#ffffff'] :
        ['#22C55E', '#ffffff'];
        
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.5 },
        colors: colors,
        disableForReducedMotion: true
      });
      
      if (itemId === 'magnifier') {
        if (currentQuest.type === 'multiple-choice' && currentQuest.options) {
          const wrongOptions = currentQuest.options.filter(o => o !== currentQuest.correctAnswer && !disabledOptions.includes(o));
          if (wrongOptions.length > 0) {
            const optionToRemove = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
            setDisabledOptions(prev => [...prev, optionToRemove]);
          }
        }
      } else if (itemId === 'mirror') {
        setShowMirrorHint(true);
      } else if (itemId === 'hourglass') {
        setTimeLeft(prev => prev + 30);
      } else if (itemId === 'advice') {
        setShowAdviceHint(true);
      }
      
      setTimeout(() => setActiveItemAnimation(null), 1500);
    } catch (error) {
      console.error("Failed to use item", error);
    }
  };

  const saveAttempt = async (quest: Quest, userInput: string, correct: boolean) => {
    try {
      const attemptData: Attempt = {
        uid: profile?.uid || '',
        scenarioId: scenario.id,
        questId: quest.id,
        userInput,
        isCorrect: correct,
        timestamp: new Date() as any // fallback-friendly timestamp
      };

      // 1. attempts 컬렉션 데이터베이스 로깅은 백그라운드에서 비동기로 실행하여 로컬 상태 업데이트의 지연을 막습니다.
      addDoc(collection(db, 'attempts'), attemptData).catch((dbError) => {
        console.warn("Firestore attempts log skipped (offline mode active):", dbError);
      });

      if (correct) {
        setShowExpAnimation(true);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#00F2FF', '#7000FF', '#ffffff']
        });
        setTimeout(() => setShowExpAnimation(false), 2000);
        
        const competenceEarned = quest.type === 'long-answer' ? 10 : 5;
        const isFirstClear = isLastQuest && !profile?.clearedStages?.includes(scenario.id);
        
        let bonusExp = 0;
        let bonusWisdom = 0;
        let bonusComp = 0;
        let statsChange = { cognitive: 0, emotional: 0, behavioral: 0 };
        
        if (isFirstClear) {
          // 최초 스테이지 완료 보상 가산
          bonusExp = 50;
          bonusWisdom = 25;
          bonusComp = 15;
          
          let statIncrease = 10;
          if (scenario.difficulty === 'medium') statIncrease = 15;
          if (scenario.difficulty === 'hard') statIncrease = 20;
          
          if (scenario.world === 'forest') {
            statsChange.emotional = statIncrease;
          } else if (scenario.world === 'sea') {
            statsChange.cognitive = statIncrease;
          } else if (scenario.world === 'city') {
            statsChange.behavioral = statIncrease;
          } else if (scenario.world === 'castle') {
            const share = Math.ceil(statIncrease / 2);
            statsChange.cognitive = share;
            statsChange.emotional = share;
            statsChange.behavioral = share;
          }
        }

        const currentExp = (profile?.exp || 0) + 10 + bonusExp;
        const currentLevel = Math.floor(currentExp / 100) + 1;
        const currentWisdom = (profile?.wisdom || 0) + 5 + bonusWisdom;
        const currentComp = (profile?.competenceIndex || 0) + competenceEarned + bonusComp;
        const currentStats = {
          cognitive: (profile?.stats?.cognitive || 0) + statsChange.cognitive,
          emotional: (profile?.stats?.emotional || 0) + statsChange.emotional,
          behavioral: (profile?.stats?.behavioral || 0) + statsChange.behavioral,
        };
        
        let newClearedStages = profile ? [...(profile.clearedStages || [])] : [];
        let newUnlockedStages = profile ? [...(profile.unlockedStages || ['stage-1'])] : ['stage-1'];
        let newBadges = profile ? [...(profile.badges || [])] : [];
        let newClearedWorlds = profile ? [...(profile.clearedWorlds || [])] : [];

        if (isLastQuest) {
          if (!newClearedStages.includes(scenario.id)) {
            newClearedStages.push(scenario.id);
          }
          const badgeId = `competence-${scenario.id}`;
          if (!newBadges.includes(badgeId)) {
            newBadges.push(badgeId);
          }
          
          const currentStageNum = Number(scenario.stage);
          const nextScenario = scenarios.find(s => Number(s.stage) === currentStageNum + 1);
          if (nextScenario && !newUnlockedStages.includes(nextScenario.id)) {
            newUnlockedStages.push(nextScenario.id);
          }
          
          if (scenario.isBoss && !newClearedWorlds.includes(scenario.world)) {
            newClearedWorlds.push(scenario.world);
            newBadges.push(`${scenario.world}-master`);
          }
        }

        const updatedProfile: UserProfile = {
          ...(profile || {} as UserProfile),
          exp: currentExp,
          level: currentLevel,
          wisdom: currentWisdom,
          competenceIndex: currentComp,
          stats: currentStats,
          clearedStages: newClearedStages,
          unlockedStages: newUnlockedStages,
          badges: newBadges,
          clearedWorlds: newClearedWorlds
        };

        // 2. 즉시 로컬 상태와 스토리지를 업데이트하여 지연 없이 수치가 표기되도록 합니다.
        if (profile?.uid) {
          localStorage.setItem(`socialtalk_profile_${profile.uid}`, JSON.stringify(updatedProfile));
        }

        if (onUpdateProfile) {
          onUpdateProfile(updatedProfile);
        }

        // 3. Firestore 원격 동기화 요청 역시 백그라운드 비동기로 위임하여 사용자 락을 방지합니다.
        const userRef = doc(db, 'users', profile?.uid || '');
        const updates: any = {
          exp: currentExp,
          level: currentLevel,
          wisdom: currentWisdom,
          competenceIndex: currentComp,
          stats: currentStats,
          clearedStages: newClearedStages,
          unlockedStages: newUnlockedStages,
          badges: newBadges,
          clearedWorlds: newClearedWorlds
        };
        
        updateDoc(userRef, updates).catch((error) => {
          console.warn("Firestore sync update failed, progression safely stored offline:", error);
        });
      }
    } catch (error) {
      console.error("Critical error in saveAttempt safety wrap:", error);
    }
  };

  const handleOptionSelect = async (option: string) => {
    if (isAnswered || disabledOptions.includes(option)) return;
    playSound('WHOOSH');
    setSelectedOption(option);
    const correct = option === currentQuest.correctAnswer;
    setIsCorrect(correct);
    setIsAnswered(true);
    await saveAttempt(currentQuest, option, correct);
  };

  const handleShortAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnswered) return;
    playSound('WHOOSH');
    
    const correct = input.trim() === currentQuest.correctAnswer;
    setIsCorrect(correct);
    setIsAnswered(true);
    await saveAttempt(currentQuest, input.trim(), correct);
  };

  const handleLongAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnswered) return;
    playSound('WHOOSH');
    setIsAnswered(true);
    setShowExplanation(true);
  };

  const handleSelfEvaluation = async (isSimilar: boolean) => {
    if (isSimilar) {
      playSound('SUCCESS');
    } else {
      playSound('WHOOSH');
    }
    setIsCorrect(isSimilar);
    await saveAttempt(currentQuest, input, isSimilar);
  };

  const handleSchoolpingComplete = async () => {
    try {
      if (profile?.uid) {
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
          schoolpingCompleted: arrayUnion(scenario.id)
        });
      }
    } catch (error) {
      console.error('Error saving schoolping completion:', error);
    }
    
    setShowSchoolping(false);
    
    const currentStageNum = Number(scenario.stage);
    const nextScenario = scenarios.find(s => Number(s.stage) === currentStageNum + 1);
    
    if (nextScenario && nextScenario.world !== scenario.world) {
      setShowWorldClearOverlay(true);
    } else {
      setCurrentStep('result');
    }
  };

  const handleWorldClearComplete = () => {
    setShowWorldClearOverlay(false);
    setCurrentStep('result');
  };

  const handleRetry = () => {
    playSound('WHOOSH');
    setIsAnswered(false);
    setIsCorrect(null);
    setTimeLeft(60);
    setInput('');
    setSelectedOption(null);
    setShowExplanation(false);
    setDisabledOptions([]);
    setShowMirrorHint(false);
    setShowAdviceHint(false);
  };

  const currentScenarioIndex = scenarios.findIndex(s => s.id === scenario.id);
  const totalScenarios = scenarios.length;
  const progressPercentage = ((currentScenarioIndex + 1) / totalScenarios) * 100;

  return (
    <div className="h-full flex flex-col bg-cyber-bg text-white relative overflow-hidden">
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10 z-50">
        <motion.div 
          className="h-full bg-gradient-to-r from-cyber-blue to-cyber-purple shadow-[0_0_10px_#00F2FF]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
      
      {/* Top Bar */}
      <div className="bg-black/40 backdrop-blur-xl border-b border-white/5 px-8 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          <button onClick={() => { playSound('WHOOSH'); onBack(); }} className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-90 border border-white/10 cyber-button">
            <ArrowLeft size={24} className="text-cyber-blue" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {scenario.isBoss && <span className="text-[10px] font-black text-cyber-purple uppercase tracking-widest bg-cyber-purple/10 px-2 py-0.5 rounded-full border border-cyber-purple/20 neon-text-purple">보스 스테이지</span>}
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-none uppercase italic">{scenario.title}</h2>
          </div>
        </div>
        {currentStep === 'quest' && (
          <div className="flex gap-2">
            {scenario.quests.map((q, i) => (
              <div key={q.id} className={`w-8 h-2 rounded-full transition-all ${i === currentQuestIndex ? 'bg-cyber-blue shadow-[0_0_10px_#00F2FF]' : i < currentQuestIndex ? 'bg-cyber-blue/30' : 'bg-white/10'}`} />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative z-10" ref={scrollRef}>
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {currentStep === 'visual' && (
              <motion.div key="visual" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-8">
                {/* Combined Card */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-8">
                  {/* Background Image */}
                  <div className="absolute inset-0 z-0">
                    <img src={scenario.mediaUrl} alt="상황 일러스트" className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
                  </div>

                  {/* Content */}
                  <div className="relative z-10 p-8 md:p-10">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-cyber-blue/20 rounded-xl flex items-center justify-center text-cyber-blue border border-cyber-blue/30 shadow-[0_0_15px_rgba(0,242,255,0.2)] backdrop-blur-md">
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-cyber-purple tracking-widest uppercase mb-1">
                          {scenario.world === 'forest' ? '우정의 숲' : scenario.world === 'sea' ? '공감의 바다' : scenario.world === 'city' ? '자립의 도시' : '내면의 성'}
                        </h3>
                        <h4 className="text-3xl font-black text-white tracking-tight neon-text-blue italic">{scenario.title}</h4>
                      </div>
                    </div>
                    
                    <div className="bg-black/40 backdrop-blur-md border-l-4 border-cyber-blue p-6 rounded-r-xl">
                      <p className="text-slate-200 text-lg md:text-xl leading-relaxed font-medium whitespace-pre-line">
                        {scenario.situation}
                      </p>
                    </div>
                  </div>
                  <div className="scanline" />
                </div>

                <button 
                  onClick={() => { playSound('WHOOSH'); setCurrentStep('quest'); }}
                  className="w-full py-5 bg-cyber-blue text-black font-black text-2xl rounded-xl hover:bg-white hover:text-cyber-blue transition-all shadow-[0_0_20px_rgba(0,242,255,0.4)] uppercase tracking-widest italic transform hover:-translate-y-1"
                >
                  도전하기
                </button>
              </motion.div>
            )}

            {currentStep === 'quest' && currentQuest && (
              <motion.div key={`quest-${currentQuestIndex}`} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-8">
                <div className="cyber-card p-10 hologram-border relative overflow-hidden">
                  {/* Item Animation Overlay */}
                  <AnimatePresence>
                    {activeItemAnimation && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.2, rotate: -45 }}
                        animate={{ opacity: 1, scale: 1.2, rotate: 0 }}
                        exit={{ opacity: 0, scale: 2, filter: 'blur(10px)' }}
                        transition={{ type: 'spring', damping: 12, stiffness: 100 }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-md"
                      >
                        {activeItemAnimation === 'magnifier' && <Search size={160} className="text-cyber-blue drop-shadow-[0_0_50px_rgba(0,242,255,1)]" />}
                        {activeItemAnimation === 'mirror' && <Eye size={160} className="text-cyber-purple drop-shadow-[0_0_50px_rgba(112,0,255,1)]" />}
                        {activeItemAnimation === 'hourglass' && <Hourglass size={160} className="text-yellow-500 drop-shadow-[0_0_50px_rgba(234,179,8,1)]" />}
                        {activeItemAnimation === 'advice' && <Lightbulb size={160} className="text-green-500 drop-shadow-[0_0_50px_rgba(34,197,94,1)]" />}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between gap-3 text-cyber-blue mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyber-blue/10 rounded-lg flex items-center justify-center border border-cyber-blue/30">
                        <Brain size={24} />
                      </div>
                      <span className="font-black uppercase tracking-widest text-sm">퀘스트 {currentQuestIndex + 1} / {scenario.quests.length}</span>
                    </div>
                    {!isAnswered && (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${timeLeft <= 10 ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue'}`}>
                        <Hourglass size={20} />
                        <span className="font-bold text-lg">{timeLeft}초</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-3xl font-black text-white mb-10 leading-tight italic">{currentQuest.question}</h3>
                  
                  {/* Multiple Choice */}
                  {currentQuest.type === 'multiple-choice' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-4">
                        {currentQuest.options?.map((option, i) => {
                          const isDisabledByItem = disabledOptions.includes(option);
                          const isSelected = isAnswered && option === selectedOption;
                          const isCorrectOption = isAnswered && option === currentQuest.correctAnswer;
                          
                          return (
                          <button
                            key={i}
                            onClick={() => handleOptionSelect(option)}
                            disabled={isAnswered || isDisabledByItem}
                            className={`w-full p-6 rounded-xl text-left font-bold text-lg transition-all border-2 flex items-center justify-between group ${
                              isDisabledByItem ? 'opacity-30 cursor-not-allowed bg-black/40 border-white/5 text-slate-600' :
                              isSelected
                                ? isCorrect 
                                  ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue shadow-[0_0_15px_rgba(0,242,255,0.2)]' 
                                  : 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                : isCorrectOption
                                  ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue' 
                                  : 'bg-white/5 border-white/10 hover:border-cyber-blue/50 text-slate-400'
                            }`}
                          >
                            <span className={isDisabledByItem ? 'line-through' : ''}>{option}</span>
                            {isSelected && (
                              isCorrect ? <CheckCircle2 size={24} /> : <XCircle size={24} />
                            )}
                          </button>
                        )})}
                      </div>
                      
                      {isAnswered && selectedOption && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          className={`p-6 rounded-xl border ${isCorrect ? 'bg-cyber-blue/10 border-cyber-blue/30' : 'bg-red-500/10 border-red-500/30'}`}
                        >
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-cyber-blue' : 'text-red-400'}`}>
                            {isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                            해설
                          </h4>
                          <p className="text-slate-300 leading-relaxed">
                            {currentQuest.optionExplanations ? 
                              currentQuest.optionExplanations[currentQuest.options!.indexOf(selectedOption)] : 
                              currentQuest.explanation}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Short Answer */}
                  {currentQuest.type === 'short-answer' && (
                    <form onSubmit={handleShortAnswerSubmit} className="space-y-4">
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity pointer-events-none" />
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          disabled={isAnswered}
                          placeholder="정답을 입력하세요..."
                          className="relative w-full p-6 pr-20 rounded-xl bg-black/60 border-2 border-white/10 focus:border-cyber-blue transition-all outline-none shadow-xl text-lg font-medium text-white disabled:opacity-50"
                        />
                        {!isAnswered && (
                          <button
                            type="submit"
                            disabled={!input.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 h-12 bg-cyber-blue text-black rounded-lg flex items-center justify-center gap-2 hover:bg-white disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-90 shadow-[0_0_15px_rgba(0,242,255,0.4)] font-bold"
                          >
                            <Send size={18} /> 입력
                          </button>
                        )}
                      </div>
                      {isAnswered && (
                        <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue' : 'bg-red-500/10 border-red-500/30 text-red-400'} flex items-center gap-3`}>
                          {isCorrect ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                          <span className="font-bold text-lg">
                            {isCorrect ? '정답입니다!' : `오답입니다. 정답은 "${currentQuest.correctAnswer}" 입니다.`}
                          </span>
                        </div>
                      )}
                    </form>
                  )}

                  {/* Long Answer (Self Evaluation) */}
                  {currentQuest.type === 'long-answer' && (
                    <div className="space-y-6">
                      <div className="bg-cyber-purple/10 p-6 rounded-2xl border border-cyber-purple/30 flex gap-4 items-center">
                        <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center text-cyber-purple border border-cyber-purple/30 shadow-[0_0_10px_rgba(112,0,255,0.2)]">
                          <Info size={20} />
                        </div>
                        <p className="text-sm font-bold text-cyber-purple">상황에 맞게 자유롭게 작성해보세요. 제출 후 모범 답안과 비교할 수 있습니다.</p>
                      </div>

                      <form onSubmit={handleLongAnswerSubmit} className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity pointer-events-none" />
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          disabled={isAnswered}
                          placeholder="여기에 답변을 작성하세요..."
                          rows={4}
                          className="relative w-full p-6 rounded-xl bg-black/60 border-2 border-white/10 focus:border-cyber-blue transition-all outline-none shadow-xl text-lg font-medium text-white disabled:opacity-50 resize-none"
                        />
                        {!isAnswered && (
                          <div className="flex justify-end mt-4 relative z-10">
                            <button
                              type="submit"
                              disabled={!input.trim()}
                              className="px-8 py-4 bg-cyber-blue text-black rounded-xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-90 shadow-[0_0_15px_rgba(0,242,255,0.4)]"
                            >
                              <Send size={20} /> 제출하기
                            </button>
                          </div>
                        )}
                      </form>

                      {showExplanation && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                          animate={{ opacity: 1, scale: 1, y: 0 }} 
                          transition={{ type: 'spring', damping: 15 }}
                          className="relative mt-8 p-[2px] rounded-2xl overflow-hidden group"
                        >
                          {/* Animated Hologram Border */}
                          <div className="absolute inset-0 bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-blue opacity-50 blur-sm group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,#00F2FF_50%,transparent_100%)] translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                          
                          <div className="relative bg-black/80 backdrop-blur-xl p-8 rounded-2xl border border-white/10 h-full">
                            {/* Scanline Effect */}
                            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
                            
                            <div className="flex flex-col gap-6 relative z-10">
                              <div className="flex items-center gap-3 mb-2">
                                <BookOpen className="text-cyber-blue" size={28} />
                                <h4 className="font-black text-2xl italic text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                                  퀘스트 해설지
                                </h4>
                              </div>
                              
                              <div className="space-y-6">
                                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
                                  <h5 className="text-cyber-blue font-bold mb-2 flex items-center gap-2">
                                    <Star size={16} /> 모범 답안
                                  </h5>
                                  <p className="text-lg text-white leading-relaxed">
                                    {currentQuest.correctAnswer}
                                  </p>
                                </div>

                                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
                                  <h5 className="text-cyber-purple font-bold mb-2 flex items-center gap-2">
                                    <Brain size={16} /> 국어적/사회적 해설
                                  </h5>
                                  <p className="text-lg text-slate-300 leading-relaxed">
                                    {currentQuest.explanation}
                                  </p>
                                </div>

                                {currentQuest.keywords && (
                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-sm font-bold text-slate-500 mr-2 flex items-center">핵심 키워드:</span>
                                    {currentQuest.keywords.map((kw, idx) => (
                                      <span key={idx} className="px-3 py-1 bg-cyber-blue/10 text-cyber-blue rounded-full text-sm font-bold border border-cyber-blue/30">
                                        #{kw}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {isCorrect === null && (
                                <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center gap-4">
                                  <p className="text-slate-400 font-medium text-center">
                                    자신의 답변과 모범 답안을 비교해보세요.<br/>핵심 의미가 통한다면 정답으로 인정됩니다.
                                  </p>
                                  <div className="flex gap-4 w-full sm:w-auto">
                                    <button
                                      onClick={() => handleSelfEvaluation(true)}
                                      className="flex-1 sm:flex-none px-6 py-3 bg-cyber-blue/20 text-cyber-blue hover:bg-cyber-blue hover:text-black border border-cyber-blue/50 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                      <CheckCircle2 size={20} /> 내 답안이 모범 답안과 비슷합니다
                                    </button>
                                    <button
                                      onClick={() => handleSelfEvaluation(false)}
                                      className="flex-1 sm:flex-none px-6 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                      <XCircle size={20} /> 다시 생각해볼게요
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isCorrect !== null && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`mt-4 p-4 rounded-xl border flex items-center justify-center gap-3 ${isCorrect ? 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                                >
                                  {isCorrect ? (
                                    <>
                                      <Award size={24} />
                                      <span className="font-bold text-lg">훌륭합니다! 유능감(Competence) +10 획득!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Info size={24} />
                                      <span className="font-bold text-lg">다음에는 더 잘할 수 있을 거예요!</span>
                                    </>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Hints */}
                  {!isAnswered && (showMirrorHint || showAdviceHint) && (
                    <div className="mt-6 space-y-4">
                      {showMirrorHint && currentQuest.hint && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-cyber-purple/10 border border-cyber-purple/30 rounded-xl flex items-start gap-3">
                          <Eye className="text-cyber-purple shrink-0 mt-1" size={20} />
                          <div>
                            <p className="text-sm font-bold text-cyber-purple mb-1">지혜의 거울 힌트</p>
                            <p className="text-sm text-cyber-purple/80">{currentQuest.hint}</p>
                          </div>
                        </motion.div>
                      )}
                      {showAdviceHint && currentQuest.explanation && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3">
                          <Lightbulb className="text-green-500 shrink-0 mt-1" size={20} />
                          <div>
                            <p className="text-sm font-bold text-green-500 mb-1">조언의 힌트 (해설 일부)</p>
                            <p className="text-sm text-green-400/80">{currentQuest.explanation.substring(0, Math.floor(currentQuest.explanation.length / 2))}...</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Item Bar */}
                  {!isAnswered && profile?.inventory && (
                    <div className="mt-8 p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center gap-4">
                      <button
                        onClick={() => handleUseItem('magnifier')}
                        disabled={!profile.inventory.magnifier || currentQuest.type !== 'multiple-choice'}
                        className="relative p-3 bg-slate-800/50 hover:bg-cyber-blue/20 border border-white/10 hover:border-cyber-blue/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
                      >
                        <Search className="text-cyber-blue" size={24} />
                        <span className="absolute -top-2 -right-2 bg-cyber-blue text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {profile.inventory.magnifier || 0}
                        </span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          돋보기 (오답 1개 제거)
                        </div>
                      </button>
                      <button
                        onClick={() => handleUseItem('mirror')}
                        disabled={!profile.inventory.mirror}
                        className="relative p-3 bg-slate-800/50 hover:bg-cyber-purple/20 border border-white/10 hover:border-cyber-purple/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
                      >
                        <Eye className="text-cyber-purple" size={24} />
                        <span className="absolute -top-2 -right-2 bg-cyber-purple text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {profile.inventory.mirror || 0}
                        </span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          거울 (키워드 힌트)
                        </div>
                      </button>
                      <button
                        onClick={() => handleUseItem('hourglass')}
                        disabled={!profile.inventory.hourglass}
                        className="relative p-3 bg-slate-800/50 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
                      >
                        <Hourglass className="text-yellow-500" size={24} />
                        <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {profile.inventory.hourglass || 0}
                        </span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          모래시계 (시간 +30초)
                        </div>
                      </button>
                      <button
                        onClick={() => handleUseItem('advice')}
                        disabled={!profile.inventory.advice}
                        className="relative p-3 bg-slate-800/50 hover:bg-green-500/20 border border-white/10 hover:border-green-500/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
                      >
                        <Lightbulb className="text-green-500" size={24} />
                        <span className="absolute -top-2 -right-2 bg-green-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {profile.inventory.advice || 0}
                        </span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          조언 (해설 힌트)
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Next Button */}
                  {isAnswered && isCorrect && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
                      <button 
                        onClick={handleNextQuest}
                        className="w-full py-6 cyber-button cyber-button-primary text-xl font-black uppercase tracking-widest italic"
                      >
                        {isLastQuest ? '미션 완료' : '다음 퀘스트'}
                      </button>
                    </motion.div>
                  )}
                  {isAnswered && !isCorrect && (
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                     <button 
                       onClick={handleRetry}
                       className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-2"
                     >
                       <RefreshCw size={18} /> 다시 시도하기
                     </button>
                   </motion.div>
                  )}
                  <div className="scanline" />
                </div>
              </motion.div>
            )}

            {currentStep === 'result' && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
                <div className="cyber-card p-12 hologram-border text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-cyber-blue" />
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyber-blue/10 rounded-full blur-3xl" />
                  
                  <motion.div 
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="w-28 h-28 bg-gradient-to-br from-cyber-blue to-cyber-purple rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(0,242,255,0.4)] text-black"
                  >
                    <Award size={56} />
                  </motion.div>
                  
                  <h2 className="text-5xl font-black text-white mb-4 tracking-tighter italic neon-text-blue">퀘스트 클리어!</h2>
                  <p className="text-slate-400 text-lg mb-12 font-medium">모든 전술적 통신 목표를 달성했습니다.</p>

                  <div className="space-y-4">
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cyber-blue/10 rounded-xl flex items-center justify-center text-cyber-blue border border-cyber-blue/30 shadow-[0_0_10px_rgba(0,242,255,0.2)]">
                          <Star size={24} fill="currentColor" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">획득한 보상</p>
                          <p className="text-xl font-black text-white leading-none">+{scenario.quests.length * 10} EXP</p>
                        </div>
                      </div>
                      <div className="h-10 w-[1px] bg-white/10" />
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">유능감 지수</p>
                        <p className="text-xl font-black text-cyber-purple leading-none">+{scenario.quests.length * 5} CI</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => { playSound('WHOOSH'); onNextStage(scenario.id); }} 
                      className="w-full py-6 cyber-button cyber-button-primary text-xl font-black uppercase tracking-widest italic mb-4"
                    >
                      다음 스테이지로 이동
                    </button>
                    <button onClick={() => { playSound('WHOOSH'); onBack(); }} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-lg font-bold uppercase tracking-widest transition-colors">
                      월드 맵으로 귀환
                    </button>
                  </div>
                  <div className="scanline" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Schoolping Overlay */}
      <AnimatePresence>
        {showSchoolping && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-xl w-full cyber-card p-10 hologram-border relative"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-cyber-purple rounded-full flex items-center justify-center shadow-[0_0_30px_#7000FF] border-4 border-black">
                <Camera size={40} className="text-white" />
              </div>
              
              <div className="text-center mt-8 mb-8">
                <h2 className="text-3xl font-black text-white mb-2 italic neon-text-purple">스쿨핑 미션 해제!</h2>
                <p className="text-cyber-blue font-bold tracking-widest uppercase text-sm">Real-world Cooperative Mission</p>
              </div>
              
              <div className="bg-white/5 border border-white/10 p-6 rounded-xl mb-8">
                <h3 className="text-xl font-bold text-white mb-4">현실 세계에서 배운 화법을 실천하세요!</h3>
                <p className="text-slate-300 leading-relaxed">
                  보스 스테이지를 클리어한 당신에게 특별한 임무가 주어졌습니다. 
                  주변 친구나 가족에게 배운 대화법을 사용해보고, 그 순간을 사진으로 남겨 인증하세요.
                </p>
              </div>

              <button 
                onClick={handleSchoolpingComplete}
                className="w-full py-5 bg-cyber-purple text-white rounded-xl font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-[0_0_20px_rgba(112,0,255,0.4)]"
              >
                미션 수락 및 보상 확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              className="text-center"
            >
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-40 h-40 bg-gradient-to-tr from-cyber-blue via-cyber-purple to-cyber-pink rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_80px_#00F2FF] p-1"
              >
                <div className="w-full h-full bg-black rounded-full flex items-center justify-center border-4 border-cyber-blue">
                  <Award size={80} className="text-cyber-blue" />
                </div>
              </motion.div>
              <h1 className="text-6xl font-black text-white mb-4 tracking-tighter italic neon-text-blue">
                STAGE CLEAR!
              </h1>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/10 border border-cyber-blue/50 px-8 py-4 rounded-3xl backdrop-blur-md inline-block max-w-md"
              >
                <p className="text-3xl text-cyber-blue font-black uppercase tracking-widest mb-2">
                  🏆 유능감 배지 획득!
                </p>
                <p className="text-sm text-slate-300 font-medium">
                  에릭슨의 심리사회적 발달 이론에 따라, 당신은 이번 스테이지를 통해 또래와 협동하며 성취감을 느끼고 '유능감(Competence)'을 획득했습니다.
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* World Clear Overlay */}
      <AnimatePresence>
        {showWorldClearOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-xl w-full cyber-card p-10 hologram-border relative text-center"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_30px_#f59e0b] border-4 border-black">
                <Star size={40} className="text-white" />
              </div>
              
              <div className="mt-8 mb-8">
                <h2 className="text-4xl font-black text-white mb-2 italic neon-text-blue">월드 클리어!</h2>
                <p className="text-amber-500 font-bold tracking-widest uppercase text-lg">새로운 월드가 열렸습니다</p>
              </div>
              
              <div className="bg-white/5 border border-white/10 p-6 rounded-xl mb-8">
                <p className="text-slate-300 leading-relaxed text-lg">
                  축하합니다! 이 월드의 모든 미션을 성공적으로 완수했습니다.
                  이제 다음 월드로 나아가 더 큰 도전을 맞이하세요.
                </p>
              </div>

              <button 
                onClick={handleWorldClearComplete}
                className="w-full py-5 bg-amber-500 text-black rounded-xl font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)]"
              >
                계속하기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExpAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, y: -50 }}
            transition={{ type: 'spring', damping: 12, duration: 0.5 }}
            className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
          >
            <div className="relative flex flex-col items-center">
              <div className="absolute inset-0 bg-cyber-blue blur-[100px] opacity-30 rounded-full" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute w-64 h-64 border-4 border-dashed border-cyber-blue/50 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute w-48 h-48 border-4 border-dotted border-cyber-purple/50 rounded-full"
              />
              <div className="relative z-10 bg-black/80 backdrop-blur-xl border-2 border-cyber-blue p-8 rounded-3xl shadow-[0_0_50px_rgba(0,242,255,0.5)] text-center">
                <Sparkles className="text-cyber-blue w-16 h-16 mx-auto mb-4 animate-pulse" />
                <h2 className="text-5xl font-black text-white italic tracking-tighter mb-2 neon-text-blue">정답!</h2>
                <p className="text-3xl font-black text-cyber-blue">+10 EXP 획득!</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
