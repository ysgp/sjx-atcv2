'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, BookOpen, CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react';

export default function QuizPage() {
  const [step, setStep] = useState(0); // 0: Loading, 1: Callsign (skipped if logged in), 2: Chapter, 3: Exam, 4: Result
  const [callsign, setCallsign] = useState('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  // 自動從 session 取得 callsign
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user?.callsign) {
          setCallsign(data.user.callsign);
          // 直接載入章節並跳至 step 2
          const { data: chapData } = await supabase.from('sjx_chapters').select('*');
          setChapters(chapData || []);
          setStep(2);
        } else {
          setStep(1);
        }
      } catch {
        setStep(1);
      } finally {
        setSessionLoading(false);
      }
    };
    fetchSession();
  }, []);
  
  // 自定義對話框狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    type?: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ title: '', message: '' });

  // 1. 驗證呼號並讀取章節
  const verifyCallsign = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sjx_students') 
      .select('*')
      .eq('callsign', callsign.toUpperCase())
      .single();

    if (error || !data) {
      setDialogConfig({
        title: '查詢失敗',
        message: '找不到該呼號 (Callsign)，請聯繫教官建立資料。'
      });
      setDialogOpen(true);
      setLoading(false);
      return;
    }

    const { data: chapData } = await supabase.from('sjx_chapters').select('*');
    setChapters(chapData || []);
    setStep(2);
    setLoading(false);
  };

  // 2. 開始測驗（包含 8 小時通過限制檢查）
  const startQuiz = async (chapterId: string) => {
    setLoading(true);
    
    // 檢查 8 小時限制：若該章節已通過，8 小時內不得重考
    const { data: lastExam } = await supabase
      .from('sjx_results')
      .select('created_at')
      .eq('callsign', callsign.toUpperCase())
      .eq('chapter_id', chapterId)
      .eq('passed', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (lastExam && lastExam.length > 0) {
      const lastTime = new Date(lastExam[0].created_at).getTime();
      const now = new Date().getTime();
      const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
      
      if (hoursDiff < 8) {
        setDialogConfig({
          title: '等待時間',
          message: `您已通過此章節。根據規範，需間隔 8 小時方可再次練習。剩餘時間：${(8 - hoursDiff).toFixed(1)} 小時`
        });
        setDialogOpen(true);
        setLoading(false);
        return;
      }
    }

    // 抓取該章節 10 題 Quiz 題目
    const { data: ques } = await supabase
      .from('sjx_questions')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('exam_type', 'quiz')
      .limit(10);

    if (!ques || ques.length === 0) {
      setDialogConfig({
        title: '無題目',
        message: '該章節目前尚無題目，請聯繫教官。'
      });
      setDialogOpen(true);
      setLoading(false);
      return;
    }

    setQuestions(ques);
    setSelectedChapter(chapterId);
    setStep(3);
    setLoading(false);
  };

  // 3. 提交測驗與判分（支援多種題型）
  const submitQuiz = async () => {
    let score = 0;
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
          // 單選題：不分大小寫比對
          isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
          break;

        case 'multiple_choice':
          // 多選題：排序後比對（例如 "bac" 與 "abc" 都是對的）
          const userSorted = userAns.toLowerCase().split('').sort().join('');
          const correctSorted = correctAns.toLowerCase().split('').sort().join('');
          isCorrect = userSorted === correctSorted;
          break;

        case 'true_false':
          // 是非題：完全匹配
          isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
          break;

        case 'fill_blank':
          // 填空題：檢查是否匹配任一答案（答案用逗號分隔）
          const possibleAnswers = correctAns.split(',').map((a: string) => a.trim().toLowerCase());
          isCorrect = possibleAnswers.includes(userAns.toLowerCase());
          break;

        case 'short_answer':
          // 簡答題：檢查是否包含任一關鍵字
          const keywords = correctAns.split(',').map((k: string) => k.trim().toLowerCase());
          const userAnswerLower = userAns.toLowerCase();
          isCorrect = keywords.some((keyword: string) => userAnswerLower.includes(keyword));
          break;

        default:
          // 預設為單選題模式
          isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
      }

      if (isCorrect) {
        score += 10; // 每一題 10 分
      }
    });

    // 根據有正確答案的題目數量計算實際分數
    const actualScore = gradedQuestions > 0 ? Math.round((score / (gradedQuestions * 10)) * 100) : 0;
    const passed = actualScore >= 70; // 70 分及格

    const finalData = {
      callsign: callsign.toUpperCase(),
      exam_type: 'quiz',
      chapter_id: selectedChapter,
      score: actualScore,
      passed,
      detailed_answers: answers
    };

    // 透過 API Route 安全寫入資料庫
    await fetch('/api/submit-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalData)
    });

    setExamResult(finalData);
    setStep(4);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream mb-2">小考系統</h1>
        <p className="text-cream/50">章節制測驗，提升您的專業技能</p>
      </div>

      {/* Step 0: Loading Session */}
      {step === 0 && (
        <div className="card max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-cream/70">載入中...</p>
        </div>
      )}

      {/* Step 1: 身份驗證 (備用，當 session 無 callsign 時) */}
      {step === 1 && (
        <div className="card max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-cream mb-2">身分驗證</h2>
          <p className="text-cream/50 text-sm mb-6">請輸入您的呼號 (如: SJX123)</p>
          <input 
            className="input-field w-full mb-6 text-center text-xl font-mono tracking-wider" 
            placeholder="CALLSIGN"
            value={callsign} 
            onChange={e => setCallsign(e.target.value.toUpperCase())} 
          />
          <button 
            className="btn-primary w-full" 
            onClick={verifyCallsign}
            disabled={loading || !callsign}
          >
            {loading ? '驗證中...' : '進入系統'}
          </button>
        </div>
      )}

      {/* Step 2: 選擇章節 */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-6 h-6 text-accent" />
            <h2 className="text-xl font-bold text-cream">選擇測驗章節</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapters.map(c => (
              <button 
                key={c.id} 
                onClick={() => startQuiz(c.id)} 
                disabled={loading}
                className="card text-left hover:border-accent transition-all group flex justify-between items-center"
              >
                <div>
                  <div className="text-accent font-bold text-lg">{c.chapter_name}</div>
                  <div className="text-sm text-cream/50 mt-1">{c.description || '無章節描述'}</div>
                </div>
                <ArrowRight className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 測驗進行中 */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="sticky top-20 z-10 bg-accent text-cream px-4 sm:px-6 py-3 rounded-xl font-bold shadow-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <span className="flex items-center gap-2 text-sm sm:text-base">
              <User className="w-4 h-4" />
              {callsign}
            </span>
            <span className="text-xs sm:text-sm bg-cream/20 px-3 py-1 rounded-lg self-start sm:self-auto">章節測驗</span>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="card">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-accent text-cream text-xs font-bold px-3 py-1 rounded-lg">
                  Q{idx + 1}
                </span>
              </div>
              
              <p className="mb-6 text-lg leading-relaxed text-cream">{q.question_text}</p>

              {/* 多媒體區塊：圖片 */}
              {q.image_url && (
                <div className="mb-6 border border-cream/10 p-2 bg-primary-dark rounded-lg">
                  <img src={q.image_url} alt="Exam Chart" className="max-w-full h-auto rounded mx-auto" />
                </div>
              )}

              {/* 多媒體區塊：音訊播放器 */}
              {q.audio_url && (
                <div className="mb-6 bg-primary-dark border border-accent/30 p-4 rounded-lg flex items-center gap-4">
                  <span className="text-xs font-bold text-accent uppercase">播放音訊:</span>
                  <audio controls src={q.audio_url} className="h-10 flex-1">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* 選項區塊 - 根據題型顯示不同的UI */}
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
                              // 移除
                              setAnswers({...answers, [q.id]: currentArray.filter(x => x !== opt).sort().join('')});
                            } else {
                              // 加入
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

          <button 
            className="btn-primary w-full py-4 text-lg mb-20" 
            onClick={() => {
              setDialogConfig({
                type: 'confirm',
                title: '確定提交？',
                message: '提交後將無法修改答案，確定要提交嗎？',
                onConfirm: submitQuiz
              });
              setDialogOpen(true);
            }}
          >
            提交試卷
          </button>
        </div>
      )}

      {/* Step 4: 測驗結果與詳解 */}
      {step === 4 && (
        <div className="card">
          <div className="text-center mb-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${examResult.passed ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {examResult.passed ? (
                <CheckCircle className="w-10 h-10 text-green-400" />
              ) : (
                <XCircle className="w-10 h-10 text-red-400" />
              )}
            </div>
            <h2 className={`text-4xl font-bold mb-2 ${examResult.passed ? 'text-green-400' : 'text-red-400'}`}>
              {examResult.passed ? 'PASSED' : 'FAILED'}
            </h2>
            <p className="text-3xl font-mono text-cream">{examResult.score} 分</p>
          </div>
          
          <div className="border-t border-cream/10 pt-8">
            <h3 className="text-accent font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              答題詳解
            </h3>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                // 判斷是否為開放式問題（無正確答案）
                const isOpenEnded = q.has_correct_answer === 'false' || !q.correct_answer;
                
                // 根據題型判斷答案是否正確
                const userAns = (answers[q.id] || "").trim();
                const correctAns = (q.correct_answer || "").trim();
                const questionType = q.question_type || 'single_choice';
                
                let isCorrect = false;
                let displayUserAns = userAns || "未答";
                let displayCorrectAns = correctAns;

                if (!isOpenEnded) {
                  switch (questionType) {
                    case 'single_choice':
                      isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
                      displayUserAns = userAns.toUpperCase() || "未答";
                      displayCorrectAns = correctAns.toUpperCase();
                      break;

                    case 'multiple_choice':
                      const userSorted = userAns.toLowerCase().split('').sort().join('');
                      const correctSorted = correctAns.toLowerCase().split('').sort().join('');
                      isCorrect = userSorted === correctSorted;
                      displayUserAns = userAns.toUpperCase() || "未答";
                      displayCorrectAns = correctAns.toUpperCase();
                      break;

                    case 'true_false':
                      isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
                      displayUserAns = userAns === 'true' ? '正確 (True)' : userAns === 'false' ? '錯誤 (False)' : '未答';
                      displayCorrectAns = correctAns === 'true' ? '正確 (True)' : '錯誤 (False)';
                      break;

                    case 'fill_blank':
                      const possibleAnswers = correctAns.split(',').map((a: string) => a.trim().toLowerCase());
                      isCorrect = possibleAnswers.includes(userAns.toLowerCase());
                      displayCorrectAns = possibleAnswers.join(' 或 ');
                      break;

                    case 'short_answer':
                      const keywords = correctAns.split(',').map((k: string) => k.trim().toLowerCase());
                      const userAnswerLower = userAns.toLowerCase();
                      isCorrect = keywords.some((keyword: string) => userAnswerLower.includes(keyword));
                      displayCorrectAns = `需包含關鍵字: ${keywords.join(' 或 ')}`;
                      break;

                    default:
                      isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
                  }
                }

                return (
                  <div key={q.id} className={`p-4 rounded-lg border ${
                    isOpenEnded 
                      ? 'border-cream/20 bg-primary-dark' 
                      : isCorrect 
                        ? 'border-green-500/30 bg-green-500/10' 
                        : 'border-red-500/30 bg-red-500/10'
                  }`}>
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded font-bold">
                        {questionType === 'single_choice' ? '單選' : 
                         questionType === 'multiple_choice' ? '多選' :
                         questionType === 'true_false' ? '是非' :
                         questionType === 'fill_blank' ? '填空' : '簡答'}
                      </span>
                      {isOpenEnded && (
                        <span className="text-xs bg-cream/20 text-cream px-2 py-1 rounded font-bold">
                          不計分
                        </span>
                      )}
                      <p className="font-bold text-cream flex-1">{idx + 1}. {q.question_text}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <p className={isOpenEnded ? 'text-cream' : isCorrect ? 'text-green-400' : 'text-red-400'}>
                        您的答案: {displayUserAns}
                      </p>
                      {!isOpenEnded && (
                        <p className="text-accent font-bold">正確答案: {displayCorrectAns}</p>
                      )}
                    </div>
                    {q.explanation && (
                      <div className="mt-3 text-sm text-cream/60 bg-primary-dark p-3 rounded-lg">
                        解析: {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <button 
            className="btn-primary mt-8 w-full flex items-center justify-center gap-2" 
            onClick={() => window.location.href = '/'}
          >
            <Home className="w-4 h-4" />
            回首頁
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