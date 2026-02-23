'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function QuizPage() {
  const [step, setStep] = useState(1); // 1: Callsign, 2: Chapter, 3: Exam, 4: Result
  const [callsign, setCallsign] = useState('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<any>(null);

// app/quiz/page.tsx 裡面的 verifyCallsign 函式
const verifyCallsign = async () => {
  // 將 SJX_Students 改成 sjx_students
  const { data, error } = await supabase
    .from('sjx_students') 
    .select('*')
    .eq('callsign', callsign)
    .single();

  if (data) {
    // 將 SJX_Chapters 改成 sjx_chapters
    const { data: chapData } = await supabase.from('sjx_chapters').select('*');
    setChapters(chapData || []);
    setStep(2);
  } else {
    alert('找不到該呼號 (Callsign)');
  }
};

  const startQuiz = async (chapterId: string) => {
    // 檢查 8 小時限制
    const { data: lastExam } = await supabase
      .from('sjx_results')
      .select('created_at')
      .eq('callsign', callsign)
      .eq('chapter_id', chapterId)
      .eq('passed', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (lastExam && lastExam.length > 0) {
      const lastTime = new Date(lastExam[0].created_at).getTime();
      const now = new Date().getTime();
      if (now - lastTime < 8 * 60 * 60 * 1000) {
        alert('你已通過此章節，請於 8 小時後再嘗試。');
        return;
      }
    }

    const { data: ques } = await supabase
      .from('sjx_questions')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('exam_type', 'quiz')
      .limit(10);

    setQuestions(ques || []);
    setSelectedChapter(chapterId);
    setStep(3);
  };

// app/quiz/page.tsx

const submitQuiz = async () => {
  let score = 0;
  questions.forEach(q => {
    // 使用 .toLowerCase() 確保大小寫一致，並使用 trim() 去除空白
    const userAns = (answers[q.id] || "").toLowerCase().trim();
    const correctAns = (q.correct_answer || "").toLowerCase().trim();
    
    if (userAns === correctAns) {
      score += 10; // 每題 10 分，共 10 題
    }
  });

  const passed = score >= 70; // 70 分及格

  const finalData = {
    callsign,
    exam_type: 'quiz',
    chapter_id: selectedChapter,
    score,
    passed,
    detailed_answers: answers
  };

  // 傳送到後端存檔
  await fetch('/api/submit-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finalData)
  });

  setExamResult(finalData);
  setStep(4);
};

  return (
    <div className="max-w-4xl mx-auto p-8">
      {step === 1 && (
        <div className="card text-center">
          <h2 className="text-2xl mb-4 text-sjx-gold">輸入 CALLSIGN 驗證</h2>
          <input className="input-dark w-full mb-4" value={callsign} onChange={e => setCallsign(e.target.value.toUpperCase())} />
          <button className="btn-gold w-full" onClick={verifyCallsign}>進入系統</button>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-4">
          <h2 className="text-2xl mb-4 text-sjx-gold">選擇考試章節</h2>
          {chapters.map(c => (
            <button key={c.id} onClick={() => startQuiz(c.id)} className="card text-left hover:border-sjx-gold">
              {c.chapter_name}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div>
          {questions.map((q, idx) => (
            <div key={q.id} className="card mb-6">
              <p className="mb-4 text-lg">{idx + 1}. {q.question_text}</p>
              <div className="grid grid-cols-1 gap-2">
                {['a', 'b', 'c', 'd'].map(opt => (
                  q[`option_${opt}`] && (
                    <button 
                      key={opt}
                      onClick={() => setAnswers({...answers, [q.id]: opt})}
                      className={`p-3 text-left rounded border ${answers[q.id] === opt ? 'border-sjx-gold bg-sjx-gold/20' : 'border-gray-600'}`}
                    >
                      {opt.toUpperCase()}. {q[`option_${opt}`]}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
          <button className="btn-gold w-full mt-4" onClick={submitQuiz}>提交試卷</button>
        </div>
      )}

      {step === 4 && (
        <div className="card text-center">
          <h2 className={`text-4xl font-bold mb-4 ${examResult.passed ? 'text-green-500' : 'text-red-500'}`}>
            {examResult.passed ? 'PASSED' : 'FAILED'}
          </h2>
          <p className="text-2xl mb-8">Score: {examResult.score}</p>
          <div className="text-left space-y-4">
            {questions.map(q => (
              <div key={q.id} className="border-b border-gray-700 pb-2">
                <p>{q.question_text}</p>
                <p className="text-sjx-gold">正確答案: {q.correct_answer.toUpperCase()}</p>
                <p className="text-sm text-gray-400">解析: {q.explanation}</p>
              </div>
            ))}
          </div>
          <button className="btn-gold mt-8" onClick={() => window.location.href = '/'}>回首頁</button>
        </div>
      )}
    </div>
  );
}