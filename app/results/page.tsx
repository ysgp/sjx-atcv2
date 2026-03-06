'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, X, CheckCircle, XCircle, FileText, Calendar } from 'lucide-react';

export default function ResultsPage() {
  const [callsign, setCallsign] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  
  // 自定義對話框狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    message: string;
  }>({ title: '', message: '' });

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

    if (error) {
      setDialogConfig({
        title: '查詢失敗',
        message: '無法讀取成績資料，請稍後再試'
      });
      setDialogOpen(true);
    }
    else setResults(data || []);
    setLoading(false);
  };

  const showDetails = async (res: any) => {
    if (res.exam_type === 'final') {
      setDialogConfig({
        title: '無法查看',
        message: '結訓考試不提供詳細內容查詢。'
      });
      setDialogOpen(true);
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
          <div key={res.id} className="card flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-l-4 border-l-accent">
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${res.passed ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {res.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap ${res.exam_type === 'quiz' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                    {res.exam_type.toUpperCase()}
                  </span>
                  <span className="font-bold text-base sm:text-lg text-cream truncate">
                    {res.exam_type === 'quiz' ? res.sjx_chapters?.chapter_name : '結訓考試'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-cream/50 text-xs sm:text-sm">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{new Date(res.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
              <div className="text-left sm:text-right">
                <p className={`text-xl sm:text-2xl font-bold ${res.passed ? 'text-green-400' : 'text-red-400'}`}>{res.score}</p>
                <p className="text-xs uppercase text-cream/40">{res.passed ? 'Passed' : 'Failed'}</p>
              </div>
              {res.exam_type === 'quiz' && (
                <button className="btn-secondary text-xs sm:text-sm whitespace-nowrap" onClick={() => showDetails(res)}>詳情</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 小考詳情彈窗 */}
      {selectedQuiz && (
        <div className="fixed inset-0 bg-primary/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-primary-light w-full max-w-full sm:max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-cream/20 shadow-2xl">
            <div className="sticky top-0 bg-primary-light border-b border-cream/10 p-4 sm:p-6 flex justify-between items-center">
              <h3 className="text-base sm:text-xl text-accent font-bold truncate pr-2">答題紀錄: {selectedQuiz.sjx_chapters?.chapter_name}</h3>
              <button onClick={() => setSelectedQuiz(null)} className="w-8 h-8 flex-shrink-0 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20 transition-colors">
                <X className="w-5 h-5 text-cream" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {selectedQuiz.questions?.map((q: any, idx: number) => {
                const userAns = selectedQuiz.detailed_answers[q.id];
                const isCorrect = userAns === q.correct_answer;
                return (
                  <div key={q.id} className={`p-3 sm:p-4 rounded-lg border ${isCorrect ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                    <p className="text-cream text-sm sm:text-base mb-2 sm:mb-3">{idx + 1}. {q.question_text}</p>
                    <div className="text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
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
                      <p className="text-cream/50 mt-2 sm:mt-3 text-xs sm:text-sm bg-primary-dark p-2 sm:p-3 rounded-lg">解析: {q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 自定義對話框 */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md border border-cream/20 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-cream mb-2">{dialogConfig.title}</h3>
                <p className="text-cream/70">{dialogConfig.message}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={() => setDialogOpen(false)} 
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