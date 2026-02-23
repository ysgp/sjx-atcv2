'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

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
    <div className="max-w-4xl mx-auto p-8 min-h-screen">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-sjx-gold tracking-widest uppercase">ATC Quiz System</h1>
        <p className="text-gray-500 text-sm mt-2">星宇航空培訓小考系統</p>
      </div>

      {/* Step 1: 身份驗證 */}
      {step === 1 && (
        <div className="card-sjx text-center max-w-md mx-auto">
          <h2 className="text-xl mb-6 text-sjx-gold font-bold underline">身分驗證 / IDENTIFY</h2>
          <p className="text-gray-400 text-xs mb-4">請輸入您的呼號 (如: SJX123)</p>
          <input 
            className="input-dark w-full mb-6 text-center text-2xl font-mono tracking-tighter" 
            placeholder="CALLSIGN"
            value={callsign} 
            onChange={e => setCallsign(e.target.value.toUpperCase())} 
          />
          <button 
            className="btn-gold w-full py-3" 
            onClick={verifyCallsign}
            disabled={loading || !callsign}
          >
            {loading ? '驗證中...' : '進入系統 / ACCESS'}
          </button>
        </div>
      )}

      {/* Step 2: 選擇章節 */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-6">
          <h2 className="text-2xl mb-2 text-sjx-gold font-bold">選擇測驗章節 / CHAPTER</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapters.map(c => (
              <button 
                key={c.id} 
                onClick={() => startQuiz(c.id)} 
                disabled={loading}
                className="card-sjx text-left hover:border-sjx-gold transition-all group flex justify-between items-center"
              >
                <div>
                  <div className="text-sjx-gold font-bold">{c.chapter_name}</div>
                  <div className="text-xs text-gray-500 mt-1">{c.description || '無章節描述'}</div>
                </div>
                <span className="text-sjx-gold opacity-0 group-hover:opacity-100 transition-opacity">START →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 測驗進行中（含多媒體支援） */}
      {step === 3 && (
        <div className="space-y-8">
          <div className="sticky top-4 z-10 bg-sjx-gold text-black px-6 py-2 rounded-full font-bold shadow-2xl flex justify-between">
            <span>CALLSIGN: {callsign}</span>
            <span>CHAPTER QUIZ</span>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="card-sjx">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-sjx-gold text-black text-[10px] font-bold px-2 py-1 rounded">QUESTION {idx + 1}</span>
              </div>
              
              <p className="mb-6 text-lg leading-relaxed">{q.question_text}</p>

              {/* 多媒體區塊：圖片 */}
              {q.image_url && (
                <div className="mb-6 border border-gray-700 p-2 bg-black/20 rounded">
                  <img src={q.image_url} alt="Exam Chart" className="max-w-full h-auto rounded mx-auto" />
                </div>
              )}

              {/* 多媒體區塊：音訊播放器 */}
              {q.audio_url && (
                <div className="mb-6 bg-sjx-dark border border-sjx-gold/30 p-4 rounded flex items-center gap-4">
                  <span className="text-xs font-bold text-sjx-gold uppercase">Listen ATC Audio:</span>
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
                      className={`p-4 text-left rounded-sm border transition-all flex items-center gap-4 ${
                        answers[q.id] === opt 
                        ? 'border-sjx-gold bg-sjx-gold/10 text-white font-bold' 
                        : 'border-gray-800 bg-sjx-gray/50 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${
                        answers[q.id] === opt ? 'bg-sjx-gold text-black border-sjx-gold' : 'border-gray-600'
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
            className="btn-gold w-full py-4 text-lg mb-20 shadow-xl" 
            onClick={() => { if(confirm('確定要提交答案嗎？')) submitQuiz(); }}
          >
            提交試卷 / SUBMIT REPORT
          </button>
        </div>
      )}

      {/* Step 4: 測驗結果與詳解 */}
      {step === 4 && (
        <div className="card-sjx text-center">
          <h2 className={`text-5xl font-black mb-4 tracking-tighter ${examResult.passed ? 'text-green-500' : 'text-red-500'}`}>
            {examResult.passed ? 'PASSED' : 'FAILED'}
          </h2>
          <p className="text-2xl mb-8 font-mono">FINAL SCORE: {examResult.score}</p>
          
          <div className="text-left space-y-6 mt-10 border-t border-gray-800 pt-8">
            <h3 className="text-sjx-gold font-bold uppercase tracking-widest mb-4">Diagnostic Review / 診斷詳解</h3>
            {questions.map((q, idx) => {
              const isCorrect = (answers[q.id] || "").toLowerCase() === (q.correct_answer || "").toLowerCase();
              return (
                <div key={q.id} className={`p-4 rounded border ${isCorrect ? 'border-green-900/30 bg-green-900/10' : 'border-red-900/30 bg-red-900/10'}`}>
                  <p className="font-bold text-gray-200">{idx + 1}. {q.question_text}</p>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <p className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                      您的答案: {(answers[q.id] || "未答").toUpperCase()}
                    </p>
                    <p className="text-sjx-gold font-bold">正確答案: {q.correct_answer.toUpperCase()}</p>
                  </div>
                  {q.explanation && (
                    <div className="mt-3 text-xs text-gray-400 bg-black/40 p-3 rounded italic">
                      解析: {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <button className="btn-gold mt-12 px-12" onClick={() => window.location.href = '/'}>回首頁 / BACK HOME</button>
        </div>
      )}
    </div>
  );
}