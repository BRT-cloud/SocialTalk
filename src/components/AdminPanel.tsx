import React, { useState } from 'react';
import { UserProfile, Scenario } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment, getDoc, deleteDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { INITIAL_SCENARIOS } from '../constants';
import { AlertTriangle, Unlock, Coins, Database, Edit2, Save, X, Trash2, RefreshCw, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { getGoogleAccessToken, createScenarioSpreadsheet } from '../googleSheets';

interface AdminPanelProps {
  profile: UserProfile | null;
  scenarios: Scenario[];
}

export default function AdminPanel({ profile, scenarios }: AdminPanelProps) {
  const { playSound } = useSound();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [unlockConfirm, setUnlockConfirm] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editForm, setEditForm] = useState({ 
    situation: '', 
    quests: [] as any[] 
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSpreadsheetId, setExportSpreadsheetId] = useState<string | null>(null);

  const handleExportToSheets = async () => {
    setExportLoading(true);
    setExportSpreadsheetId(null);
    try {
      const token = await getGoogleAccessToken();
      const spreadsheetId = await createScenarioSpreadsheet(token, scenarios);
      setExportSpreadsheetId(spreadsheetId);
      playSound('SUCCESS');
      showNotification('구글 스프레드시트 발행 성공!');
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : String(error);
      showNotification(`내보내기 오류: ${errMsg}`, 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  if (!profile) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center text-red-500 p-8">
        <div className="text-center space-y-4">
          <AlertTriangle size={64} className="mx-auto animate-pulse" />
          <h1 className="text-2xl font-black tracking-widest">ACCESS DENIED</h1>
          <p className="text-sm">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  const handleUnlockAll = async () => {
    setLoading(true);
    try {
      const allStageIds = INITIAL_SCENARIOS.map(s => s.id);
      await updateDoc(doc(db, 'users', profile.uid), {
        clearedStages: allStageIds,
        unlockedStages: allStageIds
      });
      playSound('SUCCESS');
      showNotification('모든 스테이지가 해제되었습니다.');
      setUnlockConfirm(false);
    } catch (error) {
      showNotification('해제 중 오류가 발생했습니다.', 'error');
      handleFirestoreError(error, OperationType.UPDATE, 'users', profile.uid);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWP = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        wisdom: increment(10000)
      });
      playSound('SUCCESS');
      showNotification('10,000 WP가 지급되었습니다.');
    } catch (error) {
      showNotification('포인트 지급 중 오류가 발생했습니다.', 'error');
      handleFirestoreError(error, OperationType.UPDATE, 'users', profile.uid);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (scenario: Scenario) => {
    setEditingId(scenario.id);
    setEditForm({
      situation: scenario.situation,
      quests: scenario.quests.map(q => ({
        question: q.question,
        correctAnswer: q.correctAnswer
      }))
    });
  };

  const handleSaveEdit = async (scenarioId: string) => {
    try {
      setLoading(true);
      const scenarioRef = doc(db, 'scenarios', scenarioId);
      const scenarioSnap = await getDoc(scenarioRef);
      if (scenarioSnap.exists()) {
        const data = scenarioSnap.data() as Scenario;
        const updatedQuests = data.quests.map((q, index) => {
          if (editForm.quests[index]) {
            return {
              ...q,
              question: editForm.quests[index].question,
              correctAnswer: editForm.quests[index].correctAnswer,
              options: editForm.quests[index].options || q.options,
              optionExplanations: editForm.quests[index].optionExplanations || q.optionExplanations,
              explanation: editForm.quests[index].explanation || q.explanation,
              hint: editForm.quests[index].hint || q.hint
            };
          }
          return q;
        });

        await updateDoc(scenarioRef, {
          situation: editForm.situation,
          quests: updatedQuests
        });
        playSound('SUCCESS');
        showNotification('스테이지가 수정되었습니다.');
        setEditingId(null);
      }
    } catch (error) {
      showNotification('수정 중 오류가 발생했습니다.', 'error');
      handleFirestoreError(error, OperationType.UPDATE, 'scenarios', scenarioId);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scenarioId: string) => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'scenarios', scenarioId));
      playSound('SUCCESS');
      showNotification('스테이지가 삭제되었습니다.');
      setDeleteConfirmId(null);
    } catch (error) {
      showNotification('삭제 중 오류가 발생했습니다.', 'error');
      handleFirestoreError(error, OperationType.DELETE, 'scenarios', scenarioId);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    try {
      setLoading(true);
      
      // 1. Clear existing scenarios
      const snapshot = await getDocs(collection(db, 'scenarios'));
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // 2. Re-initialize from INITIAL_SCENARIOS
      for (const scenario of INITIAL_SCENARIOS) {
        await setDoc(doc(db, 'scenarios', scenario.id), scenario);
      }
      
      playSound('SUCCESS');
      showNotification('데이터베이스가 초기화되었습니다.');
      setResetConfirm(false);
    } catch (error) {
      showNotification('초기화 중 오류가 발생했습니다.', 'error');
      handleFirestoreError(error, OperationType.WRITE, 'scenarios', 'reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-[#050000] text-red-500 p-4 md:p-8 space-y-8 font-mono pb-24 relative">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-2xl border animate-in slide-in-from-right duration-300 ${
          notification.type === 'success' ? 'bg-green-900/90 border-green-500 text-green-100' : 'bg-red-900/90 border-red-500 text-red-100'
        }`}>
          {notification.message}
        </div>
      )}
      <div className="border-b-2 border-red-900 pb-4 flex items-center gap-4">
        <AlertTriangle size={32} className="text-red-600 animate-pulse" />
        <div>
          <h1 className="text-3xl font-black tracking-widest text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">ADMIN MODE</h1>
          <p className="text-[10px] text-red-400/70 tracking-[0.2em] uppercase">System Override Active</p>
        </div>
        <span className="ml-auto text-xs bg-red-900/30 px-3 py-1 rounded-full text-red-400 border border-red-800 shadow-[0_0_10px_rgba(220,38,38,0.2)]">
          RESTRICTED ACCESS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(220,38,38,0.05)]">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
            <Unlock size={20} /> 스테이지 마스터 제어
          </h2>
          <p className="text-sm text-red-400/70">월드 맵의 모든 스테이지를 즉시 활성화합니다.</p>
          {unlockConfirm ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-200">
              <p className="text-sm text-red-400 font-bold text-center">정말 모든 스테이지를 해제할까요?</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleUnlockAll}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
                >
                  확인
                </button>
                <button 
                  onClick={() => setUnlockConfirm(false)}
                  disabled={loading}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setUnlockConfirm(true)}
              disabled={loading}
              className="w-full py-3 bg-red-900/40 hover:bg-red-800/80 text-red-100 font-bold rounded-xl border border-red-700/50 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)]"
            >
              {loading ? '처리 중...' : '모든 스테이지 해제'}
            </button>
          )}
        </div>

        <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(220,38,38,0.05)]">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
            <Coins size={20} /> 치트 및 테스트
          </h2>
          <p className="text-sm text-red-400/70">테스트용 지혜 포인트(WP)를 즉시 지급합니다.</p>
          <button 
            onClick={handleAddWP}
            disabled={loading}
            className="w-full py-3 bg-red-900/40 hover:bg-red-800/80 text-red-100 font-bold rounded-xl border border-red-700/50 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)]"
          >
            {loading ? '처리 중...' : '포인트 지급 (+10,000 WP)'}
          </button>
        </div>

        <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(220,38,38,0.05)]">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
            <RefreshCw size={20} /> DB 초기화
          </h2>
          <p className="text-sm text-red-400/70">모든 스테이지 데이터를 기본값으로 복구합니다.</p>
          {resetConfirm ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-200">
              <p className="text-sm text-red-400 font-bold text-center">정말 초기화하시겠습니까? 모든 데이터가 사라집니다.</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleResetDatabase}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
                >
                  확인
                </button>
                <button 
                  onClick={() => setResetConfirm(false)}
                  disabled={loading}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setResetConfirm(true)}
              disabled={loading}
              className="w-full py-3 bg-red-950/60 hover:bg-red-900/80 text-red-500 hover:text-red-300 font-bold rounded-xl border border-red-900/50 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)]"
            >
              {loading ? '처리 중...' : '데이터베이스 초기화'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl space-y-4 overflow-hidden flex flex-col h-[600px] shadow-[0_0_20px_rgba(220,38,38,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-red-900/30 pb-3">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
            <Database size={20} /> 데이터 전체 보기 ({scenarios.length} Stages)
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {exportSpreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${exportSpreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-950/30 border border-green-500 text-green-400 hover:text-green-300 rounded-lg text-xs font-bold transition-all shadow-[0_0_10px_rgba(34,197,94,0.1)] shrink-0 animate-pulse"
              >
                <ExternalLink size={14} /> 스프레드시트 열기 (확인)
              </a>
            )}
            <button
              onClick={handleExportToSheets}
              disabled={exportLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shrink-0 ${
                exportLoading
                  ? 'bg-red-950/20 border-red-900/50 text-red-500/50 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)] hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]'
              }`}
            >
              <FileSpreadsheet size={14} />
              {exportLoading ? '내보내는 중...' : '구글 스프레드시트로 내보내기'}
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1 border border-red-900/30 rounded-xl bg-black/50 custom-scrollbar">
          <table className="w-full text-left text-sm text-red-400/80">
            <thead className="bg-red-950/80 text-red-300 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-4 border-b border-red-900/50 w-24 font-bold">ID</th>
                <th className="p-4 border-b border-red-900/50 w-40 font-bold">제목</th>
                <th className="p-4 border-b border-red-900/50 min-w-[300px] font-bold">상황 설명 (Situation)</th>
                <th className="p-4 border-b border-red-900/50 min-w-[400px] font-bold">문제 및 정답 (Quests)</th>
                <th className="p-4 border-b border-red-900/50 w-32 font-bold text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {scenarios.map(scenario => (
                <tr key={scenario.id} className="hover:bg-red-900/10 transition-colors">
                  <td className="p-4 align-top font-mono text-red-500/60">{scenario.id}</td>
                  <td className="p-4 align-top font-bold text-red-300">{scenario.title}</td>
                  
                  {editingId === scenario.id ? (
                    <>
                      <td className="p-4 align-top">
                        <textarea 
                          value={editForm.situation}
                          onChange={(e) => setEditForm(prev => ({ ...prev, situation: e.target.value }))}
                          className="w-full bg-black/50 border border-red-900/50 rounded p-2 text-red-200 min-h-[120px] focus:outline-none focus:border-red-500 text-xs"
                        />
                      </td>
                      <td className="p-4 align-top">
                        <div className="space-y-4">
                          {editForm.quests.map((quest, idx) => (
                            <div key={idx} className="p-3 bg-red-950/30 border border-red-900/30 rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Quest {idx + 1}</span>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-red-400/60 uppercase font-bold">Question</label>
                                <textarea 
                                  value={quest.question}
                                  onChange={(e) => {
                                    const newQuests = [...editForm.quests];
                                    newQuests[idx].question = e.target.value;
                                    setEditForm(prev => ({ ...prev, quests: newQuests }));
                                  }}
                                  className="w-full bg-black/50 border border-red-900/50 rounded p-2 text-red-200 min-h-[60px] focus:outline-none focus:border-red-500 text-xs"
                                />
                              </div>
                              
                              {quest.type === 'multiple-choice' && quest.options && (
                                <div className="space-y-2">
                                  <label className="text-[10px] text-red-400/60 uppercase font-bold">Options & Explanations</label>
                                  {quest.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="space-y-1 pl-2 border-l border-red-900/30">
                                      <input 
                                        type="text"
                                        value={opt}
                                        placeholder={`Option ${optIdx + 1}`}
                                        onChange={(e) => {
                                          const newQuests = [...editForm.quests];
                                          const newOptions = [...(newQuests[idx].options || [])];
                                          newOptions[optIdx] = e.target.value;
                                          newQuests[idx].options = newOptions;
                                          setEditForm(prev => ({ ...prev, quests: newQuests }));
                                        }}
                                        className="w-full bg-black/50 border border-red-900/50 rounded p-1.5 text-red-200 focus:outline-none focus:border-red-500 text-xs"
                                      />
                                      <textarea 
                                        value={quest.optionExplanations?.[optIdx] || ''}
                                        placeholder={`Explanation for Option ${optIdx + 1}`}
                                        onChange={(e) => {
                                          const newQuests = [...editForm.quests];
                                          const newOptionExplanations = [...(newQuests[idx].optionExplanations || ['', '', '', ''])];
                                          newOptionExplanations[optIdx] = e.target.value;
                                          newQuests[idx].optionExplanations = newOptionExplanations;
                                          setEditForm(prev => ({ ...prev, quests: newQuests }));
                                        }}
                                        className="w-full bg-black/50 border border-red-900/50 rounded p-1.5 text-red-200 min-h-[40px] focus:outline-none focus:border-red-500 text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="space-y-1">
                                <label className="text-[10px] text-red-400/60 uppercase font-bold">Correct Answer</label>
                                <input 
                                  type="text"
                                  value={quest.correctAnswer}
                                  onChange={(e) => {
                                    const newQuests = [...editForm.quests];
                                    newQuests[idx].correctAnswer = e.target.value;
                                    setEditForm(prev => ({ ...prev, quests: newQuests }));
                                  }}
                                  className="w-full bg-black/50 border border-red-900/50 rounded p-2 text-red-200 focus:outline-none focus:border-red-500 text-xs"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[10px] text-red-400/60 uppercase font-bold">General Explanation</label>
                                <textarea 
                                  value={quest.explanation || ''}
                                  onChange={(e) => {
                                    const newQuests = [...editForm.quests];
                                    newQuests[idx].explanation = e.target.value;
                                    setEditForm(prev => ({ ...prev, quests: newQuests }));
                                  }}
                                  className="w-full bg-black/50 border border-red-900/50 rounded p-2 text-red-200 min-h-[60px] focus:outline-none focus:border-red-500 text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] text-red-400/60 uppercase font-bold">Hint (Mirror Item)</label>
                                <input 
                                  type="text"
                                  value={quest.hint || ''}
                                  onChange={(e) => {
                                    const newQuests = [...editForm.quests];
                                    newQuests[idx].hint = e.target.value;
                                    setEditForm(prev => ({ ...prev, quests: newQuests }));
                                  }}
                                  className="w-full bg-black/50 border border-red-900/50 rounded p-2 text-red-200 focus:outline-none focus:border-red-500 text-xs"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 align-top text-center space-y-2">
                        <button 
                          onClick={() => handleSaveEdit(scenario.id)}
                          disabled={loading}
                          className="w-full py-2 bg-emerald-900/40 hover:bg-emerald-800/80 text-emerald-400 rounded border border-emerald-700/50 flex items-center justify-center gap-1 font-bold"
                        >
                          <Save size={14} /> 저장
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          disabled={loading}
                          className="w-full py-2 bg-red-900/40 hover:bg-red-800/80 text-red-400 rounded border border-red-700/50 flex items-center justify-center gap-1 font-bold"
                        >
                          <X size={14} /> 취소
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 align-top text-red-200/80 leading-relaxed text-xs">
                        <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {scenario.situation}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                          {scenario.quests.map((quest, idx) => (
                            <div key={idx} className="text-xs space-y-1 border-l-2 border-red-900/30 pl-3 py-1">
                              <div className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">Quest {idx + 1}</div>
                              <div className="text-red-200/70 font-medium">{quest.question}</div>
                              <div className="text-red-400/90 italic bg-red-950/20 px-2 py-0.5 rounded inline-block">
                                {quest.correctAnswer}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 align-top text-center space-y-2">
                        {deleteConfirmId === scenario.id ? (
                          <div className="space-y-2 animate-in fade-in zoom-in duration-200 bg-red-600/20 p-2 rounded-lg border border-red-500/50">
                            <p className="text-[10px] text-red-200 font-black uppercase tracking-tighter">정말 삭제할까요?</p>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleDelete(scenario.id)}
                                disabled={loading}
                                className="flex-1 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-black uppercase"
                              >
                                삭제
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={loading}
                                className="flex-1 p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-[10px] font-black uppercase"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEditClick(scenario)}
                              className="w-full p-2 bg-red-900/20 hover:bg-red-900/60 text-red-400 rounded-lg border border-red-900/50 transition-colors flex items-center justify-center gap-1"
                              title="수정"
                            >
                              <Edit2 size={16} /> 수정
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(scenario.id)}
                              className="w-full p-2 bg-red-950/40 hover:bg-red-900/80 text-red-500 hover:text-red-300 rounded-lg border border-red-900/50 transition-colors flex items-center justify-center gap-1"
                              title="삭제"
                            >
                              <Trash2 size={16} /> 삭제
                            </button>
                          </>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(220, 38, 38, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.5);
        }
      `}</style>
    </div>
  );
}
