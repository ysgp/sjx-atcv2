'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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
    <div className="max-w-4xl mx-auto p-8">
      {step === 1 && (
        <div className="card text-center">
          <h2 className="text-2xl mb-4 text-sjx-gold">結訓考試驗證 (Final Exam)</h2>
          <p className="text-gray-400 mb-6">通過標準：80分 | 題目：20題隨機 | 時間：60分鐘</p>
          <input 
            className="input-dark w-full mb-4 text-center text-xl" 
            placeholder="INPUT CALLSIGN"
            value={callsign} 
            onChange={e => setCallsign(e.target.value.toUpperCase())} 
          />
          <button className="btn-gold w-full" onClick={startExam}>開始考試</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="sticky top-4 z-10 bg-sjx-gold text-black font-bold p-4 rounded-full flex justify-between items-center mb-8 shadow-2xl">
            <span>CALLSIGN: {callsign}</span>
            <span className="text-2xl">剩餘時間: {formatTime(timeLeft)}</span>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="card mb-6">
              <p className="mb-4 text-lg font-semibold">{idx + 1}. {q.question_text}</p>
              {q.image_url && <img src={q.image_url} alt="Exam" className="mb-4 rounded max-h-64" />}
              <div className="grid grid-cols-1 gap-3">
                {['a', 'b', 'c', 'd'].map(opt => (
                  q[`option_${opt}`] && (
                    <button 
                      key={opt}
                      onClick={() => setAnswers({...answers, [q.id]: opt})}
                      className={`p-4 text-left rounded border transition-colors ${answers[q.id] === opt ? 'border-sjx-gold bg-sjx-gold/20' : 'border-gray-600 hover:border-sjx-gold/50'}`}
                    >
                      <span className="font-bold mr-2">{opt.toUpperCase()}.</span> {q[`option_${opt}`]}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
          <button className="btn-gold w-full py-4 text-xl mt-4 mb-20" onClick={() => { if(confirm('確定要提交試卷嗎？')) submitExam(); }}>提交結訓試卷</button>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center py-12">
          <h2 className={`text-6xl font-bold mb-6 ${examResult.passed ? 'text-green-500' : 'text-red-500'}`}>
            {examResult.passed ? 'PASSED' : 'FAILED'}
          </h2>
          <p className="text-3xl mb-4">得分: {examResult.score}</p>
          <p className="text-gray-400 mb-10">
            {examResult.passed ? '恭喜您完成 STARLUX ATC 培訓。' : '未達 80 分標準，請檢討後再次嘗試補考。'}
          </p>
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded mb-8 text-sm text-yellow-500">
            結訓考試不開放顯示正確答案與解析。
          </div>
          <button className="btn-gold px-12" onClick={() => window.location.href = '/'}>回到首頁</button>
        </div>
      )}
    </div>
  );
}