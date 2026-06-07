import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Award, TrendingUp, Users, BookOpen, Calendar, Brain, Zap, Shield, Heart, Star, Sparkles, Sword, Crown, CheckCircle2, XCircle } from 'lucide-react';

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;
      
      let q;
      if (profile.role === 'admin') {
        q = query(collection(db, 'attempts'), orderBy('timestamp', 'desc'), limit(10));
      } else {
        q = query(
          collection(db, 'attempts'), 
          where('uid', '==', profile.uid),
          orderBy('timestamp', 'desc'), 
          limit(10)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const attempts = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setRecentAttempts(attempts);
      setLoading(false);
    }
    fetchData();
  }, [profile]);

  const getTitle = (level: number) => {
    if (level >= 20) return '전설의 현자';
    if (level >= 15) return '소통의 마스터';
    if (level >= 10) return '협상의 전문가';
    if (level >= 5) return '소셜 모험가';
    return '초보 대화꾼';
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-[#050505] min-h-full pb-20">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Character Card */}
        <div className="lg:w-1/3 space-y-8">
          <div className="bg-[#0a0a0a] rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-110 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-16 -mb-16 opacity-50 blur-3xl" />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="relative mb-6">
                <motion.div 
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute -inset-6 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400 rounded-[3rem] opacity-20 blur-2xl"
                />
                <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[2.5rem] flex items-center justify-center text-white text-5xl font-black shadow-[0_0_40px_rgba(16,185,129,0.4)] relative z-10 rotate-3 border-2 border-white/20">
                  {profile?.displayName?.[0] || 'S'}
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-white shadow-xl border-4 border-[#0a0a0a] z-20">
                  <Crown size={24} />
                </div>
              </div>

              <h2 className="text-4xl font-black text-white mb-2 tracking-tighter neon-text-blue drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]">{profile?.displayName}</h2>
              <div className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 mb-8 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Sword size={16} />
                <span className="font-black uppercase tracking-widest text-[11px]">{getTitle(profile?.level || 1)}</span>
              </div>
              
              <div className="w-full space-y-4">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">레벨 {profile?.level}</span>
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">{(profile?.exp || 0) % 100} / 100 XP</span>
                </div>
                <div className="w-full bg-white/5 h-8 rounded-full overflow-hidden border border-white/10 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(profile?.exp || 0) % 100}%` }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.6)]" 
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-blue-400" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">지혜</p>
                </div>
                <p className="text-3xl font-black text-blue-400 tracking-tighter drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]">{profile?.wisdom || 0} <span className="text-xs opacity-50">WP</span></p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} className="text-amber-400" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">총 경험치</p>
                </div>
                <p className="text-3xl font-black text-amber-400 tracking-tighter drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">{profile?.exp || 0}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all col-span-2 flex items-center justify-between shadow-lg">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-emerald-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">유능감 지수 (CI)</p>
                  </div>
                  <p className="text-4xl font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">{profile?.competenceIndex || 0}</p>
                </div>
                <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <TrendingUp size={28} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quests & History */}
        <div className="lg:flex-1 space-y-8">
          <div className="bg-[#0a0a0a] rounded-[2.5rem] p-8 shadow-2xl border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-white flex items-center gap-4 text-xl tracking-tight">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <Award size={20} />
                </div>
                수집한 배지
              </h3>
              <span className="px-4 py-1.5 bg-white/5 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest border border-white/10">
                {profile?.badges.length}개 획득
              </span>
            </div>
            <div className="flex flex-wrap gap-6">
              {profile?.badges.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
                  <Award size={48} className="text-white/10 mb-4" />
                  <p className="text-slate-500 font-black text-sm">아직 수집한 배지가 없습니다. 모험을 시작하세요!</p>
                </div>
              ) : (
                profile?.badges.map((badge, i) => {
                  const isCompetence = badge.startsWith('competence-stage-');
                  const stageNum = isCompetence ? badge.split('-')[2] : '';
                  
                  return (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border border-white/10 shadow-xl relative group ${
                        isCompetence 
                          ? 'bg-gradient-to-br from-cyber-blue/10 to-cyber-purple/10 text-cyber-blue' 
                          : 'bg-gradient-to-br from-amber-400/10 to-orange-400/10 text-amber-500'
                      }`}
                      title={isCompetence ? `스테이지 ${stageNum} 유능감 배지` : badge}
                    >
                      <Award size={28} />
                      {isCompetence && (
                        <span className="text-[8px] font-black mt-1">STAGE {stageNum}</span>
                      )}
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-[#0a0a0a] shadow-lg scale-0 group-hover:scale-100 transition-transform">
                        <Star size={10} fill="currentColor" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-[#0a0a0a] rounded-[2.5rem] p-8 shadow-2xl border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-white flex items-center gap-4 text-xl tracking-tight">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                  <BookOpen size={20} />
                </div>
                퀘스트 로그
              </h3>
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">최근 활동</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {recentAttempts.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
                  <BookOpen size={48} className="text-white/10 mb-4" />
                  <p className="text-slate-500 font-black text-sm">아직 완료한 퀘스트가 없습니다.</p>
                </div>
              ) : (
                recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="group flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:shadow-xl hover:border-emerald-500/30 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500 shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-all group-hover:rotate-6">
                        <Star size={20} fill="currentColor" />
                      </div>
                      <div>
                        <p className="font-black text-white text-lg leading-none mb-1">{attempt.scenarioId}</p>
                        <p className="text-xs text-slate-500 font-bold truncate max-w-[150px] md:max-w-xs italic">"{attempt.userInput}"</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-emerald-400 leading-none tracking-tighter">
                        {attempt.scores ? (((attempt.scores.clarity || 0) + (attempt.scores.emotionalAuthenticity || 0) + (attempt.scores.skillApplication || 0)) / 3).toFixed(0) : (attempt.isCorrect ? '100' : '0')}
                      </p>
                      <p className="text-[8px] text-slate-600 uppercase font-black tracking-widest mt-1">점수</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Dashboard (Admin Only) */}
      {profile?.role === 'admin' && (
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0a0a0a] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border border-white/5"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full -mr-48 -mt-48 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-6 mb-10">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] rotate-6">
                <Users size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tighter">길드 마스터 대시보드</h2>
                <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px] mt-1">교사 관리 및 인사이트</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <AdminStat label="활성 학생" value="24" icon={<Users size={20} />} />
              <AdminStat label="학급 진행도" value="68%" icon={<TrendingUp size={20} />} />
              <AdminStat label="오늘의 퀘스트" value="156" icon={<Zap size={20} />} />
            </div>

            <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-emerald-400 uppercase tracking-widest text-[10px]">최근 학생 인사이트</h3>
                <button className="text-[9px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors">모든 로그 보기</button>
              </div>
              <div className="space-y-4">
                {recentAttempts.slice(0, 5).map((attempt, i) => (
                  <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black text-sm group-hover:scale-110 transition-transform border border-emerald-500/20">
                        {i + 1}
                      </div>
                      <p className="text-base text-white/70 italic font-medium truncate max-w-[200px] md:max-w-md">"{attempt.userInput}"</p>
                    </div>
                    <div className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black text-white/30 uppercase tracking-widest border border-white/10">
                      {attempt.scenarioId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AdminStat({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 hover:bg-white/10 transition-all hover:-translate-y-1 group">
      <div className="flex items-center gap-3 mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
        {icon}
        <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-4xl font-black tracking-tighter text-white">{value}</p>
    </div>
  );
}
