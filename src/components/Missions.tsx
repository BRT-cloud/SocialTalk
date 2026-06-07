import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, getDoc, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Star, Sparkles, Target, AlertCircle } from 'lucide-react';
import { useSound } from '../hooks/useSound';

interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
}

const DAILY_MISSIONS: Mission[] = [
  { id: 'm1', title: '눈맞춤 인사', description: '오늘 만나는 사람 3명에게 눈을 맞추며 인사하기', reward: 50 },
  { id: 'm2', title: '정중한 거절', description: '친구의 제안을 "미안하지만 지금은 어려워"라고 부드럽게 거절해보기', reward: 100 },
  { id: 'm3', title: '경청의 자세', description: '상대방이 말할 때 고개를 2번 이상 끄덕이며 들어주기', reward: 80 },
  { id: 'm4', title: '나-전달법 사용', description: '"너 왜 그래?" 대신 "나는 ~해서 속상해"라고 내 마음 표현하기', reward: 150 },
  { id: 'm5', title: '먼저 건네는 칭찬', description: '주변 사람에게 구체적인 칭찬 1가지 건네기 (예: "오늘 목소리가 밝아 보여")', reward: 120 },
  { id: 'm6', title: '키오스크 도전', description: '편의점이나 식당에서 스스로 주문해보기 (지역사회 자립)', reward: 200 },
];

interface MissionsProps {
  profile: UserProfile | null;
}

export default function Missions({ profile }: MissionsProps) {
  const [completedMissions, setCompletedMissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmMission, setConfirmMission] = useState<Mission | null>(null);
  const [completing, setCompleting] = useState(false);
  const { playSound } = useSound();

  const getTodayString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    async function fetchCompletedMissions() {
      if (!profile) return;
      const today = getTodayString();
      
      try {
        const q = query(
          collection(db, 'user_missions'),
          where('uid', '==', profile.uid),
          where('date', '==', today)
        );
        const snapshot = await getDocs(q);
        const completed = snapshot.docs.map(doc => doc.data().missionId);
        setCompletedMissions(completed);
      } catch (error) {
        console.error("Failed to fetch missions", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCompletedMissions();
  }, [profile]);

  const handleComplete = async () => {
    if (!profile || !confirmMission || completing) return;
    
    setCompleting(true);
    const today = getTodayString();
    const missionId = confirmMission.id;
    const docId = `${profile.uid}_${missionId}_${today}`;
    
    try {
      // Check if already completed
      const missionRef = doc(db, 'user_missions', docId);
      const missionSnap = await getDoc(missionRef);
      
      if (!missionSnap.exists()) {
        // Add to user_missions
        await setDoc(missionRef, {
          uid: profile.uid,
          missionId: missionId,
          date: today,
          timestamp: new Date().toISOString(),
          reward: confirmMission.reward
        });
        
        // Update user wisdom
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
          wisdom: increment(confirmMission.reward)
        });
        
        setCompletedMissions(prev => [...prev, missionId]);
        playSound('SUCCESS');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'user_missions');
    } finally {
      setCompleting(false);
      setConfirmMission(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">로딩 중...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 bg-[#050505] min-h-full pb-20">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500 rounded-xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <Target size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter neon-text-blue">오늘의 미션</h2>
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">현실 세계의 소셜 퀘스트</p>
        </div>
      </div>

      <div className="grid gap-4">
        {DAILY_MISSIONS.map(mission => {
          const isCompleted = completedMissions.includes(mission.id);
          
          return (
            <div 
              key={mission.id}
              className={`p-6 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isCompleted 
                  ? 'bg-emerald-900/20 border-emerald-500/30 opacity-70' 
                  : 'bg-[#0a0a0a] border-white/10 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className={`text-xl font-black tracking-tight ${isCompleted ? 'text-emerald-400' : 'text-white'}`}>
                    {mission.title}
                  </h3>
                  <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-md text-xs font-bold flex items-center gap-1 border border-amber-500/20">
                    <Star size={12} fill="currentColor" />
                    {mission.reward} WP
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{mission.description}</p>
              </div>
              
              <div>
                {isCompleted ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-bold px-4 py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 size={20} />
                    <span>수행 완료</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      playSound('WHOOSH');
                      setConfirmMission(mission);
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-[#050505] font-black rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    수행 완료
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmMission && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 mx-auto border border-emerald-500/30">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-black text-white text-center mb-2">정말 수행하셨나요?</h3>
              <p className="text-slate-400 text-center text-sm mb-8">
                <span className="text-emerald-400 font-bold">"{confirmMission.title}"</span> 미션을 현실에서 완료했다면 '네'를 눌러주세요.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    playSound('WHOOSH');
                    setConfirmMission(null);
                  }}
                  disabled={completing}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  아니오
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 py-3 rounded-xl font-black text-[#050505] bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center"
                >
                  {completing ? '처리 중...' : '네, 완료했어요!'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
