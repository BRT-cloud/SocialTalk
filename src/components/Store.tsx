import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Eye, Hourglass, MessageSquarePlus, Coins, ShoppingCart, Sparkles, Lightbulb } from 'lucide-react';
import { useSound } from '../hooks/useSound';

interface StoreProps {
  profile: UserProfile | null;
}

const STORE_ITEMS = [
  {
    id: 'magnifier',
    name: '돋보기',
    description: '객관식 문제에서 오답 1개를 제거합니다.',
    price: 30,
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/30'
  },
  {
    id: 'mirror',
    name: '거울',
    description: '문제의 핵심 키워드 힌트를 제공합니다.',
    price: 20,
    icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/30'
  },
  {
    id: 'hourglass',
    name: '모래시계',
    description: '퀘스트 제한 시간을 30초 연장합니다.',
    price: 15,
    icon: Hourglass,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30'
  },
  {
    id: 'advice',
    name: '조언',
    description: '해설의 일부를 미리 확인합니다.',
    price: 40,
    icon: Lightbulb,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30'
  }
];

export default function Store({ profile }: StoreProps) {
  const { playSound } = useSound();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  const handlePurchase = async (itemId: string, price: number) => {
    if (!profile || profile.wisdom < price || purchasing) return;
    
    playSound('WHOOSH');
    setPurchasing(itemId);
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        wisdom: increment(-price),
        [`inventory.${itemId}`]: increment(1)
      });
      
      playSound('SUCCESS');
      setPurchaseSuccess(itemId);
      setTimeout(() => setPurchaseSuccess(null), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 italic tracking-tighter neon-text-blue">
            전략 상점
          </h1>
          <p className="text-slate-400 text-lg">
            지혜 포인트(WP)를 사용하여 퀘스트를 유리하게 이끌 소모품을 구매하세요.
          </p>
        </div>
        
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl flex items-center gap-6 shadow-[0_0_30px_rgba(112,0,255,0.15)]">
          <div className="w-12 h-12 bg-cyber-purple/20 rounded-xl flex items-center justify-center text-cyber-purple border border-cyber-purple/30">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">보유 지혜 포인트</p>
            <p className="text-3xl font-black text-white">{profile?.wisdom?.toLocaleString() || 0} <span className="text-cyber-purple text-xl">WP</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {STORE_ITEMS.map((item) => {
          const Icon = item.icon;
          const canAfford = (profile?.wisdom || 0) >= item.price;
          const ownedCount = profile?.inventory?.[item.id as keyof typeof profile.inventory] || 0;
          
          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`relative bg-[#0a0a0a]/80 backdrop-blur-2xl border-2 ${item.border} p-8 rounded-[2.5rem] overflow-hidden group shadow-2xl flex flex-col h-full`}
            >
              <div className={`absolute top-0 right-0 w-40 h-40 ${item.bg} rounded-full blur-[80px] -mr-20 -mt-20 transition-opacity group-hover:opacity-100 opacity-40`} />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-8">
                  <div className={`w-16 h-16 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center border-2 ${item.border} shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon size={32} />
                  </div>
                  <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-black text-slate-300 uppercase tracking-widest shadow-inner">
                    보유: {ownedCount}
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight">{item.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
                    {item.description}
                  </p>
                </div>
                
                <button
                  onClick={() => handlePurchase(item.id, item.price)}
                  disabled={!canAfford || purchasing === item.id}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all ${
                    canAfford 
                      ? 'bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white border border-white/20 hover:border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                      : 'bg-slate-900/50 text-slate-600 border border-slate-800/50 cursor-not-allowed'
                  }`}
                >
                  {purchasing === item.id ? (
                    <span className="animate-pulse">처리 중...</span>
                  ) : purchaseSuccess === item.id ? (
                    <span className="text-emerald-400 flex items-center gap-2">
                      <Sparkles size={16} />
                      구매 완료
                    </span>
                  ) : (
                    <>
                      <ShoppingCart size={18} className={canAfford ? 'text-cyber-blue' : ''} />
                      <span className="flex items-baseline gap-1">
                        {item.price} <span className="text-[8px] opacity-60">WP</span>
                      </span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
