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

  // 驗證呼號與資格
  const startExam = async () => {
    // 1. 檢查學生是否存在
    const { data: student } = await supabase.from('sjx_students').select('*').eq('callsign', callsign).single();
    if (!student) return alert('找不到該呼號 (Callsign)');

    // 2. 檢查是否已經通過結訓考試
    const { data: pastPass } = await supabase
      .from('sjx_results')
      .select('id')
      .eq('callsign', callsign)
      .eq('exam_type', 'final')
      .eq('passed', true)
      .limit(1);

    if (pastPass && pastPass.length > 0) {
      alert('您已通過結訓考試，無需重複考試。');
      return;
    }

    // 3. 隨機抓取 20 題結訓題
    const { data: ques } = await supabase
      .from('sjx_questions')
      .select('*')
      .eq('exam_type', 'final');
    
    if (!ques || ques.length < 20) {
      alert('題庫數量不足 (需至少 20 題)，請聯絡教官。');
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
  questions.forEach(q => {
    // 強制轉小寫比對
    const userAns = (answers[q.id] || "").toLowerCase().trim();
    const correctAns = (q.correct_answer || "").toLowerCase().trim();
    
    if (userAns === correctAns) {
      correctCount++;
    }
  });

  // 計算百分制分數
  const score = Math.round((correctCount / questions.length) * 100);
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
          </div>
          <button className="btn-primary w-full py-4 text-lg mt-8 mb-20" onClick={() => { if(confirm('確定要提交試卷嗎？')) submitExam(); }}>提交結訓試卷</button>
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
    </div>
  );
}