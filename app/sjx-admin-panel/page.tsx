'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminPanel() {
  const [isAuth, setIsAuth] = useState(false);
  const [pwd, setPwd] = useState('');
  const [tab, setTab] = useState<'students' | 'chapters' | 'questions' | 'results'>('students');
  const [data, setData] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  
  // 篩選狀態
  const [filterType, setFilterType] = useState<'all' | 'quiz' | 'final'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

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
    
    // 統一排序
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

  // 1. 匯出總表 (維持 jsPDF，適用於純英文/數字摘要)
  const exportSummaryPDF = () => {
    const doc = new jsPDF();
    doc.setTextColor(197, 160, 89);
    doc.setFontSize(18);
    doc.text("STARLUX ATC TRAINING - GRADE SUMMARY", 14, 20);

    const filtered = data.filter(r => {
      return filterType === 'all' ? true : r.exam_type === filterType;
    });

    autoTable(doc, {
      startY: 30,
      head: [['Callsign', 'Type', 'Score', 'Status', 'Date']],
      body: filtered.map(r => [r.callsign, r.exam_type.toUpperCase(), r.score, r.passed ? 'PASS' : 'FAIL', new Date(r.created_at).toLocaleDateString()]),
      headStyles: { fillColor: [197, 160, 89] }
    });
    doc.save(`Summary_${new Date().getTime()}.pdf`);
  };

  // 2. 解決中文亂碼：使用 HTML 視窗列印診斷報告 (完美支援 Unicode)
  const exportDetailPDF = async (resultItem: any) => {
    const userAnswers = resultItem.detailed_answers || {};
    
    // 抓取該場考試相關的所有題目
    const { data: questions, error } = await supabase
      .from('sjx_questions')
      .select('*')
      .in('id', Object.keys(userAnswers));

    if (error || !questions) {
      alert("無法讀取題目詳解資料");
      return;
    }

    // 建立一個專用的列印 HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Diagnostic_Report_${resultItem.callsign}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap');
            body { font-family: 'Noto Sans TC', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { border-bottom: 2px solid #c5a059; padding-bottom: 20px; margin-bottom: 30px; }
            .title { color: #c5a059; font-size: 28px; font-weight: bold; margin: 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .info-item { font-size: 14px; }
            .info-label { color: #888; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th { background-color: #1a1a1a; color: #c5a059; text-align: left; padding: 12px; }
            td { border-bottom: 1px solid #eee; padding: 12px; vertical-align: top; }
            .q-text { font-weight: bold; margin-bottom: 5px; display: block; }
            .status-ok { color: #28a745; font-weight: bold; }
            .status-fail { color: #dc3545; font-weight: bold; }
            .explanation { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; background: #f9f9f9; padding: 8px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
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
              <tr>
                <th width="50">#</th>
                <th>QUESTION & EXPLANATION</th>
                <th width="80">USER</th>
                <th width="80">CORRECT</th>
                <th width="60">RESULT</th>
              </tr>
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
                    <td style="color:#c5a059; font-weight:bold;">${correctAns}</td>
                    <td class="${isCorrect ? 'status-ok' : 'status-fail'}">${isCorrect ? 'PASS' : 'FAIL'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="background:#c5a059; border:none; padding:10px 30px; font-weight:bold; cursor:pointer;">確認列印 / 另存 PDF</button>
            <p style="font-size:12px; color:#888;">提示：請在列印視窗選擇「另存為 PDF」以獲取電子檔。</p>
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
    if (!confirm('確定刪除？此動作不可撤銷。')) return;
    await fetch('/api/admin-db', { method: 'POST', body: JSON.stringify({ table: `sjx_${tab}`, action: 'DELETE', id }) });
    fetchData();
  };

  if (!isAuth) return (
    <div className="flex items-center justify-center min-h-screen bg-sjx-dark">
      <div className="card-sjx w-96 text-center shadow-2xl border-sjx-gold/20">
        <h1 className="text-sjx-gold text-2xl mb-6 font-bold uppercase tracking-widest">Instructor Access</h1>
        <input type="password" className="input-dark w-full mb-6 text-center" placeholder="ENTER PASSWORD" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <button className="btn-gold w-full" onClick={handleLogin}>Verify Access</button>
      </div>
    </div>
  );

  return (
    <div className="p-10 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-end mb-10 border-b border-sjx-gold/30 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-sjx-gold tracking-tighter uppercase">ATC Admin Control</h1>
          <p className="text-gray-500 text-sm mt-2 font-mono">Virtual STARLUX Training Management v2.0</p>
        </div>
        <div className="flex gap-1">
          {['students', 'chapters', 'questions', 'results'].map((t: any) => (
            <button key={t} onClick={() => setTab(t)} className={`px-6 py-2 text-xs font-bold tracking-widest transition-all ${tab === t ? 'bg-sjx-gold text-black' : 'bg-sjx-gray text-gray-500 hover:text-white'}`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold uppercase border-l-4 border-sjx-gold pl-3">{tab} Management</h2>
        
        {tab === 'results' && (
          <div className="flex gap-4 items-center">
            <select className="input-dark py-1 text-xs" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
              <option value="all">All Types</option>
              <option value="quiz">Quiz</option>
              <option value="final">Final</option>
            </select>
            <button onClick={exportSummaryPDF} className="btn-gold text-xs">Grade Summary</button>
          </div>
        )}
        
        {tab !== 'results' && (
          <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="btn-gold">+ Add Entry</button>
        )}
      </div>

      <div className="card-sjx p-0 overflow-hidden border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/60 text-sjx-gold text-xs uppercase tracking-wider font-bold">
            <tr>
              <th className="p-4">Primary Identifier</th>
              <th className="p-4">Information / Status</th>
              <th className="p-4">Timestamp</th>
              <th className="p-4 text-right">Operational Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data
              .filter(r => {
                if (tab !== 'results') return true;
                return filterType === 'all' ? true : r.exam_type === filterType;
              })
              .map(item => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                <td className="p-4 font-mono text-sjx-gold">{item.callsign || item.chapter_name || item.student_name}</td>
                <td className="p-4 text-gray-400">
                  {tab === 'questions' ? (
                    <div className="max-w-md truncate">{(item.question_text || "").substring(0, 60)}...</div>
                  ) : tab === 'results' ? (
                     <div className="flex items-center gap-3">
                       <span className={`px-2 py-0.5 rounded-sm font-bold text-[10px] ${item.passed ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                         {item.passed ? "PASS" : "FAIL"} | {item.score}
                       </span>
                       <span className="text-[10px] opacity-40 uppercase tracking-tighter">{item.exam_type}</span>
                       {item.sjx_chapters?.chapter_name && <span className="text-[10px] text-sjx-gold/60 underline">[{item.sjx_chapters.chapter_name}]</span>}
                     </div>
                   ) : item.student_id || item.description}
                </td>
                <td className="p-4 text-[11px] text-gray-600 font-mono">{new Date(item.created_at).toLocaleString()}</td>
                <td className="p-4 text-right space-x-3">
                  {tab === 'results' && (
                    <button onClick={() => exportDetailPDF(item)} className="text-sjx-gold hover:text-white transition-colors text-xs font-bold underline">Detail Report</button>
                  )}
                  {tab !== 'results' && (
                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="text-gray-400 hover:text-sjx-gold">Edit</button>
                  )}
                  <button onClick={() => deleteItem(item.id)} className="text-gray-600 hover:text-red-500">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <div className="p-20 text-center text-gray-600 italic">No records found in database.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="card-sjx w-full max-w-2xl border-sjx-gold/40">
            <h3 className="text-sjx-gold text-xl font-bold mb-6 uppercase border-b border-gray-800 pb-2 flex justify-between">
              <span>{editingItem ? 'Edit' : 'Create'} {tab.slice(0, -1)}</span>
              <span className="text-[10px] text-gray-500 opacity-50">Operational Entry</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {tab === 'students' && (
                <>
                  <input name="callsign" placeholder="CALLSIGN" className="input-dark" defaultValue={editingItem?.callsign} required />
                  <input name="student_name" placeholder="FULL NAME" className="input-dark" defaultValue={editingItem?.student_name} required />
                  <input name="student_id" placeholder="EMPLOYEE ID" className="input-dark" defaultValue={editingItem?.student_id} required />
                  <input name="batch" placeholder="TRAINING BATCH" className="input-dark" defaultValue={editingItem?.batch} />
                </>
              )}
              {tab === 'chapters' && (
                <>
                  <input name="chapter_name" placeholder="CHAPTER TITLE" className="input-dark col-span-2" defaultValue={editingItem?.chapter_name} required />
                  <textarea name="description" placeholder="CONTENT DESCRIPTION" className="input-dark col-span-2 h-32" defaultValue={editingItem?.description} />
                </>
              )}
              {tab === 'questions' && (
                <>
                  <select name="chapter_id" className="input-dark" defaultValue={editingItem?.chapter_id}>
                    {chapters.map(c => <option key={c.id} value={c.id}>{c.chapter_name}</option>)}
                  </select>
                  <select name="exam_type" className="input-dark" defaultValue={editingItem?.exam_type || 'quiz'}>
                    <option value="quiz">Quiz</option>
                    <option value="final">Final</option>
                  </select>
                  <textarea name="question_text" placeholder="QUESTION CONTENT" className="input-dark col-span-2" defaultValue={editingItem?.question_text} required />
                  <input name="option_a" placeholder="Option A (Alpha)" className="input-dark" defaultValue={editingItem?.option_a} required />
                  <input name="option_b" placeholder="Option B (Bravo)" className="input-dark" defaultValue={editingItem?.option_b} required />
                  <input name="option_c" placeholder="Option C (Charlie)" className="input-dark" defaultValue={editingItem?.option_c} />
                  <input name="option_d" placeholder="Option D (Delta)" className="input-dark" defaultValue={editingItem?.option_d} />
                  <select name="correct_answer" className="input-dark" defaultValue={editingItem?.correct_answer || 'a'}>
                    <option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>
                  </select>
                  <input name="explanation" placeholder="EXPLANATION / KEY POINT" className="input-dark col-span-2" defaultValue={editingItem?.explanation} />
                </>
              )}
            </div>
            <div className="flex justify-end gap-6 mt-10">
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors uppercase text-xs font-bold">Abort</button>
              <button type="submit" className="btn-gold">Confirm & Deploy</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}