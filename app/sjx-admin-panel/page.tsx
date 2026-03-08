'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Lock, Users, BookOpen, FileQuestion, ClipboardList, Plus, Pencil, Trash2, Download, FileText, X, Search, ChevronDown, LogOut, ClipboardCheck } from 'lucide-react';
import { CustomSelect } from '@/app/components';
import Image from 'next/image';
import Link from 'next/link';

export default function AdminPanel() {
  const [isAuth, setIsAuth] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [discordUser, setDiscordUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string>('');
  const [tab, setTab] = useState<'students' | 'chapters' | 'questions' | 'results'>('students');
  const [data, setData] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  
  const [filterType, setFilterType] = useState<'all' | 'quiz' | 'final' | 'rating_atc' | 'rating_a350' | 'rating_a321a339'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [questionType, setQuestionType] = useState<'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'>('single_choice');
  
  // 題庫篩選狀態
  const [questionFilterChapter, setQuestionFilterChapter] = useState<string>('all');
  const [questionFilterExamType, setQuestionFilterExamType] = useState<string>('all');
  const [questionFilterMedia, setQuestionFilterMedia] = useState<string>('all');
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  
  // 學員篩選狀態
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentFilterBatch, setStudentFilterBatch] = useState<string>('all');
  
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

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          setIsAuth(true);
          setDiscordUser(data.user);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');

    if (success) {
      // Recheck auth after successful OAuth
      fetch('/api/auth/session')
        .then(res => res.json())
        .then(data => {
          setIsAuth(true);
          setDiscordUser(data.user);
          // Clean up URL
          window.history.replaceState({}, '', '/sjx-admin-panel');
        });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_code: '授權失敗：未收到授權碼',
        not_member: '您不是 Discord 伺服器成員',
        no_permission: '您沒有訪問權限，請聯繫管理員',
        auth_failed: '登入失敗，請重試',
      };
      setAuthError(errorMessages[error] || '登入失敗');
      setIsCheckingAuth(false);
      // Clean up URL
      window.history.replaceState({}, '', '/sjx-admin-panel');
    }
  }, []);

  const handleDiscordLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuth(false);
    setDiscordUser(null);
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
    // Handle Rating type results with jsPDF (same format as Rating Forms)
    if (resultItem.exam_type.startsWith('rating_')) {
      const details = resultItem.detailed_answers || {};
      const doc = new jsPDF();
      const accentColor: [number, number, number] = [153, 106, 78]; // #996A4E
      const darkColor: [number, number, number] = [47, 57, 68]; // #2F3944

      // Logo
      const logoImg = new window.Image();
      logoImg.src = '/logo_dark.png';
      await new Promise((resolve) => { logoImg.onload = resolve; logoImg.onerror = resolve; });
      if (logoImg.naturalWidth) {
        const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
        const logoHeight = 12;
        const logoWidth = logoHeight * logoAspect;
        doc.addImage(logoImg, 'PNG', 14, 10, logoWidth, logoHeight);
      }

      // Header right side - different format per rating type
      doc.setFontSize(8);
      doc.setTextColor(100);
      if (resultItem.exam_type === 'rating_a321a339') {
        doc.text('FORM: OPS-A32X33X-TR', 196, 12, { align: 'right' });
        doc.text('FLIGHT OPERATIONS DIVISION', 196, 17, { align: 'right' });
        doc.text('VIRTUAL STARLUX AIRLINES', 196, 22, { align: 'right' });
      } else if (resultItem.exam_type === 'rating_a350') {
        doc.text('FORM: OPS-A350-TR-V2', 196, 12, { align: 'right' });
        doc.text('FLIGHT OPERATIONS DIVISION', 196, 17, { align: 'right' });
        doc.text('VIRTUAL STARLUX AIRLINES', 196, 22, { align: 'right' });
      } else {
        doc.text('E-DOCUMENT: TRA-ATC-01', 196, 12, { align: 'right' });
        doc.text('TRAINING DIVISION', 196, 17, { align: 'right' });
        doc.text('VIRTUAL STARLUX AIRLINES', 196, 22, { align: 'right' });
      }

      // Title
      const titleMap: Record<string, string> = {
        'rating_atc': 'ATC TRAINING FINAL RATING',
        'rating_a350': 'A350 TYPE RATING CHECK',
        'rating_a321a339': 'A321neo / A330-900neo TYPE RATING',
      };
      doc.setFontSize(resultItem.exam_type === 'rating_a321a339' ? 16 : 18);
      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.text(titleMap[resultItem.exam_type] || 'TYPE RATING CHECK', 14, 38);

      // Basic Info - different label for A321A339
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text((resultItem.exam_type === 'rating_a321a339' || resultItem.exam_type === 'rating_a350') ? 'PILOT NAME' : 'STUDENT NAME', 14, 48);
      doc.text('CALLSIGN', 90, 48);
      doc.text('DATE', 155, 48);
      
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(details.pilot_name || '-', 14, 55);
      doc.text(resultItem.callsign || '-', 90, 55);
      doc.text(details.date || new Date(resultItem.created_at).toLocaleDateString(), 155, 55);
      doc.setDrawColor(200);
      doc.line(14, 57, 85, 57);
      doc.line(90, 57, 150, 57);
      doc.line(155, 57, 196, 57);

      let y = 65;

      // Rating-specific content
      if (resultItem.exam_type === 'rating_atc') {
        // Part I
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('PART I: COMMUNICATIONS & PHONETICS', 16, y + 5.5);
        doc.text('50%', 190, y + 5.5, { align: 'right' });

        autoTable(doc, {
          startY: y + 10,
          head: [['TASK', 'DESCRIPTION', 'SCORE (Max)']],
          body: [
            ['Phonetics & Numbers', 'Standard alphabet and number accuracy (Ch.3)', `${details.communications?.phonetics || 0} / 20`],
            ['Readback Accuracy', 'Clearance readback precision (Ch.11)', `${details.communications?.readback || 0} / 20`],
            ['Radio Discipline', 'Concise communications (Ch.4) - No filler words', `${details.communications?.radioDiscipline || 0} / 10`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'normal', fontSize: 8 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
          theme: 'grid',
        });

        // Part II
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text('PART II: PROCEDURES & SECTORS', 16, y + 5.5);
        doc.text('30%', 190, y + 5.5, { align: 'right' });

        autoTable(doc, {
          startY: y + 10,
          head: [['TASK', 'DESCRIPTION', 'SCORE (Max)']],
          body: [
            ['Sector Handover', 'Position transfer logic (Ch.13) - Correct sequence', `${details.procedural?.sectorHandover || 0} / 15`],
            ['Navigation / Charting', 'Route understanding (Ch.12) - SID/STAR knowledge', `${details.procedural?.navigation || 0} / 15`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'normal', fontSize: 8 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
          theme: 'grid',
        });

        // Part III
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text('PART III: MISSIONS & EMERGENCY', 16, y + 5.5);
        doc.text('20%', 190, y + 5.5, { align: 'right' });

        autoTable(doc, {
          startY: y + 10,
          head: [['TASK', 'DESCRIPTION', 'SCORE (Max)']],
          body: [
            ['Emergency Response', 'Emergency handling (Ch.15) - Mayday/NITS format', `${details.situational?.emergencyResponse || 0} / 20`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'normal', fontSize: 8 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
          theme: 'grid',
        });
      } else if (resultItem.exam_type === 'rating_a321a339') {
        // Part I - exactly like A321A339RatingForm
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PART I: CROSS-BORDER CHALLENGE - RCKH to VHHX - 40 pts', 16, y + 5.5);
        doc.text('40%', 190, y + 5.5, { align: 'right' });

        const isRouteSelected = details.route === 'rckh_vhhx';
        autoTable(doc, {
          startY: y + 10,
          head: [['ROUTE', 'STANDARDS & PERFORMANCE', 'SCORE (MAX)']],
          body: [
            [`${isRouteSelected ? '[X] ' : '[ ] '}RCKH to VHHX`, `FPM: ${details.crossBorderData?.fpm || 'N/A'}  |  G: ${details.crossBorderData?.g || 'N/A'}`, `${details.crossBorderData?.score || 0} / 40`],
            ['Part I Subtotal (ATC Compliance / Approach Stability)', '', `${details.part1Score || 0} / 40`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 2: { halign: 'center' } },
          theme: 'grid',
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.row.index === 0 && !isRouteSelected) {
              data.cell.styles.textColor = [180, 180, 180];
            }
          },
        });

        // Part II
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text('PART II: VISUAL CIRCUITS - Local RCTP - 40 pts', 16, y + 5.5);
        doc.text('40%', 190, y + 5.5, { align: 'right' });

        autoTable(doc, {
          startY: y + 10,
          head: [['SCENARIO', 'TOUCHDOWN DATA & STANDARD', 'SCORE (MAX)']],
          body: [
            ['T/G (x1)', `FPM: ${details.visualCircuits?.tg?.fpm || '-'}  |  G: ${details.visualCircuits?.tg?.g || '-'}  (Max -250 FPM, 1.25 G)`, `${details.visualCircuits?.tg?.score || 0} / 10`],
            ['Cloud Cap', `FPM: ${details.visualCircuits?.cloudCap?.fpm || '-'}  |  G: ${details.visualCircuits?.cloudCap?.g || '-'}  (Max -300 FPM, 1.25 G)`, `${details.visualCircuits?.cloudCap?.score || 0} / 15`],
            ['Crosswind', `FPM: ${details.visualCircuits?.crosswind?.fpm || '-'}  |  G: ${details.visualCircuits?.crosswind?.g || '-'}  (Max -400 FPM, 1.45 G)`, `${details.visualCircuits?.crosswind?.score || 0} / 15`],
            ['Part II Subtotal (Side-slip / Centerline / Config)', '', `${details.part2Score || 0} / 40`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 2: { halign: 'center' } },
          theme: 'grid',
        });

        // Part III
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text('PART III: RANDOM EMERGENCY - 20 pts', 16, y + 5.5);
        doc.text('20%', 190, y + 5.5, { align: 'right' });

        const emergencyLabels: Record<string, string> = {
          'fuel_leak': 'Fuel Leak - Close crossfeed, ECAM actions, diversion decision',
          'eng_fire': 'ENG Fire - Memory Items, ECAM Actions, fire extinguisher, Mayday',
          'eng_fail': 'ENG Fail - Identify symptoms, adjust approach, beta target, heading',
        };
        const emergencyType = details.emergency?.type || details.emergencyType || '';

        autoTable(doc, {
          startY: y + 10,
          head: [['EMERGENCY TYPE', 'HANDLING STANDARD', 'SCORE (MAX)']],
          body: [
            [`${emergencyType === 'fuel_leak' ? '[X]' : '[ ]'} Fuel Leak`, emergencyLabels['fuel_leak'], `${emergencyType === 'fuel_leak' ? (details.emergency?.score || details.part3Score || 0) : 0} / 20`],
            [`${emergencyType === 'eng_fire' ? '[X]' : '[ ]'} ENG Fire`, emergencyLabels['eng_fire'], `${emergencyType === 'eng_fire' ? (details.emergency?.score || details.part3Score || 0) : 0} / 20`],
            [`${emergencyType === 'eng_fail' ? '[X]' : '[ ]'} ENG Fail`, emergencyLabels['eng_fail'], `${emergencyType === 'eng_fail' ? (details.emergency?.score || details.part3Score || 0) : 0} / 20`],
            ['Part III Subtotal (Procedures / Decision Making)', '', `${details.part3Score || 0} / 20`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 2: { halign: 'center' } },
          theme: 'grid',
          didParseCell: (data: any) => {
            const emergencyTypes = ['fuel_leak', 'eng_fire', 'eng_fail'];
            if (data.section === 'body' && data.row.index < 3) {
              const isSelected = emergencyType === emergencyTypes[data.row.index];
              if (!isSelected) {
                data.cell.styles.textColor = [180, 180, 180];
              }
            }
          },
        });
      } else if (resultItem.exam_type === 'rating_a350') {
        // Part I - exactly like A350RatingForm
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PART I: IFR OPERATIONS - Select One Route - 40 pts', 16, y + 5.5);
        doc.text('40%', 190, y + 5.5, { align: 'right' });

        autoTable(doc, {
          startY: y + 10,
          head: [['ROUTE', 'DATA & CRITERIA', 'SCORE (MAX)']],
          body: [
            [`${details.selectedRoute === 'route1' ? '[X]' : '[ ]'} RCTP > RCKH`, `FPM: ${details.ifrOperations?.route1?.fpm || '-'}  |  G: ${details.ifrOperations?.route1?.g || '-'}  (< -270 FPM, < 1.2G)`, `${details.selectedRoute === 'route1' ? (details.ifrOperations?.route1?.score || 0) : '-'} / 40`],
            [`${details.selectedRoute === 'route2' ? '[X]' : '[ ]'} RCKH > RCTP`, `FPM: ${details.ifrOperations?.route2?.fpm || '-'}  |  G: ${details.ifrOperations?.route2?.g || '-'}  (< -270 FPM, < 1.2G)`, `${details.selectedRoute === 'route2' ? (details.ifrOperations?.route2?.score || 0) : '-'} / 40`],
            ['Part I Subtotal', '', `${details.part1Score || 0} / 40`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 2: { halign: 'center' } },
          theme: 'grid',
          didParseCell: (data: any) => {
            const routes = ['route1', 'route2'];
            if (data.section === 'body' && data.row.index < 2) {
              const isSelected = details.selectedRoute === routes[data.row.index];
              if (!isSelected) {
                data.cell.styles.textColor = [180, 180, 180];
              }
            }
          },
        });

        // Part II
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text('PART II: VISUAL CIRCUITS - Max -350 FPM / 1.3G - 40 pts', 16, y + 5.5);
        doc.text('40%', 190, y + 5.5, { align: 'right' });

        autoTable(doc, {
          startY: y + 10,
          head: [['TASK', 'TOUCHDOWN DATA & STANDARD', 'SCORE (MAX)']],
          body: [
            ['Circuit 1', `FPM: ${details.visualCircuits?.circuit1?.fpm || '-'}  |  G: ${details.visualCircuits?.circuit1?.g || '-'}  (< -350 FPM, < 1.3G)`, `${details.visualCircuits?.circuit1?.score || 0} / 8`],
            ['Circuit 2', `FPM: ${details.visualCircuits?.circuit2?.fpm || '-'}  |  G: ${details.visualCircuits?.circuit2?.g || '-'}  (< -350 FPM, < 1.3G)`, `${details.visualCircuits?.circuit2?.score || 0} / 8`],
            ['Go Around', 'Missed Approach Procedure, Altitude Management, Track Confirmation', `${details.visualCircuits?.goAround || 0} / 8`],
            ['Holding', 'Correct Entry, Standard < 230 KIAS, Altitude +/-100 ft, Return Navigation', `${details.visualCircuits?.holding || 0} / 8`],
            ['Circuit 3', `FPM: ${details.visualCircuits?.circuit3?.fpm || '-'}  |  G: ${details.visualCircuits?.circuit3?.g || '-'}  (< -350 FPM, < 1.3G)`, `${details.visualCircuits?.circuit3?.score || 0} / 8`],
            ['Part II Subtotal', '', `${details.part2Score || 0} / 40`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 2: { halign: 'center' } },
          theme: 'grid',
        });

        // Part III
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFillColor(...accentColor);
        doc.rect(14, y, 182, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text('PART III: EMERGENCY PROCEDURES - Select One - 20 pts', 16, y + 5.5);
        doc.text('20%', 190, y + 5.5, { align: 'right' });

        const emergencyType = details.emergency?.type || details.emergencyType || '';
        autoTable(doc, {
          startY: y + 10,
          head: [['EMERGENCY TYPE', 'HANDLING STANDARD', 'SCORE (MAX)']],
          body: [
            [`${emergencyType === 'eng_fire' ? '[X]' : '[ ]'} ENG FIRE`, 'Memory Items > ECAM Actions > Eng Shutdown > Squawk 7700 > Diversion', `${emergencyType === 'eng_fire' ? (details.emergency?.score || details.part3Score || 0) : '-'} / 20`],
            [`${emergencyType === 'bird_strike' ? '[X]' : '[ ]'} BIRD STRIKE`, 'ECAM Damage Check > Decision > Status Monitor > Diversion - Crew Coord', `${emergencyType === 'bird_strike' ? (details.emergency?.score || details.part3Score || 0) : '-'} / 20`],
            [`${emergencyType === 'eng_failure' ? '[X]' : '[ ]'} ENG Failure`, 'ECAM Items > Route Adjustment', `${emergencyType === 'eng_failure' ? (details.emergency?.score || details.part3Score || 0) : '-'} / 20`],
            ['Part III Subtotal', '', `${details.part3Score || 0} / 20`],
          ],
          headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 2: { halign: 'center' } },
          theme: 'grid',
          didParseCell: (data: any) => {
            const emergencyTypes = ['eng_fire', 'bird_strike', 'eng_failure'];
            if (data.section === 'body' && data.row.index < 3) {
              const isSelected = emergencyType === emergencyTypes[data.row.index];
              if (!isSelected) {
                data.cell.styles.textColor = [180, 180, 180];
              }
            }
          },
        });
      }

      // Rating-specific Remarks and Result sections
      if (resultItem.exam_type === 'rating_a321a339' || resultItem.exam_type === 'rating_a350') {
        // Remarks - A321A339/A350 style
        y = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(9);
        doc.setTextColor(...accentColor);
        doc.setFont('helvetica', 'bold');
        doc.text('EXAMINER REMARKS', 14, y);
        doc.setDrawColor(200);
        doc.rect(14, y + 3, 182, resultItem.exam_type === 'rating_a350' ? 15 : 18);
        if (details.remarks) {
          doc.setTextColor(0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(details.remarks, 16, y + 10, { maxWidth: 178 });
        }

        // Result & Score
        y = y + (resultItem.exam_type === 'rating_a350' ? 22 : 26);
        doc.setFillColor(250, 250, 250);
        doc.rect(14, y, 90, 28, 'F');
        doc.setDrawColor(200);
        doc.rect(14, y, 90, 28);
        
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('OVERALL RESULT', 16, y + 6);
        
        const resultConfig: Record<string, { label: string; color: [number, number, number] }> = {
          fail: { label: 'FAIL', color: [220, 38, 38] },
          partial: { label: 'PARTIAL', color: [217, 119, 6] },
          passed: { label: 'PASSED', color: [22, 163, 74] },
        };
        
        const resultKey = details.result || (resultItem.passed ? 'passed' : 'fail');
        const selected = resultConfig[resultKey] || resultConfig['fail'];
        doc.setFillColor(...selected.color);
        doc.rect(16, y + 10, 50, 8, 'F');
        doc.setTextColor(255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(selected.label, 41, y + 15, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text('CHECK PILOT SIGNATURE', 16, y + 23);
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(details.examiner || '-', 16, y + 27);

        // Final Score Box - A321A339 style
        doc.setFillColor(...darkColor);
        doc.rect(110, y, 86, 28, 'F');
        doc.setTextColor(...accentColor);
        doc.setFontSize(7);
        doc.text('FINAL RATING SCORE', 153, y + 5, { align: 'center' });
        doc.setTextColor(255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(resultItem.score.toString(), 153, y + 15, { align: 'center' });
        doc.setFontSize(6);
        doc.setTextColor(...accentColor);
        doc.text('PASSING REQ: >= 80 / 100', 153, y + 19, { align: 'center' });
        
        // Part scores (inside box)
        doc.setFontSize(5);
        doc.setTextColor(180);
        doc.text(`P1: ${details.part1Score || 0}`, 120, y + 25);
        doc.text(`P2: ${details.part2Score || 0}`, 145, y + 25);
        doc.text(`P3: ${details.part3Score || 0}`, 170, y + 25);
      } else {
        // Default Remarks for ATC and A350
        y = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(9);
        doc.setTextColor(...accentColor);
        doc.setFont('helvetica', 'bold');
        doc.text('INSTRUCTOR REMARKS', 14, y);
        doc.setDrawColor(200);
        doc.rect(14, y + 3, 182, 20);
        if (details.remarks) {
          doc.setTextColor(0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(details.remarks, 16, y + 10, { maxWidth: 178 });
        }

        // Result & Score Section
        y = y + 28;
        doc.setFillColor(250, 250, 250);
        doc.rect(14, y, 110, 22, 'F');
        doc.setDrawColor(200);
        doc.rect(14, y, 110, 22);
        
        const resultConfig: Record<string, { label: string; color: [number, number, number] }> = {
          fail: { label: 'FAIL', color: [220, 38, 38] },
          partial: { label: 'PARTIAL', color: [217, 119, 6] },
          passed: { label: 'PASSED', color: [22, 163, 74] },
        };
        
        const resultKey = details.result || (resultItem.passed ? 'passed' : 'fail');
        const selected = resultConfig[resultKey] || resultConfig['fail'];
        doc.setFillColor(...selected.color);
        doc.rect(20, y + 6, 60, 10, 'F');
        doc.setTextColor(255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(selected.label, 50, y + 13, { align: 'center' });

        // Overall Score Box
        doc.setFillColor(...darkColor);
        doc.rect(130, y, 66, 22, 'F');
        doc.setTextColor(...accentColor);
        doc.setFontSize(8);
        doc.text('OVERALL SCORE', 163, y + 5, { align: 'center' });
        doc.setTextColor(255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(resultItem.score.toString(), 163, y + 16, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(...accentColor);
        doc.text('MINIMUM REQ: 80', 163, y + 20, { align: 'center' });

        // Signature for ATC and A350
        y = y + 28;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('INSTRUCTOR SIGNATURE', 14, y);
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.text(details.examiner || '-', 14, y + 8);
        doc.setDrawColor(0);
        doc.line(14, y + 10, 100, y + 10);
      }

      // Open PDF in new window for preview
      const pdfBlobUrl = doc.output('bloburl');
      window.open(pdfBlobUrl, '_blank');
      return;
    }

    // Original Quiz/Final logic
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
          .select('id, discord_id')
          .eq('callsign', pilot.callsign)
          .single();

        if (!existing) {
          // 新建學員資料，包含 Discord ID（如果 vAMSYS 有提供）
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
                batch: new Date().getFullYear().toString(),
                ...(pilot.discord_id && {
                  discord_id: pilot.discord_id,
                  discord_linked_at: new Date().toISOString(),
                })
              }
            })
          });

          if (res.ok) successCount++;
          else failCount++;
        } else if (!existing.discord_id && pilot.discord_id) {
          // 現有學員但沒有 Discord ID，從 vAMSYS 更新
          const res = await fetch('/api/admin-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'sjx_students',
              action: 'UPDATE',
              id: existing.id,
              data: {
                discord_id: pilot.discord_id,
                discord_linked_at: new Date().toISOString(),
              }
            })
          });

          if (res.ok) successCount++;
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

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="card w-96 text-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Lock className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-accent text-2xl mb-2 font-bold">教官後台</h1>
          <p className="text-cream/50 text-sm">驗證中...</p>
        </div>
      </div>
    );
  }

  if (!isAuth) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="card w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-accent text-2xl mb-2 font-bold">教官後台</h1>
        <p className="text-cream/50 text-sm mb-8">使用 Discord 帳號登入</p>
        
        {authError && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-lg mb-6 text-sm">
            {authError}
          </div>
        )}
        
        <button 
          className="btn-primary w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] transition-colors" 
          onClick={handleDiscordLogin}
        >
          <svg className="w-6 h-6" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
          </svg>
          使用 Discord 登入
        </button>
        
        <div className="mt-6 text-xs text-cream/40">
          <p>需要擁有指定身分組才能訪問</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-cream mb-2">教官後台</h1>
          <p className="text-cream/50">系統管理與配置</p>
        </div>
        
        {/* User Info & Logout */}
        {discordUser && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-primary-dark px-4 py-2 rounded-lg border border-cream/10">
              {discordUser.avatar ? (
                <img 
                  src={`https://cdn.discordapp.com/avatars/${discordUser.userId}/${discordUser.avatar}.png?size=32`}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-accent font-bold text-sm">
                    {discordUser.username?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-cream text-sm font-medium">
                {discordUser.username}
                {discordUser.discriminator && discordUser.discriminator !== '0' && (
                  <span className="text-cream/40">#{discordUser.discriminator}</span>
                )}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="btn-secondary flex items-center gap-2 text-sm hover:!bg-red-500/20 hover:!text-red-400 hover:!border-red-500/50 transition-colors"
              title="登出"
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          </div>
        )}
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
        
        {/* Rating Forms Link */}
        <Link
          href="/sjx-admin-panel/rating-forms"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ml-auto bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-cream border border-purple-500/30 hover:border-purple-500/50 hover:from-purple-500/30 hover:to-blue-500/30"
        >
          <ClipboardCheck className="w-4 h-4" />
          考核表單
        </Link>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-cream">{tabConfig[tab].label}</h2>
        <div className="flex gap-3">
          {tab === 'students' && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
                <input
                  type="text"
                  placeholder="搜尋學員..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="input-field pl-10 w-64"
                />
              </div>
              <CustomSelect
                options={[
                  { value: 'all', label: '全部梯次' },
                  ...Array.from(new Set(data.filter(d => d.batch).map(d => d.batch))).map(b => ({ value: b, label: b }))
                ]}
                value={studentFilterBatch}
                onChange={(val) => setStudentFilterBatch(val)}
                className="w-40"
              />
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
            </>
          )}
          {tab === 'results' && (
            <>
              <CustomSelect
                options={[
                  { value: 'all', label: '全部類型' },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'final', label: 'Final' },
                  { value: 'rating_atc', label: 'ATC Rating' },
                  { value: 'rating_a350', label: 'A350 Rating' },
                  { value: 'rating_a321a339', label: 'A321/A339 Rating' }
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
          {tab === 'questions' && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
                <input
                  type="text"
                  placeholder="搜尋題目..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  className="input-field pl-10 w-64"
                />
              </div>
              <CustomSelect
                options={[
                  { value: 'all', label: '全部章節' },
                  ...chapters.map(ch => ({ value: ch.id, label: ch.chapter_name }))
                ]}
                value={questionFilterChapter}
                onChange={(val) => setQuestionFilterChapter(val)}
                className="w-48"
              />
              <CustomSelect
                options={[
                  { value: 'all', label: '全部類型' },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'final', label: 'Final' }
                ]}
                value={questionFilterExamType}
                onChange={(val) => setQuestionFilterExamType(val)}
                className="w-36"
              />
              <CustomSelect
                options={[
                  { value: 'all', label: '全部媒體' },
                  { value: 'has_image', label: '有圖片' },
                  { value: 'has_audio', label: '有音訊' },
                  { value: 'has_media', label: '有媒體' },
                  { value: 'no_media', label: '無媒體' }
                ]}
                value={questionFilterMedia}
                onChange={(val) => setQuestionFilterMedia(val)}
                className="w-36"
              />
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
              {data.filter(r => {
                // 成績篩選
                if (tab === 'results') {
                  return filterType === 'all' || r.exam_type === filterType;
                }
                // 學員篩選
                if (tab === 'students') {
                  const matchBatch = studentFilterBatch === 'all' || r.batch === studentFilterBatch;
                  const matchSearch = !studentSearchQuery ||
                    r.callsign?.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                    r.student_name?.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                    r.student_id?.toLowerCase().includes(studentSearchQuery.toLowerCase());
                  return matchBatch && matchSearch;
                }
                // 題庫篩選
                if (tab === 'questions') {
                  const matchChapter = questionFilterChapter === 'all' || r.chapter_id === questionFilterChapter;
                  const matchExamType = questionFilterExamType === 'all' || r.exam_type === questionFilterExamType;
                  const matchMedia = 
                    questionFilterMedia === 'all' ||
                    (questionFilterMedia === 'has_image' && r.image_url) ||
                    (questionFilterMedia === 'has_audio' && r.audio_url) ||
                    (questionFilterMedia === 'has_media' && (r.image_url || r.audio_url)) ||
                    (questionFilterMedia === 'no_media' && !r.image_url && !r.audio_url);
                  const matchSearch = !questionSearchQuery || 
                    (r.question_text?.toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
                     r.option_a?.toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
                     r.option_b?.toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
                     r.option_c?.toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
                     r.option_d?.toLowerCase().includes(questionSearchQuery.toLowerCase()));
                  return matchChapter && matchExamType && matchMedia && matchSearch;
                }
                return true;
              }).map(item => (
              <tr key={item.id} className="hover:bg-primary-dark/50 transition-colors group">
                <td className="p-4 font-mono text-accent">{item.callsign || item.chapter_name || item.student_name}</td>
                <td className="p-4 text-cream/60">
                  {tab === 'questions' ? (
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md truncate text-cream">{(item.question_text || "").substring(0, 60)}...</div>
                      <div className="flex gap-2 flex-wrap">
                        {item.sjx_chapters?.chapter_name && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-lg">{item.sjx_chapters.chapter_name}</span>}
                        <span className="text-[10px] bg-cream/10 text-cream/60 px-2 py-0.5 rounded-lg uppercase">{item.exam_type}</span>
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
                              {pilot.discord_id && (
                                <span className="text-xs bg-[#5865F2]/20 px-2 py-1 rounded-md text-[#5865F2] border border-[#5865F2]/30 font-semibold flex items-center gap-1">
                                  <svg className="w-3 h-3" viewBox="0 0 71 55" fill="currentColor">
                                    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z"/>
                                  </svg>
                                  DC
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
                              {pilot.discord_id && (
                                <span className="text-xs bg-[#5865F2]/20 px-2 py-0.5 rounded-md text-[#5865F2] flex items-center gap-1">
                                  <svg className="w-3 h-3" viewBox="0 0 71 55" fill="currentColor">
                                    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z"/>
                                  </svg>
                                  已綁定
                                </span>
                              )}
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