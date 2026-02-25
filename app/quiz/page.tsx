'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, BookOpen, CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react';

export default function QuizPage() {
  const [step, setStep] = useState(1); // 1: Callsign, 2: Chapter, 3: Exam, 4: Result
  const [callsign, setCallsign] = useState('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 1. 驗證呼號並讀取章節
  const verifyCallsign = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sjx_students') 
      .select('*')
      .eq('callsign', callsign.toUpperCase())
      .single();

    if (error || !data) {
      alert('找不到該呼號 (Callsign)，請聯繫教官建立資料。');
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
        alert(`您已通過此章節。根據規範，需間隔 8 小時方可再次練習。剩餘時間：${(8 - hoursDiff).toFixed(1)} 小時`);
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
      alert('該章節目前尚無題目，請聯繫教官。');
      setLoading(false);
      return;
    }

    setQuestions(ques);
    setSelectedChapter(chapterId);
    setStep(3);
    setLoading(false);
  };

  // 3. 提交測驗與判分（不分大小寫比對）
  const submitQuiz = async () => {
    let score = 0;
    questions.forEach(q => {
      const userAns = (answers[q.id] || "").toLowerCase().trim();
      const correctAns = (q.correct_answer || "").toLowerCase().trim();
      
      if (userAns === correctAns) {
        score += 10; // 每一題 10 分
      }
    });

    const passed = score >= 70; // 70 分及格

    const finalData = {
      callsign: callsign.toUpperCase(),
      exam_type: 'quiz',
      chapter_id: selectedChapter,
      score,
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

      {/* Step 1: 身份驗證 */}
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
          <div className="sticky top-20 z-10 bg-accent text-cream px-6 py-3 rounded-xl font-bold shadow-xl flex justify-between items-center">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {callsign}
            </span>
            <span className="text-sm bg-cream/20 px-3 py-1 rounded-lg">章節測驗</span>
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

              {/* 選項區塊 */}
              <div className="grid grid-cols-1 gap-3">
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
              </div>
            </div>
          ))}

          <button 
            className="btn-primary w-full py-4 text-lg mb-20" 
            onClick={() => { if(confirm('確定要提交答案嗎？')) submitQuiz(); }}
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
                const isCorrect = (answers[q.id] || "").toLowerCase() === (q.correct_answer || "").toLowerCase();
                return (
                  <div key={q.id} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                    <p className="font-bold text-cream mb-3">{idx + 1}. {q.question_text}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <p className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                        您的答案: {(answers[q.id] || "未答").toUpperCase()}
                      </p>
                      <p className="text-accent font-bold">正確答案: {q.correct_answer.toUpperCase()}</p>
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
    </div>
  );
}