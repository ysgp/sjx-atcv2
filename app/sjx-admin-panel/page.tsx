'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Lock, Users, BookOpen, FileQuestion, ClipboardList, Plus, Pencil, Trash2, Download, FileText, X } from 'lucide-react';

export default function AdminPanel() {
  const [isAuth, setIsAuth] = useState(false);
  const [pwd, setPwd] = useState('');
  const [tab, setTab] = useState<'students' | 'chapters' | 'questions' | 'results'>('students');
  const [data, setData] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  
  const [filterType, setFilterType] = useState<'all' | 'quiz' | 'final'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const tabConfig = {
    students: { icon: Users, label: '學員管理' },
    chapters: { icon: BookOpen, label: '章節管理' },
    questions: { icon: FileQuestion, label: '題庫管理' },
    results: { icon: ClipboardList, label: '成績管理' },
  };

  const handleLogin = async () => {
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    if (res.ok) setIsAuth(true);
    else alert('驗證失敗');
  };

  const fetchData = async () => {
    let query;
    const table = `sjx_${tab}`;
    if (tab === 'questions') query = supabase.from(table).select('*, sjx_chapters(chapter_name)');
    else if (tab === 'results') query = supabase.from(table).select('*, sjx_chapters(chapter_name)');
    else query = supabase.from(table).select('*');
    
    const { data: list, error } = await query!.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Fetch error:", error);
      setData([]);
    } else {
      setData(list || []);
    }

    const { data: c } = await supabase.from('sjx_chapters').select('*');
    setChapters(c || []);
  };

  useEffect(() => { if (isAuth) fetchData(); }, [isAuth, tab]);

  const exportSummaryPDF = () => {
    const doc = new jsPDF();
    doc.setTextColor(153, 106, 78);
    doc.setFontSize(18);
    doc.text("STARLUX ATC TRAINING - GRADE SUMMARY", 14, 20);

    const filtered = data.filter(r => filterType === 'all' ? true : r.exam_type === filterType);

    autoTable(doc, {
      startY: 30,
      head: [['Callsign', 'Type', 'Score', 'Status', 'Date']],
      body: filtered.map(r => [r.callsign, r.exam_type.toUpperCase(), r.score, r.passed ? 'PASS' : 'FAIL', new Date(r.created_at).toLocaleDateString()]),
      headStyles: { fillColor: [153, 106, 78] }
    });
    doc.save(`Summary_${new Date().getTime()}.pdf`);
  };

  const exportDetailPDF = async (resultItem: any) => {
    const userAnswers = resultItem.detailed_answers || {};
    const { data: questions, error } = await supabase
      .from('sjx_questions')
      .select('*')
      .in('id', Object.keys(userAnswers));

    if (error || !questions) {
      alert("無法讀取題目詳解資料");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Diagnostic_Report_${resultItem.callsign}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap');
            body { font-family: 'Noto Sans TC', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { border-bottom: 2px solid #996A4E; padding-bottom: 20px; margin-bottom: 30px; }
            .title { color: #996A4E; font-size: 28px; font-weight: bold; margin: 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .info-item { font-size: 14px; }
            .info-label { color: #888; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th { background-color: #2F3944; color: #FCF9EA; text-align: left; padding: 12px; }
            td { border-bottom: 1px solid #eee; padding: 12px; vertical-align: top; }
            .q-text { font-weight: bold; margin-bottom: 5px; display: block; }
            .status-ok { color: #28a745; font-weight: bold; }
            .status-fail { color: #dc3545; font-weight: bold; }
            .explanation { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; background: #f9f9f9; padding: 8px; }
            @media print { .no-print { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title">STARLUX ATC Training REPORT</p>
            <p style="margin:5px 0 0 0; opacity:0.6;">ATC培訓考試報告</p>
          </div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">CALLSIGN:</span> ${resultItem.callsign}</div>
            <div class="info-item"><span class="info-label">EXAM TYPE:</span> ${resultItem.exam_type.toUpperCase()}</div>
            <div class="info-item"><span class="info-label">SCORE:</span> <span style="font-size:18px; font-weight:bold;">${resultItem.score}</span></div>
            <div class="info-item"><span class="info-label">DATE:</span> ${new Date(resultItem.created_at).toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr><th width="50">#</th><th>QUESTION & EXPLANATION</th><th width="80">USER</th><th width="80">CORRECT</th><th width="60">RESULT</th></tr>
            </thead>
            <tbody>
              ${questions.map((q, index) => {
                const studentAns = (userAnswers[q.id] || "").toUpperCase();
                const correctAns = (q.correct_answer || "").toUpperCase();
                const isCorrect = studentAns === correctAns;
                return `
                  <tr>
                    <td>${index + 1}</td>
                    <td>
                      <span class="q-text">${q.question_text}</span>
                      <div class="explanation">解析: ${q.explanation || '無提供解析'}</div>
                    </td>
                    <td>${studentAns || 'N/A'}</td>
                    <td style="color:#996A4E; font-weight:bold;">${correctAns}</td>
                    <td class="${isCorrect ? 'status-ok' : 'status-fail'}">${isCorrect ? 'PASS' : 'FAIL'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="background:#996A4E; color:#FCF9EA; border:none; padding:10px 30px; font-weight:bold; cursor:pointer; border-radius:8px;">確認列印 / 另存 PDF</button>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const res = await fetch('/api/admin-db', {
      method: 'POST',
      body: JSON.stringify({ table: `sjx_${tab}`, action: editingItem ? 'UPDATE' : 'INSERT', id: editingItem?.id, data: payload })
    });
    if (res.ok) { setIsModalOpen(false); setEditingItem(null); fetchData(); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    await fetch('/api/admin-db', { method: 'POST', body: JSON.stringify({ table: `sjx_${tab}`, action: 'DELETE', id }) });
    fetchData();
  };

  if (!isAuth) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="card w-96 text-center">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-accent text-2xl mb-2 font-bold">教官後台</h1>
        <p className="text-cream/50 text-sm mb-6">請輸入密碼驗證身分</p>
        <input 
          type="password" 
          className="input-field w-full mb-6 text-center" 
          placeholder="PASSWORD" 
          value={pwd} 
          onChange={e => setPwd(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleLogin()} 
        />
        <button className="btn-primary w-full" onClick={handleLogin}>驗證</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream mb-2">教官後台</h1>
        <p className="text-cream/50">系統管理與配置</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-primary-dark p-2 rounded-xl">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map((t) => {
          const Icon = tabConfig[t].icon;
          return (
            <button 
              key={t} 
              onClick={() => setTab(t)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                tab === t 
                ? 'bg-accent text-cream' 
                : 'text-cream/50 hover:text-cream hover:bg-primary-light'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tabConfig[t].label}
            </button>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-cream">{tabConfig[tab].label}</h2>
        <div className="flex gap-3">
          {tab === 'results' && (
            <>
              <select 
                className="input-field py-2 text-sm" 
                value={filterType} 
                onChange={e => setFilterType(e.target.value as any)}
              >
                <option value="all">全部類型</option>
                <option value="quiz">Quiz</option>
                <option value="final">Final</option>
              </select>
              <button onClick={exportSummaryPDF} className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                匯出成績
              </button>
            </>
          )}
          {tab !== 'results' && (
            <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新增
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary-dark text-accent text-xs uppercase tracking-wider font-bold">
            <tr>
              <th className="p-4">主要識別</th>
              <th className="p-4">資訊 / 狀態</th>
              <th className="p-4">時間</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/5">
            {data.filter(r => tab !== 'results' || (filterType === 'all' || r.exam_type === filterType)).map(item => (
              <tr key={item.id} className="hover:bg-primary-dark/50 transition-colors group">
                <td className="p-4 font-mono text-accent">{item.callsign || item.chapter_name || item.student_name}</td>
                <td className="p-4 text-cream/60">
                  {tab === 'questions' ? (
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md truncate text-cream">{(item.question_text || "").substring(0, 60)}...</div>
                      <div className="flex gap-2">
                        {item.image_url && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-lg">圖片</span>}
                        {item.audio_url && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-lg">音訊</span>}
                      </div>
                    </div>
                  ) : tab === 'results' ? (
                     <div className="flex items-center gap-3">
                       <span className={`px-2 py-1 rounded-lg font-bold text-xs ${item.passed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                         {item.passed ? "PASS" : "FAIL"} | {item.score}
                       </span>
                       <span className="text-xs text-cream/40 uppercase">{item.exam_type}</span>
                       {item.sjx_chapters?.chapter_name && <span className="text-xs text-accent/60">[{item.sjx_chapters.chapter_name}]</span>}
                     </div>
                   ) : item.student_id || item.description}
                </td>
                <td className="p-4 text-xs text-cream/40 font-mono">{new Date(item.created_at).toLocaleString()}</td>
                <td className="p-4 text-right space-x-2">
                  {tab === 'results' && (
                    <button onClick={() => exportDetailPDF(item)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      報告
                    </button>
                  )}
                  {tab !== 'results' && (
                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="text-cream/40 hover:text-accent transition-colors p-2">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteItem(item.id)} className="text-cream/40 hover:text-red-400 transition-colors p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <div className="p-20 text-center text-cream/30">目前沒有資料</div>}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="card w-full max-w-2xl border border-cream/20">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-cream/10">
              <h3 className="text-xl font-bold text-accent">
                {editingItem ? '編輯' : '新增'}{tabConfig[tab].label.replace('管理', '')}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20 transition-colors">
                <X className="w-5 h-5 text-cream" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {tab === 'students' && (
                <>
                  <input name="callsign" placeholder="CALLSIGN" className="input-field" defaultValue={editingItem?.callsign} required />
                  <input name="student_name" placeholder="姓名" className="input-field" defaultValue={editingItem?.student_name} required />
                  <input name="student_id" placeholder="員工編號" className="input-field" defaultValue={editingItem?.student_id} required />
                  <input name="batch" placeholder="培訓梯次" className="input-field" defaultValue={editingItem?.batch} />
                </>
              )}
              {tab === 'chapters' && (
                <>
                  <input name="chapter_name" placeholder="章節名稱" className="input-field col-span-2" defaultValue={editingItem?.chapter_name} required />
                  <textarea name="description" placeholder="章節描述" className="input-field col-span-2 h-32" defaultValue={editingItem?.description} />
                </>
              )}
              {tab === 'questions' && (
                <>
                  <select name="chapter_id" className="input-field" defaultValue={editingItem?.chapter_id}>
                    {chapters.map(c => <option key={c.id} value={c.id}>{c.chapter_name}</option>)}
                  </select>
                  <select name="exam_type" className="input-field" defaultValue={editingItem?.exam_type || 'quiz'}>
                    <option value="quiz">Quiz</option>
                    <option value="final">Final</option>
                  </select>
                  <textarea name="question_text" placeholder="題目內容" className="input-field col-span-2" defaultValue={editingItem?.question_text} required />
                  <input name="option_a" placeholder="選項 A" className="input-field" defaultValue={editingItem?.option_a} required />
                  <input name="option_b" placeholder="選項 B" className="input-field" defaultValue={editingItem?.option_b} required />
                  <input name="option_c" placeholder="選項 C" className="input-field" defaultValue={editingItem?.option_c} />
                  <input name="option_d" placeholder="選項 D" className="input-field" defaultValue={editingItem?.option_d} />
                  <select name="correct_answer" className="input-field" defaultValue={editingItem?.correct_answer || 'a'}>
                    <option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>
                  </select>
                  <input name="image_url" placeholder="圖片網址 (選填)" className="input-field" defaultValue={editingItem?.image_url} />
                  <input name="audio_url" placeholder="音訊網址 (選填)" className="input-field" defaultValue={editingItem?.audio_url} />
                  <input name="explanation" placeholder="解析 / 重點說明" className="input-field col-span-2" defaultValue={editingItem?.explanation} />
                </>
              )}
            </div>
            <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-cream/10">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">取消</button>
              <button type="submit" className="btn-primary">確認儲存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}