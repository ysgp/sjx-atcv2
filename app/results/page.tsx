'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { X, CheckCircle, XCircle, FileText, Calendar, Download, Plane, User, Award, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to get exam type display name
const getExamTypeName = (examType: string) => {
  const names: Record<string, string> = {
    'quiz': 'QUIZ',
    'final': 'FINAL',
    'rating_atc': 'ATC RATING',
    'rating_a350': 'A350 RATING',
    'rating_a321a339': 'A321/A339 RATING',
  };
  return names[examType] || examType.toUpperCase();
};

// Helper function to get exam type style
const getExamTypeStyle = (examType: string) => {
  if (examType === 'quiz') return 'bg-blue-500/20 text-blue-300';
  if (examType === 'final') return 'bg-purple-500/20 text-purple-300';
  if (examType.startsWith('rating_')) return 'bg-amber-500/20 text-amber-300';
  return 'bg-gray-500/20 text-gray-300';
};

export default function ResultsPage() {
  const [callsign, setCallsign] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [selectedRating, setSelectedRating] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  
  // 自定義對話框狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    message: string;
  }>({ title: '', message: '' });

  // 查詢成績 (使用 useCallback 以便在 useEffect 中使用)
  const fetchResultsByCallsign = useCallback(async (cs: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sjx_results')
      .select(`
        *,
        sjx_chapters(chapter_name)
      `)
      .eq('callsign', cs.toUpperCase())
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
  }, []);

  // 自動從 session 取得 callsign 並查詢成績
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user?.callsign) {
          setCallsign(data.user.callsign);
          await fetchResultsByCallsign(data.user.callsign);
        }
      } catch {
        // Session 讀取失敗，允許手動輸入
      } finally {
        setSessionLoading(false);
      }
    };
    fetchSession();
  }, [fetchResultsByCallsign]);

  // PDF 匯出功能 - 與考核表單一模一樣
  const exportRatingPDF = async (resultItem: any) => {
    setIsGeneratingPDF(true);
    try {
      const details = resultItem.detailed_answers || {};
      const doc = new jsPDF();
      const accentColor: [number, number, number] = [153, 106, 78];
      const darkColor: [number, number, number] = [47, 57, 68];

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

      // Header right side
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

      // Basic Info
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
        // Part I
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
        // Part I
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

      // Remarks and Result sections
      if (resultItem.exam_type === 'rating_a321a339' || resultItem.exam_type === 'rating_a350') {
        // Remarks
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

        // Final Score Box
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
        
        // Part scores
        doc.setFontSize(5);
        doc.setTextColor(180);
        doc.text(`P1: ${details.part1Score || 0}`, 120, y + 25);
        doc.text(`P2: ${details.part2Score || 0}`, 145, y + 25);
        doc.text(`P3: ${details.part3Score || 0}`, 170, y + 25);
      } else {
        // ATC style remarks and result
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

        // Signature
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

      // 在新分頁開啟 PDF
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl as unknown as string, '_blank');
    } catch (error) {
      console.error('PDF generation error:', error);
      setDialogConfig({
        title: 'PDF 匯出失敗',
        message: '無法產生 PDF 檔案，請稍後再試。'
      });
      setDialogOpen(true);
    } finally {
      setIsGeneratingPDF(false);
    }
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
    
    // Rating 成績使用另一個彈窗
    if (res.exam_type.startsWith('rating_')) {
      setSelectedRating(res);
      return;
    }
    
    // Quiz: 檢查是否有 chapter_id
    if (!res.chapter_id) {
      setDialogConfig({
        title: '無法查看',
        message: '此紀錄沒有關聯的章節資料。'
      });
      setDialogOpen(true);
      return;
    }
    
    // 抓取題目資訊來比對答案
    const { data: ques, error } = await supabase
      .from('sjx_questions')
      .select('*')
      .eq('chapter_id', res.chapter_id);
    
    if (error || !ques || ques.length === 0) {
      setDialogConfig({
        title: '讀取失敗',
        message: '無法讀取題目詳解資料，可能題目已被刪除。'
      });
      setDialogOpen(true);
      return;
    }
    
    setSelectedQuiz({ ...res, questions: ques });
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream mb-2">成績查詢</h1>
        <p className="text-cream/50">查看您的學習進度與歷史紀錄</p>
      </div>
      
      {/* 目前登入的呼號 */}
      {callsign && (
        <div className="card mb-8">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-accent" />
            <span className="text-cream/50 text-sm">目前登入呼號</span>
            <span className="text-xl font-mono font-bold text-accent tracking-wider">{callsign}</span>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4">
        {/* Session 載入中 */}
        {sessionLoading && (
          <div className="card text-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-cream/70">載入中...</p>
          </div>
        )}
        
        {/* 沒有成績 */}
        {!sessionLoading && results.length === 0 && !loading && (
          <div className="card text-center py-16">
            <FileText className="w-12 h-12 text-cream/20 mx-auto mb-4" />
            <p className="text-cream/50">尚無成績紀錄</p>
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
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap ${getExamTypeStyle(res.exam_type)}`}>
                    {getExamTypeName(res.exam_type)}
                  </span>
                  <span className="font-bold text-base sm:text-lg text-cream truncate">
                    {res.exam_type === 'quiz' 
                      ? res.sjx_chapters?.chapter_name 
                      : res.exam_type === 'final' 
                        ? '結訓考試' 
                        : res.detailed_answers?.pilot_name || 'Type Rating Check'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-cream/50 text-xs sm:text-sm">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{new Date(res.created_at).toLocaleString()}</span>
                  {res.exam_type.startsWith('rating_') && res.detailed_answers?.examiner && (
                    <span className="text-cream/40">| 考官: {res.detailed_answers.examiner}</span>
                  )}
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
              {res.exam_type.startsWith('rating_') && (
                <button 
                  className="btn-secondary text-xs sm:text-sm whitespace-nowrap"
                  onClick={() => setSelectedRating(res)}
                >
                  詳情
                </button>
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
                const isMultipleChoice = q.question_type === 'multiple_choice';
                const correctAnswers = q.correct_answer?.split(',').map((a: string) => a.trim().toLowerCase()) || [];
                const userAnswers = userAns?.split('').filter((x: string) => x) || [];
                
                return (
                  <div key={q.id} className={`p-3 sm:p-4 rounded-lg border ${isCorrect ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                    <p className="text-cream text-sm sm:text-base mb-3 sm:mb-4">{idx + 1}. {q.question_text}</p>
                    {isMultipleChoice && <p className="text-xs text-accent mb-2">※ 多選題</p>}
                    
                    {/* 顯示所有選項 */}
                    <div className="space-y-2 mb-3">
                      {['a', 'b', 'c', 'd'].map(opt => {
                        if (!q[`option_${opt}`]) return null;
                        const isUserSelected = isMultipleChoice 
                          ? userAnswers.includes(opt)
                          : userAns === opt;
                        const isCorrectOption = isMultipleChoice
                          ? correctAnswers.includes(opt)
                          : q.correct_answer === opt;
                        
                        let optionStyle = 'border-cream/20 bg-primary-dark/50';
                        if (isUserSelected && isCorrectOption) {
                          optionStyle = 'border-green-500 bg-green-500/20';
                        } else if (isUserSelected && !isCorrectOption) {
                          optionStyle = 'border-red-500 bg-red-500/20';
                        } else if (isCorrectOption) {
                          optionStyle = 'border-accent bg-accent/10';
                        }
                        
                        return (
                          <div 
                            key={opt}
                            className={`p-2 sm:p-3 rounded-lg border flex items-center gap-3 ${optionStyle}`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                              isUserSelected && isCorrectOption ? 'bg-green-500 text-white border-green-500' :
                              isUserSelected && !isCorrectOption ? 'bg-red-500 text-white border-red-500' :
                              isCorrectOption ? 'bg-accent text-cream border-accent' :
                              'border-cream/30 text-cream/50'
                            }`}>
                              {opt.toUpperCase()}
                            </span>
                            <span className={`text-sm flex-1 ${
                              isUserSelected || isCorrectOption ? 'text-cream' : 'text-cream/70'
                            }`}>
                              {q[`option_${opt}`]}
                            </span>
                            {isUserSelected && (
                              <span className={`text-xs px-2 py-0.5 rounded ${isCorrectOption ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}`}>
                                你的答案
                              </span>
                            )}
                            {isCorrectOption && !isUserSelected && (
                              <span className="text-xs px-2 py-0.5 rounded bg-accent/30 text-accent">
                                正確答案
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {q.explanation && (
                      <p className="text-cream/50 text-xs sm:text-sm bg-primary-dark p-2 sm:p-3 rounded-lg">解析: {q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rating 詳情彈窗 */}
      {selectedRating && (
        <div className="fixed inset-0 bg-primary/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-primary-light w-full max-w-full sm:max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-cream/20 shadow-2xl">
            <div className="sticky top-0 bg-primary-light border-b border-cream/10 p-4 sm:p-6 flex justify-between items-center">
              <h3 className="text-base sm:text-xl text-accent font-bold truncate pr-2">
                {getExamTypeName(selectedRating.exam_type)} 考核結果
              </h3>
              <button onClick={() => setSelectedRating(null)} className="w-8 h-8 flex-shrink-0 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20 transition-colors">
                <X className="w-5 h-5 text-cream" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary-dark p-3 rounded-lg">
                  <p className="text-cream/50 text-xs mb-1">學員姓名</p>
                  <p className="text-cream font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-accent" />
                    {selectedRating.detailed_answers?.pilot_name || '-'}
                  </p>
                </div>
                <div className="bg-primary-dark p-3 rounded-lg">
                  <p className="text-cream/50 text-xs mb-1">考核日期</p>
                  <p className="text-cream font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    {selectedRating.detailed_answers?.date || new Date(selectedRating.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-primary-dark p-3 rounded-lg">
                  <p className="text-cream/50 text-xs mb-1">考官</p>
                  <p className="text-cream font-semibold flex items-center gap-2">
                    <Award className="w-4 h-4 text-accent" />
                    {selectedRating.detailed_answers?.examiner || '-'}
                  </p>
                </div>
                <div className="bg-primary-dark p-3 rounded-lg">
                  <p className="text-cream/50 text-xs mb-1">考核結果</p>
                  <p className={`font-bold text-lg ${selectedRating.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedRating.detailed_answers?.result?.toUpperCase() || (selectedRating.passed ? 'PASSED' : 'FAILED')}
                  </p>
                </div>
              </div>

              {/* 分數 */}
              <div className={`p-4 rounded-lg border ${selectedRating.passed ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-cream/70">總分</span>
                  <span className={`text-3xl font-bold ${selectedRating.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedRating.score} / 100
                  </span>
                </div>
                {selectedRating.detailed_answers && (
                  <div className="mt-3 pt-3 border-t border-cream/10 grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-cream/50 text-xs">Part I</p>
                      <p className="text-cream font-semibold">{selectedRating.detailed_answers.part1Score || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-cream/50 text-xs">Part II</p>
                      <p className="text-cream font-semibold">{selectedRating.detailed_answers.part2Score || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-cream/50 text-xs">Part III</p>
                      <p className="text-cream font-semibold">{selectedRating.detailed_answers.part3Score || 0}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ATC Rating 詳細評分 */}
              {selectedRating.exam_type === 'rating_atc' && selectedRating.detailed_answers && (
                <div className="space-y-3">
                  <h4 className="text-accent font-semibold text-sm">評分細項</h4>
                  
                  {/* Part I: Communications */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART I: COMMUNICATIONS & PHONETICS (50%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.communications && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Phonetics & Numbers</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.communications.phonetics || 0} / 20</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Readback Accuracy</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.communications.readback || 0} / 20</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Radio Discipline</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.communications.radioDiscipline || 0} / 10</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part II: Procedural */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART II: PROCEDURAL KNOWLEDGE (30%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.procedural && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Sector Handover</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.procedural.sectorHandover || 0} / 20</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Navigation</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.procedural.navigation || 0} / 10</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part III: Situational */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART III: SITUATIONAL AWARENESS (20%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.situational && (
                        <div className="flex justify-between text-sm">
                          <span className="text-cream/70">Emergency Response</span>
                          <span className="text-cream font-semibold">{selectedRating.detailed_answers.situational.emergencyResponse || 0} / 20</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* A321/A339 Rating 詳細評分 */}
              {selectedRating.exam_type === 'rating_a321a339' && selectedRating.detailed_answers && (
                <div className="space-y-3">
                  <h4 className="text-accent font-semibold text-sm">評分細項</h4>
                  
                  {/* Part I: Cross-Border */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART I: CROSS-BORDER CHALLENGE (40%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.crossBorderData && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Route: RCKH → VHHX</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.crossBorderData.score || 0} / 40</span>
                          </div>
                          <div className="flex justify-between text-xs text-cream/50">
                            <span>Landing Data</span>
                            <span>FPM: {selectedRating.detailed_answers.crossBorderData.fpm || '-'} | G: {selectedRating.detailed_answers.crossBorderData.g || '-'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part II: Visual Circuits */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART II: VISUAL CIRCUITS (40%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.visualCircuits && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Touch & Go</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.tg?.score || 0} / 10</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Cloud Cap</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.cloudCap?.score || 0} / 15</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Crosswind</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.crosswind?.score || 0} / 15</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part III: Emergency */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART III: RANDOM EMERGENCY (20%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.emergency && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Emergency Type</span>
                            <span className="text-cream font-semibold uppercase">{selectedRating.detailed_answers.emergency.type?.replace('_', ' ') || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Score</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.emergency.score || 0} / 20</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* A350 Rating 詳細評分 */}
              {selectedRating.exam_type === 'rating_a350' && selectedRating.detailed_answers && (
                <div className="space-y-3">
                  <h4 className="text-accent font-semibold text-sm">評分細項</h4>
                  
                  {/* Part I: IFR Operations */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART I: IFR OPERATIONS (40%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.ifrOperations && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Route 1 (RCTP→RJTT)</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.ifrOperations.route1?.score || 0} / 20</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Route 2 (RCTP→WSSS)</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.ifrOperations.route2?.score || 0} / 20</span>
                          </div>
                          <div className="text-xs text-cream/50 mt-1">
                            Selected: {selectedRating.detailed_answers.selectedRoute === 'route1' ? 'RCTP→RJTT' : selectedRating.detailed_answers.selectedRoute === 'route2' ? 'RCTP→WSSS' : '-'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part II: Visual Circuits */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART II: VISUAL CIRCUITS (40%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.visualCircuits && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Circuit 1 (Clear)</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.circuit1?.score || 0} / 10</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Circuit 2 (Cloud)</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.circuit2?.score || 0} / 10</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Go-Around</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.goAround || 0} / 5</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Holding</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.holding || 0} / 5</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Circuit 3 (Crosswind)</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.visualCircuits.circuit3?.score || 0} / 10</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part III: Emergency */}
                  <div className="bg-primary-dark rounded-lg overflow-hidden">
                    <div className="bg-accent/20 px-3 py-2">
                      <p className="text-accent text-xs font-semibold">PART III: EMERGENCY PROCEDURES (20%)</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {selectedRating.detailed_answers.emergency && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Emergency Type</span>
                            <span className="text-cream font-semibold uppercase">{selectedRating.detailed_answers.emergency.type?.replace('_', ' ') || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-cream/70">Score</span>
                            <span className="text-cream font-semibold">{selectedRating.detailed_answers.emergency.score || 0} / 20</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 備註 */}
              {selectedRating.detailed_answers?.remarks && (
                <div className="bg-primary-dark p-4 rounded-lg">
                  <p className="text-cream/50 text-xs mb-2">考官備註</p>
                  <p className="text-cream text-sm">{selectedRating.detailed_answers.remarks}</p>
                </div>
              )}

              {/* PDF 匯出按鈕 */}
              <button
                onClick={() => exportRatingPDF(selectedRating)}
                disabled={isGeneratingPDF}
                className="w-full mt-4 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                匯出 PDF 成績單
              </button>
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