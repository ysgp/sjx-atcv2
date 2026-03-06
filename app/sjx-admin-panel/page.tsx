'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Lock, Users, BookOpen, FileQuestion, ClipboardList, Plus, Pencil, Trash2, Download, FileText, X, Search, ChevronDown } from 'lucide-react';
import { CustomSelect } from '@/app/components';

export default function AdminPanel() {
  const [isAuth, setIsAuth] = useState(false);
  const [pwd, setPwd] = useState('');
  const [tab, setTab] = useState<'students' | 'chapters' | 'questions' | 'results'>('students');
  const [data, setData] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  
  const [filterType, setFilterType] = useState<'all' | 'quiz' | 'final'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [questionType, setQuestionType] = useState<'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'>('single_choice');
  
  // Modal form state
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('quiz');
  const [selectedCorrectAnswer, setSelectedCorrectAnswer] = useState('a');
  const [multipleChoiceAnswers, setMultipleChoiceAnswers] = useState<string[]>([]);
  const [hasCorrectAnswer, setHasCorrectAnswer] = useState(true);
  const [optionTexts, setOptionTexts] = useState<{a: string, b: string, c: string, d: string}>({
    a: '',
    b: '',
    c: '',
    d: ''
  });
  
  // 自定義對話框狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ type: 'alert', title: '', message: '' });

  // vAMSYS 同步狀態
  const [isVamsysModalOpen, setIsVamsysModalOpen] = useState(false);
  const [vamsysPilots, setVamsysPilots] = useState<any[]>([]);
  const [selectedPilots, setSelectedPilots] = useState<Set<number>>(new Set());
  const [isLoadingVamsys, setIsLoadingVamsys] = useState(false);
  const [vamsysSearchQuery, setVamsysSearchQuery] = useState('');
  const [vamsysStep, setVamsysStep] = useState<'select' | 'confirm'>('select');
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);

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
    else {
      setDialogConfig({
        type: 'alert',
        title: '驗證失敗',
        message: '密碼錯誤，請重新輸入'
      });
      setDialogOpen(true);
    }
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

  // 根據題型重置正確答案的預設值
  useEffect(() => {
    if (questionType === 'single_choice') {
      setSelectedCorrectAnswer(editingItem?.correct_answer || 'a');
      setMultipleChoiceAnswers([]);
    } else if (questionType === 'true_false') {
      setSelectedCorrectAnswer(editingItem?.correct_answer || 'true');
      setMultipleChoiceAnswers([]);
    } else if (questionType === 'multiple_choice') {
      // 如果是編輯模式且有正確答案，解析它
      if (editingItem?.correct_answer && editingItem?.question_type === 'multiple_choice') {
        setMultipleChoiceAnswers(editingItem.correct_answer.split('').filter((x: string) => x));
      } else if (!editingItem) {
        // 新增模式，清空
        setMultipleChoiceAnswers([]);
      }
    } else {
      setMultipleChoiceAnswers([]);
    }    
    // 重置選項文字（編輯模式時載入現有選項）
    setOptionTexts({
      a: editingItem?.option_a || '',
      b: editingItem?.option_b || '',
      c: editingItem?.option_c || '',
      d: editingItem?.option_d || ''
    });    
    // 重置選項文字（編輯模式時載入現有選項）
    setOptionTexts({
      a: editingItem?.option_a || '',
      b: editingItem?.option_b || '',
      c: editingItem?.option_c || '',
      d: editingItem?.option_d || ''
    });
  }, [questionType, editingItem]);

  // 初始化章節 ID
  useEffect(() => {
    if (chapters.length > 0 && !selectedChapterId && !editingItem) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId, editingItem]);

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
      setDialogConfig({
        type: 'alert',
        title: '讀取失敗',
        message: '無法讀取題目詳解資料'
      });
      setDialogOpen(true);
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
    
    try {
      const res = await fetch('/api/admin-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          table: `sjx_${tab}`, 
          action: editingItem ? 'UPDATE' : 'INSERT', 
          id: editingItem?.id, 
          data: payload 
        })
      });
      
      if (res.ok) { 
        setIsModalOpen(false); 
        setEditingItem(null); 
        fetchData(); 
      } else {
        const errorData = await res.json();
        console.error('Save error:', errorData);
        setDialogConfig({
          type: 'alert',
          title: '儲存失敗',
          message: errorData.error || '未知錯誤'
        });
        setDialogOpen(true);
      }
    } catch (error) {
      console.error('Network error:', error);
      setDialogConfig({
        type: 'alert',
        title: '網路錯誤',
        message: '儲存失敗，請檢查網路連線'
      });
      setDialogOpen(true);
    }
  };

  const deleteItem = async (id: string) => {
    setDialogConfig({
      type: 'confirm',
      title: '確定刪除？',
      message: '此操作無法復原，確定要刪除這筆資料嗎？',
      onConfirm: async () => {
        try {
      await fetch('/api/admin-db', { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table: `sjx_${tab}`, action: 'DELETE', id }) 
      });
          fetchData();
        } catch (error) {
          console.error('Delete error:', error);
          setDialogConfig({
            type: 'alert',
            title: '刪除失敗',
            message: '無法刪除此資料'
          });
          setDialogOpen(true);
        }
      }
    });
    setDialogOpen(true);
  };

  // 從 vAMSYS 獲取飛行員列表
  const fetchVamsysPilots = async () => {
    setIsLoadingVamsys(true);
    try {
      const response = await fetch('/api/vamsys/pilots');
      const data = await response.json();
      
      if (data.success) {
        setVamsysPilots(data.pilots);
      } else {
        // 關閉 modal 並顯示詳細錯誤信息
        setIsVamsysModalOpen(false);
        
        const errorMessage = data.hint 
          ? `${data.error}\n\n💡 ${data.hint}`
          : data.error || '無法從 vAMSYS 獲取飛行員資料';
        
        setDialogConfig({
          type: 'alert',
          title: 'vAMSYS 連線失敗',
          message: errorMessage
        });
        setDialogOpen(true);
        
        // 在控制台輸出技術細節
        if (data.details) {
          console.error('vAMSYS Error Details:', data.details);
        }
        if (data.technicalDetails) {
          console.error('Technical Details:', data.technicalDetails);
        }
      }
    } catch (error) {
      console.error('vAMSYS fetch error:', error);
      setIsVamsysModalOpen(false);
      
      setDialogConfig({
        type: 'alert',
        title: '網路錯誤',
        message: '無法連接到 vAMSYS 服務，請檢查網路連線或防火牆設定'
      });
      setDialogOpen(true);
    } finally {
      setIsLoadingVamsys(false);
    }
  };

  // 導入選中的飛行員
  const importSelectedPilots = async () => {
    if (selectedPilots.size === 0) {
      setDialogConfig({
        type: 'alert',
        title: '未選擇飛行員',
        message: '請至少選擇一位飛行員進行導入'
      });
      setDialogOpen(true);
      return;
    }

    setIsLoadingVamsys(true);
    let successCount = 0;
    let failCount = 0;

    for (const pilotId of Array.from(selectedPilots)) {
      const pilot = vamsysPilots.find(p => p.id === pilotId);
      if (!pilot) continue;

      try {
        // 檢查是否已存在
        const { data: existing } = await supabase
          .from('sjx_students')
          .select('id')
          .eq('callsign', pilot.callsign)
          .single();

        if (!existing) {
          const res = await fetch('/api/admin-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'sjx_students',
              action: 'INSERT',
              data: {
                callsign: pilot.callsign,
                student_name: pilot.name,
                student_id: `VAMSYS-${pilot.id}`,
                batch: new Date().getFullYear().toString()
              }
            })
          });

          if (res.ok) successCount++;
          else failCount++;
        }
      } catch (error) {
        console.error('Import error for pilot:', pilot.callsign, error);
        failCount++;
      }
    }

    setIsLoadingVamsys(false);
    setIsVamsysModalOpen(false);
    setSelectedPilots(new Set());
    setVamsysStep('select'); // 重置步驟
    fetchData();

    setDialogConfig({
      type: 'alert',
      title: '導入完成',
      message: `成功導入 ${successCount} 位飛行員${failCount > 0 ? `，${failCount} 位失敗或已存在` : ''}`
    });
    setDialogOpen(true);
  };

  // 切換飛行員選擇
  const togglePilotSelection = (pilotId: number) => {
    const newSelection = new Set(selectedPilots);
    if (newSelection.has(pilotId)) {
      newSelection.delete(pilotId);
    } else {
      newSelection.add(pilotId);
    }
    setSelectedPilots(newSelection);
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
          {tab === 'students' && (
            <div className="relative">
              <button 
                onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                className="btn-primary flex items-center gap-2"
                disabled={isLoadingVamsys}
              >
                <Plus className="w-4 h-4" />
                新增學員
                <ChevronDown className="w-4 h-4" />
              </button>
              {isAddDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsAddDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-navy-900/98 backdrop-blur-sm border border-cream/30 rounded-lg shadow-2xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setIsAddDropdownOpen(false);
                        setIsVamsysModalOpen(true);
                        setVamsysPilots([]);
                        setSelectedPilots(new Set());
                        setVamsysSearchQuery('');
                        setVamsysStep('select');
                        fetchVamsysPilots();
                      }}
                      disabled={isLoadingVamsys}
                      className="w-full px-4 py-3 text-left hover:bg-cream/15 transition-colors flex items-center gap-3 text-cream border-b border-cream/20"
                    >
                      <Users className="w-4 h-4" />
                      <span>{isLoadingVamsys ? '載入中...' : '從 vAMSYS 同步'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsAddDropdownOpen(false);
                        setEditingItem(null);
                        setIsModalOpen(true);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-cream/15 transition-colors flex items-center gap-3 text-cream"
                    >
                      <Plus className="w-4 h-4" />
                      <span>手動新增學員</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === 'results' && (
            <>
              <CustomSelect
                options={[
                  { value: 'all', label: '全部類型' },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'final', label: 'Final' }
                ]}
                value={filterType}
                onChange={(val) => setFilterType(val as any)}
                className="w-48"
              />
              <button onClick={exportSummaryPDF} className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                匯出成績
              </button>
            </>
          )}
          {tab !== 'results' && tab !== 'students' && (
            <button onClick={() => { 
              setEditingItem(null); 
              setQuestionType('single_choice');
              setSelectedChapterId(chapters[0]?.id || '');
              setSelectedExamType('quiz');
              setSelectedCorrectAnswer('a');
              setMultipleChoiceAnswers([]);
              setHasCorrectAnswer(true);
              setIsModalOpen(true); 
            }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新增
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
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
                    <button onClick={() => { 
                      setEditingItem(item); 
                      // 設定題型，如果是舊題目沒有 question_type，預設為 single_choice
                      if (tab === 'questions') {
                        setQuestionType(item.question_type || 'single_choice');
                        setSelectedChapterId(item.chapter_id || chapters[0]?.id || '');
                        setSelectedExamType(item.exam_type || 'quiz');
                        setSelectedCorrectAnswer(item.correct_answer || 'a');
                        // 設定是否有正確答案
                        setHasCorrectAnswer(item.has_correct_answer !== 'false');
                        // 如果是多選題，將答案字串轉換為數組
                        if (item.question_type === 'multiple_choice') {
                          setMultipleChoiceAnswers((item.correct_answer || '').split('').filter((x: string) => x));
                        } else {
                          setMultipleChoiceAnswers([]);
                        }
                      }
                      setIsModalOpen(true); 
                    }} className="text-cream/40 hover:text-accent transition-colors p-2">
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
        </div>
        {data.length === 0 && <div className="p-20 text-center text-cream/30">目前沒有資料</div>}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <form onSubmit={handleSave} className="card w-full max-w-full sm:max-w-md md:max-w-2xl border border-cream/20 max-h-[90vh] flex flex-col">
            {/* Header - Fixed */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-cream/10 flex-shrink-0">
              <h3 className="text-xl font-bold text-accent">
                {editingItem ? '編輯' : '新增'}{tabConfig[tab].label.replace('管理', '')}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20 transition-colors">
                <X className="w-5 h-5 text-cream" />
              </button>
            </div>

            {/* Top Section - Fixed (for students/chapters, all content; for questions, only top fields) */}
            {tab !== 'questions' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            ) : (
              <>
                {/* Questions - Fixed Top Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                  <CustomSelect
                    name="chapter_id"
                    options={chapters.map(c => ({ value: c.id, label: c.chapter_name }))}
                    value={selectedChapterId}
                    onChange={setSelectedChapterId}
                    placeholder="選擇章節"
                  />
                  <CustomSelect
                    name="exam_type"
                    options={[
                      { value: 'quiz', label: 'Quiz' },
                      { value: 'final', label: 'Final' }
                    ]}
                    value={selectedExamType}
                    onChange={setSelectedExamType}
                  />
                  <textarea name="question_text" placeholder="題目內容" className="input-field col-span-2 resize-none" rows={5} defaultValue={editingItem?.question_text} required />
                  
                  {/* 題型選擇 Tabs */}
                  <div className="col-span-2 border-b border-cream/10 mb-0">
                    <div className="flex gap-2 -mb-px">
                      {[
                        { type: 'single_choice', label: '單選題', icon: '◉' },
                        { type: 'multiple_choice', label: '多選題', icon: '☑' },
                        { type: 'true_false', label: '是非題', icon: '✓✗' },
                        { type: 'fill_blank', label: '填空題', icon: '___' },
                        { type: 'short_answer', label: '簡答題', icon: '📝' }
                      ].map(({ type, label, icon }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setQuestionType(type as any)}
                          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                            questionType === type
                              ? 'border-accent text-accent'
                              : 'border-transparent text-cream/50 hover:text-cream/70'
                          }`}
                        >
                          <span>{icon}</span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <input type="hidden" name="question_type" value={questionType} />
                </div>

                {/* Questions - Scrollable Middle Section */}
                <div className="overflow-y-auto flex-1 pr-2 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* 正確答案設定 Toggle */}
                  <div className="col-span-2 bg-primary-dark border border-cream/10 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setHasCorrectAnswer(!hasCorrectAnswer)}
                          className={`relative w-14 h-7 rounded-full transition-colors ${
                            hasCorrectAnswer ? 'bg-accent' : 'bg-cream/20'
                          }`}
                        >
                          <span 
                            className={`absolute top-1 left-1 w-5 h-5 bg-cream rounded-full transition-transform ${
                              hasCorrectAnswer ? 'translate-x-7' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div>
                          <p className="text-cream font-semibold text-sm">
                            {hasCorrectAnswer ? '有正確答案' : '無正確答案（開放式問題）'}
                          </p>
                          <p className="text-cream/50 text-xs">
                            {hasCorrectAnswer ? '此題會計入成績評分' : '此題不計分，僅供練習或討論'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <input type="hidden" name="has_correct_answer" value={hasCorrectAnswer ? 'true' : 'false'} />

                  {/* 根據題型顯示不同的欄位 */}
                  {questionType === 'single_choice' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">A</span>
                        </div>
                        <input 
                          name="option_a" 
                          placeholder="輸入選項 A 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_a} 
                          onChange={(e) => setOptionTexts({...optionTexts, a: e.target.value})} 
                          required 
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">B</span>
                        </div>
                        <input 
                          name="option_b" 
                          placeholder="輸入選項 B 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_b} 
                          onChange={(e) => setOptionTexts({...optionTexts, b: e.target.value})} 
                          required 
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">C</span>
                        </div>
                        <input 
                          name="option_c" 
                          placeholder="輸入選項 C 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_c} 
                          onChange={(e) => setOptionTexts({...optionTexts, c: e.target.value})} 
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">D</span>
                        </div>
                        <input 
                          name="option_d" 
                          placeholder="輸入選項 D 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_d} 
                          onChange={(e) => setOptionTexts({...optionTexts, d: e.target.value})} 
                        />
                      </div>
                      {hasCorrectAnswer && (
                        <CustomSelect
                          name="correct_answer"
                          options={[
                            { value: 'a', label: 'A' },
                            { value: 'b', label: 'B' },
                            { value: 'c', label: 'C' },
                            { value: 'd', label: 'D' }
                          ]}
                          value={selectedCorrectAnswer}
                          onChange={setSelectedCorrectAnswer}
                        />
                      )}
                      {!hasCorrectAnswer && <div className="col-span-1"></div>}
                    </>
                  )}

                  {questionType === 'multiple_choice' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">A</span>
                        </div>
                        <input 
                          name="option_a" 
                          placeholder="輸入選項 A 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_a} 
                          onChange={(e) => setOptionTexts({...optionTexts, a: e.target.value})} 
                          required 
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">B</span>
                        </div>
                        <input 
                          name="option_b" 
                          placeholder="輸入選項 B 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_b} 
                          onChange={(e) => setOptionTexts({...optionTexts, b: e.target.value})} 
                          required 
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">C</span>
                        </div>
                        <input 
                          name="option_c" 
                          placeholder="輸入選項 C 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_c} 
                          onChange={(e) => setOptionTexts({...optionTexts, c: e.target.value})} 
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent font-bold">D</span>
                        </div>
                        <input 
                          name="option_d" 
                          placeholder="輸入選項 D 的內容" 
                          className="input-field flex-1" 
                          defaultValue={editingItem?.option_d} 
                          onChange={(e) => setOptionTexts({...optionTexts, d: e.target.value})} 
                        />
                      </div>
                      
                      {hasCorrectAnswer && (
                        <div className="col-span-2">
                          <input type="hidden" name="correct_answer" value={multipleChoiceAnswers.sort().join('')} />
                          <p className="text-sm font-semibold text-cream mb-2">選擇正確答案：</p>
                          <div className="grid grid-cols-2 gap-2">
                            {['a', 'b', 'c', 'd'].map(opt => {
                              const isSelected = multipleChoiceAnswers.includes(opt);
                              const optionText = optionTexts[opt as keyof typeof optionTexts];
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setMultipleChoiceAnswers(multipleChoiceAnswers.filter(x => x !== opt));
                                    } else {
                                      setMultipleChoiceAnswers([...multipleChoiceAnswers, opt]);
                                    }
                                  }}
                                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-3 min-h-[60px] ${
                                    isSelected
                                      ? 'border-accent bg-accent/20'
                                      : 'border-cream/20 hover:border-cream/40'
                                  }`}
                                >
                                  <div className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                    isSelected ? 'bg-accent border-accent' : 'border-cream/40'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-4 h-4 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                                    <span className={`text-base font-bold ${
                                      isSelected ? 'text-accent' : 'text-cream/60'
                                    }`}>
                                      {opt.toUpperCase()}
                                    </span>
                                    {optionText && (
                                      <span className={`text-xs text-left line-clamp-1 ${
                                        isSelected ? 'text-cream/80' : 'text-cream/40'
                                      }`}>
                                        {optionText}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-cream/50 mt-2">點擊選項來選擇正確答案（可多選）</p>
                        </div>
                      )}
                    </>
                  )}

                  {questionType === 'true_false' && hasCorrectAnswer && (
                    <CustomSelect
                      name="correct_answer"
                      className="col-span-2"
                      options={[
                        { value: 'true', label: '正確 (True)' },
                        { value: 'false', label: '錯誤 (False)' }
                      ]}
                      value={selectedCorrectAnswer}
                      onChange={setSelectedCorrectAnswer}
                    />
                  )}

                  {questionType === 'fill_blank' && hasCorrectAnswer && (
                    <div className="col-span-2">
                      <input 
                        name="correct_answer" 
                        placeholder="正確答案 (多個答案用逗號分隔)" 
                        className="input-field w-full" 
                        defaultValue={editingItem?.correct_answer}
                        required={hasCorrectAnswer}
                      />
                      <p className="text-xs text-cream/50 mt-1">填空題答案，如有多個可能答案請用逗號分隔（例: 答案1, 答案2）</p>
                    </div>
                  )}

                  {questionType === 'short_answer' && hasCorrectAnswer && (
                    <div className="col-span-2">
                      <textarea 
                        name="correct_answer" 
                        placeholder="關鍵字 (用逗號分隔，只要包含任一關鍵字即算正確)" 
                        className="input-field w-full h-24 resize-none" 
                        defaultValue={editingItem?.correct_answer}
                        required={hasCorrectAnswer}
                      />
                      <p className="text-xs text-cream/50 mt-1">簡答題關鍵字，學員答案包含任一關鍵字即給分（關鍵字用逗號分隔）</p>
                    </div>
                  )}

                  <input name="image_url" placeholder="圖片網址 (選填)" className="input-field" defaultValue={editingItem?.image_url} />
                  <input name="audio_url" placeholder="音訊網址 (選填)" className="input-field" defaultValue={editingItem?.audio_url} />
                  <input name="explanation" placeholder="解析 / 重點說明" className="input-field col-span-2" defaultValue={editingItem?.explanation} />
                  </div>
                </div>
              </>
            )}

            {/* Footer - Fixed */}
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-cream/10 flex-shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">取消</button>
              <button type="submit" className="btn-primary">確認儲存</button>
            </div>
          </form>
        </div>
      )}

      {/* 自定義對話框 */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md border border-cream/20 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                dialogConfig.type === 'alert' ? 'bg-accent/20' : 'bg-red-500/20'
              }`}>
                {dialogConfig.type === 'alert' ? (
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-cream mb-2">{dialogConfig.title}</h3>
                <p className="text-cream/70">{dialogConfig.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              {dialogConfig.type === 'confirm' && (
                <button 
                  onClick={() => setDialogOpen(false)} 
                  className="btn-secondary"
                >
                  取消
                </button>
              )}
              <button 
                onClick={() => {
                  setDialogOpen(false);
                  if (dialogConfig.onConfirm) {
                    dialogConfig.onConfirm();
                  }
                }} 
                className={dialogConfig.type === 'confirm' ? 'bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors' : 'btn-primary'}
              >
                {dialogConfig.type === 'confirm' ? '確定刪除' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* vAMSYS 飛行員同步對話框 */}
      {isVamsysModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-5xl border border-cream/20 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-cream/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-cream">vAMSYS 飛行員同步</h3>
                  <p className="text-cream/50 text-sm mt-1">
                    {vamsysStep === 'select' ? '選擇要導入的飛行員' : '確認導入資料'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* 步驟指示器 */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    vamsysStep === 'select' ? 'bg-accent/20 text-accent' : 'bg-cream/10 text-cream/40'
                  }`}>
                    <span className="font-bold">1</span>
                    <span className="text-sm">選擇</span>
                  </div>
                  <div className="w-8 h-0.5 bg-cream/20" />
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    vamsysStep === 'confirm' ? 'bg-accent/20 text-accent' : 'bg-cream/10 text-cream/40'
                  }`}>
                    <span className="font-bold">2</span>
                    <span className="text-sm">確認</span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsVamsysModalOpen(false);
                    setSelectedPilots(new Set());
                    setVamsysSearchQuery('');
                    setVamsysStep('select');
                  }} 
                  className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20 transition-colors"
                >
                  <X className="w-5 h-5 text-cream" />
                </button>
              </div>
            </div>

            {/* 步驟 1: 選擇飛行員 */}
            {vamsysStep === 'select' && (
              <>
                {/* Search and Stats Bar */}
                <div className="mb-4 space-y-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cream/40" />
                    <input
                      type="text"
                      value={vamsysSearchQuery}
                      onChange={(e) => setVamsysSearchQuery(e.target.value)}
                      placeholder="搜尋 Callsign、姓名或郵箱..."
                      disabled={isLoadingVamsys}
                      className="w-full pl-12 pr-4 py-3 bg-primary-light border border-cream/10 rounded-lg text-cream placeholder:text-cream/30 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {vamsysSearchQuery && (
                      <button
                        onClick={() => setVamsysSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-primary-light rounded-lg p-3 border border-cream/5">
                      <div className="text-cream/50 text-xs mb-1">總飛行員</div>
                      <div className="text-2xl font-bold text-cream">
                        {isLoadingVamsys ? (
                          <div className="h-8 w-12 bg-cream/10 animate-pulse rounded" />
                        ) : (
                          vamsysPilots.length
                        )}
                      </div>
                    </div>
                    <div className="bg-primary-light rounded-lg p-3 border border-cream/5">
                      <div className="text-cream/50 text-xs mb-1">可導入</div>
                      <div className="text-2xl font-bold text-green-400">
                        {isLoadingVamsys ? (
                          <div className="h-8 w-12 bg-green-400/10 animate-pulse rounded" />
                        ) : (
                          vamsysPilots.filter(p => !data.some(s => s.callsign === p.callsign)).length
                        )}
                      </div>
                    </div>
                    <div className="bg-primary-light rounded-lg p-3 border border-cream/5">
                      <div className="text-cream/50 text-xs mb-1">已存在</div>
                      <div className="text-2xl font-bold text-cream/40">
                        {isLoadingVamsys ? (
                          <div className="h-8 w-12 bg-cream/5 animate-pulse rounded" />
                        ) : (
                          vamsysPilots.filter(p => data.some(s => s.callsign === p.callsign)).length
                        )}
                      </div>
                    </div>
                    <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                      <div className="text-accent/70 text-xs mb-1">已選擇</div>
                      <div className="text-2xl font-bold text-accent">{selectedPilots.size}</div>
                    </div>
                  </div>
                </div>

                {/* Pilots List */}
                <div className="flex-1 overflow-auto mb-4">
                  {isLoadingVamsys ? (
                    <div className="text-center py-16">
                      <div className="inline-block w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
                      <p className="text-lg text-cream/70">正在載入飛行員資料...</p>
                      <p className="text-sm mt-2 text-cream/30">請稍候，可能需要幾秒鐘</p>
                    </div>
                  ) : vamsysPilots.length === 0 ? (
                    <div className="text-center py-16 text-cream/50">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">沒有找到飛行員資料</p>
                      <p className="text-sm mt-2 text-cream/30">請檢查 vAMSYS 連線狀態</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Select All */}
                      <div className="sticky top-0 bg-primary-dark/95 backdrop-blur-sm z-10 flex items-center gap-3 p-3 rounded-lg border border-cream/10 mb-3">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const availablePilots = vamsysPilots.filter(p => {
                              const query = vamsysSearchQuery.toLowerCase();
                              const matchesSearch = !query || 
                                     p.callsign?.toLowerCase().includes(query) ||
                                     p.name?.toLowerCase().includes(query) ||
                                     p.email?.toLowerCase().includes(query);
                              const notExisting = !data.some(s => s.callsign === p.callsign);
                              return matchesSearch && notExisting;
                            });
                            return availablePilots.length > 0 && selectedPilots.size === availablePilots.length;
                          })()}
                          onChange={(e) => {
                            const availablePilots = vamsysPilots.filter(p => {
                              const query = vamsysSearchQuery.toLowerCase();
                              const matchesSearch = !query || 
                                     p.callsign?.toLowerCase().includes(query) ||
                                     p.name?.toLowerCase().includes(query) ||
                                     p.email?.toLowerCase().includes(query);
                              const notExisting = !data.some(s => s.callsign === p.callsign);
                              return matchesSearch && notExisting;
                            });
                            if (e.target.checked) {
                              setSelectedPilots(new Set(availablePilots.map(p => p.id)));
                            } else {
                              setSelectedPilots(new Set());
                            }
                          }}
                          className="w-5 h-5 rounded border-cream/30 bg-primary text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-cream">
                          {vamsysSearchQuery ? '全選可用結果' : '全選可導入飛行員'}
                        </span>
                      </div>

                      {/* Pilot Cards */}
                      {vamsysPilots
                        .filter(pilot => {
                          const query = vamsysSearchQuery.toLowerCase();
                          if (!query) return true;
                          return pilot.callsign?.toLowerCase().includes(query) ||
                                 pilot.name?.toLowerCase().includes(query) ||
                                 pilot.email?.toLowerCase().includes(query);
                        })
                        .map((pilot) => {
                          const isExisting = data.some(s => s.callsign === pilot.callsign);
                          return (
                        <div
                          key={pilot.id}
                          onClick={() => !isExisting && togglePilotSelection(pilot.id)}
                          className={`group flex items-center gap-4 p-4 rounded-lg transition-all ${
                            isExisting
                              ? 'bg-cream/5 border-2 border-cream/10 opacity-50 cursor-not-allowed'
                              : selectedPilots.has(pilot.id)
                              ? 'bg-accent/20 border-2 border-accent shadow-lg shadow-accent/10 cursor-pointer'
                              : 'bg-primary-light hover:bg-primary-dark border-2 border-transparent hover:border-cream/10 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPilots.has(pilot.id)}
                            disabled={isExisting}
                            onChange={() => {}} // Handled by parent div onClick
                            className="w-5 h-5 rounded border-cream/30 bg-primary text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className={`font-mono font-bold text-lg ${
                                isExisting ? 'text-cream/40' : 'text-accent'
                              }`}>{pilot.callsign}</span>
                              {isExisting && (
                                <span className="text-xs bg-cream/10 px-2 py-1 rounded-md text-cream/50 border border-cream/20 font-semibold">
                                  已加入
                                </span>
                              )}
                              {pilot.rank && (
                                <span className="text-xs bg-primary/80 px-2 py-1 rounded-md text-cream/70 border border-cream/10">
                                  {pilot.rank}
                                </span>
                              )}
                              {pilot.status && (
                                <span className={`text-xs px-2 py-1 rounded-md font-semibold ${
                                  pilot.status === 'active' 
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                    : 'bg-cream/10 text-cream/50 border border-cream/20'
                                }`}>
                                  {pilot.status.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className={`font-medium ${
                              isExisting ? 'text-cream/40' : 'text-cream'
                            }`}>{pilot.name}</p>
                            {pilot.email && (
                              <p className={`text-xs mt-1.5 font-mono ${
                                isExisting ? 'text-cream/20' : 'text-cream/40'
                              }`}>{pilot.email}</p>
                            )}
                          </div>
                          <div className={`text-xs font-mono px-3 py-1.5 rounded-md ${
                            isExisting ? 'text-cream/20 bg-cream/5' : 'text-cream/30 bg-primary/50'
                          }`}>
                            ID: {pilot.id}
                          </div>
                        </div>
                      )})}

                      {/* No Results */}
                      {vamsysSearchQuery && vamsysPilots.filter(p => {
                        const query = vamsysSearchQuery.toLowerCase();
                        return p.callsign?.toLowerCase().includes(query) ||
                               p.name?.toLowerCase().includes(query) ||
                               p.email?.toLowerCase().includes(query);
                      }).length === 0 && (
                        <div className="text-center py-12 text-cream/50">
                          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">沒有找到符合的飛行員</p>
                          <p className="text-sm mt-2 text-cream/30">試試其他關鍵詞</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions - Step 1 */}
                <div className="flex justify-between items-center pt-4 border-t border-cream/10">
                  <div className="text-sm">
                    <span className="text-cream/60">已選擇 </span>
                    <span className="text-accent font-bold text-lg">{selectedPilots.size}</span>
                    <span className="text-cream/60"> / {vamsysPilots.length} 位飛行員</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVamsysModalOpen(false);
                        setSelectedPilots(new Set());
                        setVamsysSearchQuery('');
                        setVamsysStep('select');
                      }}
                      className="btn-secondary px-6"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => setVamsysStep('confirm')}
                      disabled={selectedPilots.size === 0 || isLoadingVamsys}
                      className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      下一步
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 步驟 2: 確認導入 */}
            {vamsysStep === 'confirm' && (
              <>
                {/* Confirmation Content */}
                <div className="flex-1 overflow-auto mb-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <h4 className="text-amber-300 font-bold mb-1">請確認導入資料</h4>
                        <p className="text-amber-200/70 text-sm">
                          即將導入 <span className="font-bold text-amber-300">{selectedPilots.size}</span> 位飛行員到系統中。重複的 Callsign 將被自動跳過。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selected Pilots List */}
                  <div className="space-y-2">
                    <h4 className="text-cream font-bold mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-accent" />
                      即將導入的飛行員 ({selectedPilots.size})
                    </h4>
                    {vamsysPilots
                      .filter(pilot => selectedPilots.has(pilot.id))
                      .map((pilot, index) => (
                        <div
                          key={pilot.id}
                          className="flex items-center gap-4 p-4 bg-primary-light rounded-lg border border-cream/10"
                        >
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono font-bold text-accent">{pilot.callsign}</span>
                              {pilot.rank && (
                                <span className="text-xs bg-primary px-2 py-0.5 rounded-md text-cream/60 border border-cream/10">
                                  {pilot.rank}
                                </span>
                              )}
                              {pilot.status && (
                                <span className={`text-xs px-2 py-0.5 rounded-md ${
                                  pilot.status === 'active' 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-cream/10 text-cream/50'
                                }`}>
                                  {pilot.status}
                                </span>
                              )}
                            </div>
                            <p className="text-cream text-sm">{pilot.name}</p>
                            {pilot.email && (
                              <p className="text-cream/40 text-xs mt-1 font-mono">{pilot.email}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-cream/40">
                            <div>ID: {pilot.id}</div>
                            <div className="text-green-400">→ VAMSYS-{pilot.id}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Footer Actions - Step 2 */}
                <div className="flex justify-between items-center pt-4 border-t border-cream/10">
                  <button
                    type="button"
                    onClick={() => setVamsysStep('select')}
                    className="btn-secondary px-6 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    上一步
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVamsysModalOpen(false);
                        setSelectedPilots(new Set());
                        setVamsysSearchQuery('');
                        setVamsysStep('select');
                      }}
                      className="btn-secondary px-6"
                    >
                      取消
                    </button>
                    <button
                      onClick={importSelectedPilots}
                      disabled={isLoadingVamsys}
                      className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold"
                    >
                      {isLoadingVamsys ? (
                        <>
                          <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                          導入中...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          確認導入
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}