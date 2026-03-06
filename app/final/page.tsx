'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Clock, CheckCircle, XCircle, AlertTriangle, Home } from 'lucide-react';

export default function FinalExamPage() {
  const [step, setStep] = useState(1); // 1: Callsign, 2: Exam, 3: Result
  const [callsign, setCallsign] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 分鐘 = 3600 秒
  const [examResult, setExamResult] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 自定義對話框狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ type: 'alert', title: '', message: '' });

  // 驗證呼號與資格
  const startExam = async () => {
    // 1. 檢查學生是否存在
    const { data: student } = await supabase.from('sjx_students').select('*').eq('callsign', callsign).single();
    if (!student) {
      setDialogConfig({
        type: 'alert',
        title: '查詢失敗',
        message: '找不到該呼號 (Callsign)，請聯繫教官建立資料'
      });
      setDialogOpen(true);
      return;
    }

    // 2. 檢查是否已經通過結訓考試
    const { data: pastPass } = await supabase
      .from('sjx_results')
      .select('id')
      .eq('callsign', callsign)
      .eq('exam_type', 'final')
      .eq('passed', true)
      .limit(1);

    if (pastPass && pastPass.length > 0) {
      setDialogConfig({
        type: 'alert',
        title: '已通過考試',
        message: '您已通過結訓考試，無需重複考試。'
      });
      setDialogOpen(true);
      return;
    }

    // 3. 隨機抓取 20 題結訓題
    const { data: ques } = await supabase
      .from('sjx_questions')
      .select('*')
      .eq('exam_type', 'final');
    
    if (!ques || ques.length < 20) {
      setDialogConfig({
        type: 'alert',
        title: '題庫不足',
        message: '題庫數量不足 (需至少 20 題)，請聯絡教官。'
      });
      setDialogOpen(true);
      return;
    }

    const shuffled = ques.sort(() => 0.5 - Math.random()).slice(0, 20);
    setQuestions(shuffled);
    setStep(2);
    startTimer();
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          submitExam(); // 時間到自動交卷
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

const submitExam = async () => {
  if (timerRef.current) clearInterval(timerRef.current);

  let correctCount = 0;
  let gradedQuestions = 0; // 計算有正確答案的題目數量
  
  questions.forEach(q => {
    // 如果題目沒有正確答案，跳過計分
    if (q.has_correct_answer === 'false' || !q.correct_answer) {
      return;
    }
    
    gradedQuestions++;
    const userAns = (answers[q.id] || "").trim();
    const correctAns = (q.correct_answer || "").trim();
    const questionType = q.question_type || 'single_choice';
    
    let isCorrect = false;

    switch (questionType) {
      case 'single_choice':
        isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
        break;

      case 'multiple_choice':
        const userSorted = userAns.toLowerCase().split('').sort().join('');
        const correctSorted = correctAns.toLowerCase().split('').sort().join('');
        isCorrect = userSorted === correctSorted;
        break;

      case 'true_false':
        isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
        break;

      case 'fill_blank':
        const possibleAnswers = correctAns.split(',').map((a: string) => a.trim().toLowerCase());
        isCorrect = possibleAnswers.includes(userAns.toLowerCase());
        break;

      case 'short_answer':
        const keywords = correctAns.split(',').map((k: string) => k.trim().toLowerCase());
        const userAnswerLower = userAns.toLowerCase();
        isCorrect = keywords.some((keyword: string) => userAnswerLower.includes(keyword));
        break;

      default:
        isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
    }

    if (isCorrect) {
      correctCount++;
    }
  });

  // 根據有正確答案的題目數量計算實際分數
  const score = gradedQuestions > 0 ? Math.round((correctCount / gradedQuestions) * 100) : 0;
  const passed = score >= 80; // 結訓需 80 分

  const finalData = {
    callsign,
    exam_type: 'final',
    score,
    passed,
    detailed_answers: answers
  };

  await fetch('/api/submit-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finalData)
  });

  setExamResult(finalData);
  setStep(3);
};


  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream mb-2">結訓考試</h1>
        <p className="text-cream/50">綜合評估，獲取認證資格</p>
      </div>

      {step === 1 && (
        <div className="card max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-cream mb-2">結訓考試驗證</h2>
          <div className="flex items-center justify-center gap-4 text-cream/50 text-sm mb-6">
            <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 80分及格</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 60分鐘</span>
            <span>20題</span>
          </div>
          <input 
            className="input-field w-full mb-6 text-center text-xl font-mono tracking-wider" 
            placeholder="CALLSIGN"
            value={callsign} 
            onChange={e => setCallsign(e.target.value.toUpperCase())} 
          />
          <button className="btn-primary w-full" onClick={startExam}>開始考試</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="sticky top-20 z-10 bg-accent text-cream font-bold p-4 rounded-xl flex justify-between items-center mb-8 shadow-xl">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {callsign}
            </span>
            <span className={`text-xl flex items-center gap-2 ${timeLeft < 300 ? 'text-red-200 animate-pulse' : ''}`}>
              <Clock className="w-5 h-5" />
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div key={q.id} className="card">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-accent text-cream text-xs font-bold px-3 py-1 rounded-lg">Q{idx + 1}</span>
                </div>
                <p className="mb-6 text-lg text-cream">{q.question_text}</p>
                {q.image_url && <img src={q.image_url} alt="Exam" className="mb-4 rounded-lg max-h-64 border border-cream/10" />}
                {q.audio_url && (
                  <div className="mb-4 bg-primary-dark border border-accent/30 p-4 rounded-lg flex items-center gap-4">
                    <span className="text-xs font-bold text-accent uppercase">播放音訊:</span>
                    <audio controls src={q.audio_url} className="h-10 flex-1">
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                
                {/* 根據題型顯示不同的UI */}
                <div className="grid grid-cols-1 gap-3">
                  {/* 單選題 */}
                  {(!q.question_type || q.question_type === 'single_choice') && (
                    <>
                      {['a', 'b', 'c', 'd'].map(opt => (
                        q[`option_${opt}`] && (
                          <button 
                            key={opt}
                            onClick={() => setAnswers({...answers, [q.id]: opt})}
                            className={`p-4 text-left rounded-lg border transition-all flex items-center gap-4 ${
                              answers[q.id] === opt 
                              ? 'border-accent bg-accent/20 text-cream font-bold' 
                              : 'border-cream/10 bg-primary-dark text-cream/70 hover:border-cream/30'
                            }`}
                          >
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                              answers[q.id] === opt ? 'bg-accent text-cream border-accent' : 'border-cream/30'
                            }`}>
                              {opt.toUpperCase()}
                            </span>
                            {q[`option_${opt}`]}
                          </button>
                        )
                      ))}
                    </>
                  )}

                  {/* 多選題 */}
                  {q.question_type === 'multiple_choice' && (
                    <>
                      <p className="text-xs text-accent mb-2">※ 可選擇多個答案</p>
                      {['a', 'b', 'c', 'd'].map(opt => {
                        if (!q[`option_${opt}`]) return null;
                        const selected = (answers[q.id] || '').split('').includes(opt);
                        return (
                          <button 
                            key={opt}
                            onClick={() => {
                              const current = answers[q.id] || '';
                              const currentArray = current.split('').filter(x => x);
                              if (currentArray.includes(opt)) {
                                setAnswers({...answers, [q.id]: currentArray.filter(x => x !== opt).sort().join('')});
                              } else {
                                setAnswers({...answers, [q.id]: [...currentArray, opt].sort().join('')});
                              }
                            }}
                            className={`p-4 text-left rounded-lg border transition-all flex items-center gap-4 ${
                              selected 
                              ? 'border-accent bg-accent/20 text-cream font-bold' 
                              : 'border-cream/10 bg-primary-dark text-cream/70 hover:border-cream/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                selected ? 'bg-accent border-accent' : 'border-cream/40'
                              }`}>
                                {selected && (
                                  <svg className="w-4 h-4 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-primary-dark border border-cream/30">
                                {opt.toUpperCase()}
                              </span>
                            </div>
                            <span className="flex-1">{q[`option_${opt}`]}</span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* 是非題 */}
                  {q.question_type === 'true_false' && (
                    <>
                      {['true', 'false'].map(opt => (
                        <button 
                          key={opt}
                          onClick={() => setAnswers({...answers, [q.id]: opt})}
                          className={`p-4 text-left rounded-lg border transition-all flex items-center gap-4 ${
                            answers[q.id] === opt 
                            ? 'border-accent bg-accent/20 text-cream font-bold' 
                            : 'border-cream/10 bg-primary-dark text-cream/70 hover:border-cream/30'
                          }`}
                        >
                          <span className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold border ${
                            answers[q.id] === opt ? 'bg-accent text-cream border-accent' : 'border-cream/30'
                          }`}>
                            {opt === 'true' ? '✓' : '✗'}
                          </span>
                          <span className="text-lg">{opt === 'true' ? '正確 (True)' : '錯誤 (False)'}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* 填空題 */}
                  {q.question_type === 'fill_blank' && (
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      placeholder="請輸入答案"
                      className="input-field w-full text-lg p-4"
                    />
                  )}

                  {/* 簡答題 */}
                  {q.question_type === 'short_answer' && (
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      placeholder="請輸入答案"
                      className="input-field w-full text-lg p-4 min-h-[120px]"
                      rows={4}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full py-4 text-lg mt-8 mb-20" onClick={() => { 
            setDialogConfig({
              type: 'confirm',
              title: '確定提交？',
              message: '提交後將無法修改答案，確定要提交結訓試卷嗎？',
              onConfirm: submitExam
            });
            setDialogOpen(true);
          }}>提交結訓試卷</button>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center py-12">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${examResult.passed ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {examResult.passed ? (
              <CheckCircle className="w-12 h-12 text-green-400" />
            ) : (
              <XCircle className="w-12 h-12 text-red-400" />
            )}
          </div>
          <h2 className={`text-5xl font-bold mb-4 ${examResult.passed ? 'text-green-400' : 'text-red-400'}`}>
            {examResult.passed ? 'PASSED' : 'FAILED'}
          </h2>
          <p className="text-4xl font-mono text-cream mb-2">{examResult.score} 分</p>
          <p className="text-cream/50 mb-8">
            {examResult.passed ? '恭喜您完成 STARLUX ATC 培訓認證。' : '未達 80 分標準，請檢討後再次嘗試補考。'}
          </p>
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg mb-8 flex items-center justify-center gap-3 text-amber-300">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">結訓考試不開放顯示正確答案與解析</span>
          </div>
          <button className="btn-primary flex items-center gap-2 mx-auto" onClick={() => window.location.href = '/'}>
            <Home className="w-4 h-4" />
            回到首頁
          </button>
        </div>
      )}

      {/* 自定義對話框 */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md border border-cream/20 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                dialogConfig.type === 'confirm' ? 'bg-amber-500/20' : 'bg-accent/20'
              }`}>
                {dialogConfig.type === 'confirm' ? (
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-cream mb-2">{dialogConfig.title}</h3>
                <p className="text-cream/70">{dialogConfig.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              {dialogConfig.type === 'confirm' && (
                <button 
                  onClick={() => setDialogOpen(false)} 
                  className="btn-secondary"
                >
                  取消
                </button>
              )}
              <button 
                onClick={() => {
                  setDialogOpen(false);
                  if (dialogConfig.onConfirm) {
                    dialogConfig.onConfirm();
                  }
                }} 
                className="btn-primary"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}