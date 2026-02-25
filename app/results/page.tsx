'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, X, CheckCircle, XCircle, FileText, Calendar } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream mb-2">成績查詢</h1>
        <p className="text-cream/50">查看您的學習進度與歷史紀錄</p>
      </div>
      
      {/* Search Box */}
      <div className="card mb-8">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-cream/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              className="input-field w-full pl-10 text-lg" 
              placeholder="輸入您的 CALLSIGN"
              value={callsign}
              onChange={e => setCallsign(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && fetchResults()}
            />
          </div>
          <button className="btn-primary" onClick={fetchResults} disabled={loading}>
            {loading ? '查詢中...' : '搜尋'}
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.length === 0 && !loading && (
          <div className="card text-center py-16">
            <FileText className="w-12 h-12 text-cream/20 mx-auto mb-4" />
            <p className="text-cream/50">請輸入呼號進行查詢</p>
          </div>
        )}
        
        {results.map((res) => (
          <div key={res.id} className="card flex justify-between items-center border-l-4 border-l-accent">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${res.passed ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {res.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${res.exam_type === 'quiz' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                    {res.exam_type.toUpperCase()}
                  </span>
                  <span className="font-bold text-lg text-cream">
                    {res.exam_type === 'quiz' ? res.sjx_chapters?.chapter_name : '結訓考試'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-cream/50 text-sm">
                  <Calendar className="w-4 h-4" />
                  {new Date(res.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className={`text-2xl font-bold ${res.passed ? 'text-green-400' : 'text-red-400'}`}>{res.score}</p>
                <p className="text-xs uppercase text-cream/40">{res.passed ? 'Passed' : 'Failed'}</p>
              </div>
              {res.exam_type === 'quiz' && (
                <button className="btn-secondary text-sm" onClick={() => showDetails(res)}>詳情</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 小考詳情彈窗 */}
      {selectedQuiz && (
        <div className="fixed inset-0 bg-primary/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-primary-light w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-cream/20 shadow-2xl">
            <div className="sticky top-0 bg-primary-light border-b border-cream/10 p-6 flex justify-between items-center">
              <h3 className="text-xl text-accent font-bold">答題紀錄: {selectedQuiz.sjx_chapters?.chapter_name}</h3>
              <button onClick={() => setSelectedQuiz(null)} className="w-8 h-8 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20 transition-colors">
                <X className="w-5 h-5 text-cream" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {selectedQuiz.questions?.map((q: any, idx: number) => {
                const userAns = selectedQuiz.detailed_answers[q.id];
                const isCorrect = userAns === q.correct_answer;
                return (
                  <div key={q.id} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                    <p className="text-cream mb-3">{idx + 1}. {q.question_text}</p>
                    <div className="text-sm flex items-center gap-4">
                      <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                        你的答案: {userAns?.toUpperCase() || '未答'}
                      </span>
                      {!isCorrect && (
                        <span className="text-accent font-semibold">
                          正確答案: {q.correct_answer.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {q.explanation && (
                      <p className="text-cream/50 mt-3 text-sm bg-primary-dark p-3 rounded-lg">解析: {q.explanation}</p>
                    )}
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