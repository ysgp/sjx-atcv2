'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResultsPage() {
  const [callsign, setCallsign] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);

  const fetchResults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sjx_results')
      .select(`
        *,
        sjx_chapters(chapter_name)
      `)
      .eq('callsign', callsign.toUpperCase())
      .order('created_at', { ascending: false });

    if (error) alert('查詢出錯');
    else setResults(data || []);
    setLoading(false);
  };

  const showDetails = async (res: any) => {
    if (res.exam_type === 'final') {
      alert('結訓考試不提供詳細內容查詢。');
      return;
    }
    // 抓取題目資訊來比對答案
    const { data: ques } = await supabase
      .from('sjx_questions')
      .select('*')
      .eq('chapter_id', res.chapter_id);
    
    setSelectedQuiz({ ...res, questions: ques });
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-sjx-gold mb-8">學員成績查詢</h1>
      
      <div className="flex gap-4 mb-12">
        <input 
          className="input-dark flex-1 text-xl" 
          placeholder="ENTER CALLSIGN"
          value={callsign}
          onChange={e => setCallsign(e.target.value)}
        />
        <button className="btn-gold" onClick={fetchResults} disabled={loading}>
          {loading ? '查詢中...' : '搜尋'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {results.length === 0 && !loading && <p className="text-gray-500 text-center py-10">請輸入呼號進行查詢</p>}
        
        {results.map((res) => (
          <div key={res.id} className="card flex justify-between items-center border-l-4 border-l-sjx-gold">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded ${res.exam_type === 'quiz' ? 'bg-blue-900 text-blue-200' : 'bg-purple-900 text-purple-200'}`}>
                  {res.exam_type.toUpperCase()}
                </span>
                <span className="font-bold text-lg">
                  {res.exam_type === 'quiz' ? res.sjx_chapters?.chapter_name : '結訓考試 Final'}
                </span>
              </div>
              <p className="text-gray-400 text-sm">{new Date(res.created_at).toLocaleString()}</p>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className={`text-2xl font-bold ${res.passed ? 'text-green-500' : 'text-red-500'}`}>{res.score}</p>
                <p className="text-xs uppercase opacity-50">{res.passed ? 'Passed' : 'Failed'}</p>
              </div>
              {res.exam_type === 'quiz' && (
                <button className="text-sjx-gold hover:underline text-sm" onClick={() => showDetails(res)}>詳情</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 小考詳情彈窗 */}
      {selectedQuiz && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2d2d2d] w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg p-6 border border-sjx-gold">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl text-sjx-gold font-bold">答題紀錄: {selectedQuiz.sjx_chapters ?.chapter_name}</h3>
              <button onClick={() => setSelectedQuiz(null)} className="text-white text-2xl">&times;</button>
            </div>
            
            <div className="space-y-6">
              {selectedQuiz.questions?.map((q: any, idx: number) => {
                const userAns = selectedQuiz.detailed_answers[q.id];
                const isCorrect = userAns === q.correct_answer;
                return (
                  <div key={q.id} className="border-b border-gray-700 pb-4">
                    <p className="mb-2">{idx + 1}. {q.question_text}</p>
                    <div className="text-sm">
                      <p className={isCorrect ? 'text-green-500' : 'text-red-500'}>
                        你的答案: {userAns?.toUpperCase() || '未答'} 
                        {isCorrect ? ' (正確)' : ` (錯誤，正確為 ${q.correct_answer.toUpperCase()})`}
                      </p>
                      <p className="text-gray-400 mt-2 bg-black/30 p-2 rounded">解析: {q.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}