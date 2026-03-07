'use client';
import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { ArrowLeft, Save, Upload, Download, Printer, RotateCcw, Check, X, Copy, Loader2, MoreVertical, SendHorizonal, Cloud, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface A350RatingFormProps {
  onBack: () => void;
}

interface FormData {
  pilotName: string;
  callsign: string;
  date: string;
  // Part I: IFR Operations (40%) - Select ONE route
  selectedRoute: 'route1' | 'route2' | '';
  route1FPM: string;
  route1G: string;
  route1Score: number;
  route2FPM: string;
  route2G: string;
  route2Score: number;
  // Part II: Visual Circuits (40%)
  circuit1FPM: string;
  circuit1G: string;
  circuit1Score: number;
  circuit2FPM: string;
  circuit2G: string;
  circuit2Score: number;
  goAroundScore: number;
  holdingScore: number;
  circuit3FPM: string;
  circuit3G: string;
  circuit3Score: number;
  // Part III: Emergency Procedures (20%)
  emergencyType: 'eng_fire' | 'bird_strike' | 'eng_failure' | '';
  emergencyScore: number;
  // Remarks
  examinerRemarks: string;
  examinerSignature: string;
  result: 'fail' | 'partial' | 'passed' | '';
}

const defaultFormData: FormData = {
  pilotName: '',
  callsign: '',
  date: '',
  selectedRoute: '',
  route1FPM: '',
  route1G: '',
  route1Score: 0,
  route2FPM: '',
  route2G: '',
  route2Score: 0,
  circuit1FPM: '',
  circuit1G: '',
  circuit1Score: 0,
  circuit2FPM: '',
  circuit2G: '',
  circuit2Score: 0,
  goAroundScore: 0,
  holdingScore: 0,
  circuit3FPM: '',
  circuit3G: '',
  circuit3Score: 0,
  emergencyType: '',
  emergencyScore: 0,
  examinerRemarks: '',
  examinerSignature: '',
  result: '',
};

export default function A350RatingForm({ onBack }: A350RatingFormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [cloudDraftsOpen, setCloudDraftsOpen] = useState(false);
  const [cloudDrafts, setCloudDrafts] = useState<any[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleScoreChange = (field: keyof FormData, value: number, max: number) => {
    const clampedValue = Math.min(Math.max(0, value), max);
    setFormData(prev => ({ ...prev, [field]: clampedValue }));
  };

  // Part I: Only selected route counts (max 40)
  const part1Score = formData.selectedRoute === 'route1' 
    ? formData.route1Score 
    : formData.selectedRoute === 'route2' 
      ? formData.route2Score 
      : 0;
  const part2Score = formData.circuit1Score + formData.circuit2Score + formData.goAroundScore + formData.holdingScore + formData.circuit3Score;
  const part3Score = formData.emergencyScore;
  const totalScore = part1Score + part2Score + part3Score;

  const handleSaveDraft = () => {
    localStorage.setItem('a350-rating-draft', JSON.stringify(formData));
    setSaveMessage({ type: 'success', text: '草稿已儲存' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSaveToCloud = async () => {
    setIsLoadingCloud(true);
    try {
      const res = await fetch('/api/rating-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'a350',
          pilotName: formData.pilotName,
          callsign: formData.callsign,
          draftData: formData,
        }),
      });
      if (res.ok) {
        setSaveMessage({ type: 'success', text: '草稿已儲存至雲端' });
      } else {
        const data = await res.json();
        setSaveMessage({ type: 'error', text: data.error || '雲端儲存失敗' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: '雲端儲存失敗' });
    } finally {
      setIsLoadingCloud(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleLoadCloudDrafts = async () => {
    setIsLoadingCloud(true);
    setCloudDraftsOpen(true);
    try {
      const res = await fetch('/api/rating-drafts?formType=a350');
      if (res.ok) {
        const data = await res.json();
        setCloudDrafts(data.drafts || []);
      } else {
        setCloudDrafts([]);
        setSaveMessage({ type: 'error', text: '無法載入雲端草稿' });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch {
      setCloudDrafts([]);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const handleSelectCloudDraft = (draft: any) => {
    setFormData(draft.draft_data);
    setCloudDraftsOpen(false);
    setSaveMessage({ type: 'success', text: '草稿已從雲端載入' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleDeleteCloudDraft = async (draftId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/rating-drafts?id=${draftId}`, { method: 'DELETE' });
      if (res.ok) {
        setCloudDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch {
      // ignore
    }
  };

  const handleLoadDraft = () => {
    const draft = localStorage.getItem('a350-rating-draft');
    if (draft) {
      try {
        const data = JSON.parse(draft);
        setFormData(data);
        setSaveMessage({ type: 'success', text: '草稿已載入' });
        setTimeout(() => setSaveMessage(null), 3000);
      } catch {
        setSaveMessage({ type: 'error', text: '載入失敗：草稿格式錯誤' });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } else {
      setSaveMessage({ type: 'error', text: '沒有已儲存的草稿' });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(formData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `A350-Rating-${formData.callsign || 'form'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setFormData(data);
        setSaveMessage({ type: 'success', text: '資料已匯入' });
        setTimeout(() => setSaveMessage(null), 3000);
      } catch {
        setSaveMessage({ type: 'error', text: '匯入失敗：檔案格式錯誤' });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Shared PDF generation function
  const generateFullPDF = async (): Promise<{ doc: jsPDF; filename: string }> => {
    const doc = new jsPDF();
    const accentColor: [number, number, number] = [153, 106, 78]; // #996A4E
    const darkColor: [number, number, number] = [47, 57, 68]; // #2F3944
    
    // Logo (maintain aspect ratio)
    const logoImg = new window.Image();
    logoImg.src = '/logo_dark.png';
    await new Promise((resolve) => { logoImg.onload = resolve; });
    const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
    const logoHeight = 12;
    const logoWidth = logoHeight * logoAspect;
    doc.addImage(logoImg, 'PNG', 14, 10, logoWidth, logoHeight);

    // Header right
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('FORM: OPS-A350-TR-V2', 196, 12, { align: 'right' });
    doc.text('FLIGHT OPERATIONS DIVISION', 196, 17, { align: 'right' });
    doc.text('VIRTUAL STARLUX AIRLINES', 196, 22, { align: 'right' });

    // Title
      doc.setFontSize(18);
      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.text('A350 TYPE RATING CHECK', 14, 38);

      // Basic Info
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('PILOT NAME', 14, 48);
      doc.text('CALLSIGN', 90, 48);
      doc.text('DATE', 155, 48);
      
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(formData.pilotName || 'Full Name', 14, 55);
      doc.text(formData.callsign || 'STARWALKER XXX', 90, 55);
      doc.text(formData.date || 'YYYY-MM-DD', 155, 55);
      doc.setDrawColor(200);
      doc.line(14, 57, 85, 57);
      doc.line(90, 57, 150, 57);
      doc.line(155, 57, 196, 57);

      // Part I
      let y = 65;
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
          [`${formData.selectedRoute === 'route1' ? '[X]' : '[ ]'} RCTP > RCKH`, `FPM: ${formData.route1FPM || '-'}  |  G: ${formData.route1G || '-'}  (< -270 FPM, < 1.2G)`, `${formData.selectedRoute === 'route1' ? formData.route1Score : '-'} / 40`],
          [`${formData.selectedRoute === 'route2' ? '[X]' : '[ ]'} RCKH > RCTP`, `FPM: ${formData.route2FPM || '-'}  |  G: ${formData.route2G || '-'}  (< -270 FPM, < 1.2G)`, `${formData.selectedRoute === 'route2' ? formData.route2Score : '-'} / 40`],
          ['Part I Subtotal', '', `${part1Score} / 40`],
        ],
        headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 2: { halign: 'center' } },
        theme: 'grid',
        didParseCell: (data) => {
          // Gray out unselected routes
          const routes = ['route1', 'route2'];
          if (data.section === 'body' && data.row.index < 2) {
            const isSelected = formData.selectedRoute === routes[data.row.index];
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
          ['Circuit 1', `FPM: ${formData.circuit1FPM || '-'}  |  G: ${formData.circuit1G || '-'}  (< -350 FPM, < 1.3G)`, `${formData.circuit1Score} / 8`],
          ['Circuit 2', `FPM: ${formData.circuit2FPM || '-'}  |  G: ${formData.circuit2G || '-'}  (< -350 FPM, < 1.3G)`, `${formData.circuit2Score} / 8`],
          ['Go Around', 'Missed Approach Procedure, Altitude Management, Track Confirmation', `${formData.goAroundScore} / 8`],
          ['Holding', 'Correct Entry, Standard < 230 KIAS, Altitude +/-100 ft, Return Navigation', `${formData.holdingScore} / 8`],
          ['Circuit 3', `FPM: ${formData.circuit3FPM || '-'}  |  G: ${formData.circuit3G || '-'}  (< -350 FPM, < 1.3G)`, `${formData.circuit3Score} / 8`],
          ['Part II Subtotal', '', `${part2Score} / 40`],
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

      autoTable(doc, {
        startY: y + 10,
        head: [['EMERGENCY TYPE', 'HANDLING STANDARD', 'SCORE (MAX)']],
        body: [
          [`${formData.emergencyType === 'eng_fire' ? '[X]' : '[ ]'} ENG FIRE`, 'Memory Items > ECAM Actions > Eng Shutdown > Squawk 7700 > Diversion', `${formData.emergencyType === 'eng_fire' ? formData.emergencyScore : '-'} / 20`],
          [`${formData.emergencyType === 'bird_strike' ? '[X]' : '[ ]'} BIRD STRIKE`, 'ECAM Damage Check > Decision > Status Monitor > Diversion - Crew Coord', `${formData.emergencyType === 'bird_strike' ? formData.emergencyScore : '-'} / 20`],
          [`${formData.emergencyType === 'eng_failure' ? '[X]' : '[ ]'} ENG Failure`, 'ECAM Items > Route Adjustment', `${formData.emergencyType === 'eng_failure' ? formData.emergencyScore : '-'} / 20`],
          ['Part III Subtotal', '', `${part3Score} / 20`],
        ],
        headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'center' } },
        theme: 'grid',
        didParseCell: (data) => {
          // Gray out unselected emergency types
          const emergencyTypes = ['eng_fire', 'bird_strike', 'eng_failure'];
          if (data.section === 'body' && data.row.index < 3) {
            const isSelected = formData.emergencyType === emergencyTypes[data.row.index];
            if (!isSelected) {
              data.cell.styles.textColor = [180, 180, 180];
            }
          }
        },
      });

      // Remarks
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setTextColor(...accentColor);
      doc.setFont('helvetica', 'bold');
      doc.text('EXAMINER REMARKS', 14, y);
      doc.setDrawColor(200);
      doc.rect(14, y + 3, 182, 15);
      if (formData.examinerRemarks) {
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(formData.examinerRemarks, 16, y + 10, { maxWidth: 178 });
      }

      // Result & Score
      y = y + 22;
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, 90, 28, 'F');
      doc.setDrawColor(200);
      doc.rect(14, y, 90, 28);
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('OVERALL RESULT', 16, y + 6);
      
      // Only show selected result
      const resultConfig: Record<string, { label: string; color: [number, number, number] }> = {
        fail: { label: 'FAIL', color: [220, 38, 38] },
        partial: { label: 'PARTIAL', color: [217, 119, 6] },
        passed: { label: 'PASSED', color: [22, 163, 74] },
      };
      
      const selected = resultConfig[formData.result] || resultConfig['fail'];
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
      doc.text(formData.examinerSignature || 'Full Name', 16, y + 27);

      // Final Score Box
      doc.setFillColor(...darkColor);
      doc.rect(110, y, 86, 28, 'F');
      doc.setTextColor(...accentColor);
      doc.setFontSize(7);
      doc.text('FINAL RATING SCORE', 153, y + 5, { align: 'center' });
      doc.setTextColor(255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(totalScore.toString(), 153, y + 15, { align: 'center' });
      doc.setFontSize(6);
      doc.setTextColor(...accentColor);
      doc.text('PASSING REQ: >= 80 / 100', 153, y + 19, { align: 'center' });
      
      // Part scores (inside box)
      doc.setFontSize(5);
      doc.setTextColor(180);
      doc.text(`P1: ${part1Score}`, 120, y + 25);
      doc.text(`P2: ${part2Score}`, 145, y + 25);
      doc.text(`P3: ${part3Score}`, 170, y + 25);

      const filename = `A350-Rating-${formData.callsign || 'form'}-${Date.now()}.pdf`;
      return { doc, filename };
  };

  // Submit score to database (no PDF generation)
  const handleSubmitScore = async () => {
    // Validation
    if (!formData.callsign || !formData.pilotName) {
      setSaveMessage({ type: 'error', text: '請填寫學員姓名和呼號' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    if (!formData.result) {
      setSaveMessage({ type: 'error', text: '請選擇考核結果' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/admin-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'sjx_results',
          action: 'INSERT',
          data: {
            callsign: formData.callsign?.toUpperCase() || '',
            exam_type: 'rating_a350',
            score: totalScore,
            passed: totalScore >= 80 && formData.result === 'passed',
            detailed_answers: {
              part1Score,
              part2Score,
              part3Score,
              result: formData.result,
              examiner: formData.examinerSignature,
              pilot_name: formData.pilotName,
              date: formData.date,
              selectedRoute: formData.selectedRoute,
              ifrOperations: {
                route1: { fpm: formData.route1FPM, g: formData.route1G, score: formData.route1Score },
                route2: { fpm: formData.route2FPM, g: formData.route2G, score: formData.route2Score },
              },
              visualCircuits: {
                circuit1: { fpm: formData.circuit1FPM, g: formData.circuit1G, score: formData.circuit1Score },
                circuit2: { fpm: formData.circuit2FPM, g: formData.circuit2G, score: formData.circuit2Score },
                circuit3: { fpm: formData.circuit3FPM, g: formData.circuit3G, score: formData.circuit3Score },
                goAround: formData.goAroundScore,
                holding: formData.holdingScore,
              },
              emergency: {
                type: formData.emergencyType,
                score: formData.emergencyScore,
              },
              remarks: formData.examinerRemarks,
            },
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSaveMessage({ type: 'success', text: '成績已提交！' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        throw new Error(result.error || '提交失敗');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setSaveMessage({ type: 'error', text: '提交失敗: ' + (error instanceof Error ? error.message : '未知錯誤') });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  // PDF only download (no database submission)
  const handleDownloadPDF = async () => {
    setIsUploading(true);
    try {
      const { doc, filename } = await generateFullPDF();
      doc.save(filename);
      setSaveMessage({ type: 'success', text: 'PDF 已下載' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('PDF generation error:', error);
      setSaveMessage({ type: 'error', text: 'PDF 產生失敗' });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setConfirmDialogOpen(true);
  };

  const confirmReset = () => {
    setFormData(defaultFormData);
    setSaveMessage({ type: 'success', text: '表單已重置' });
    setTimeout(() => setSaveMessage(null), 3000);
    setConfirmDialogOpen(false);
  };

  const ScoreInput = ({ value, max, field }: { value: number; max: number; field: keyof FormData }) => {
    const [localValue, setLocalValue] = useState(value.toString());
    
    // Sync with external value changes
    React.useEffect(() => {
      setLocalValue(value.toString());
    }, [value]);

    const handleBlur = () => {
      const num = parseInt(localValue) || 0;
      const clamped = Math.min(Math.max(0, num), max);
      setLocalValue(clamped.toString());
      handleScoreChange(field, clamped, max);
    };

    return (
      <div className="flex items-center justify-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={localValue}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            setLocalValue(val);
          }}
          onBlur={handleBlur}
          className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-accent"
        />
        <span className="text-gray-500 text-xs">/ {max}</span>
      </div>
    );
  };

  const FPMInput = ({ value, field, maxVal }: { value: string; field: keyof FormData; maxVal: number }) => {
    // Remove any existing '-' from value for display
    const [localValue, setLocalValue] = useState(value.replace(/^-/, ''));
    
    React.useEffect(() => {
      setLocalValue(value.replace(/^-/, ''));
    }, [value]);

    const handleBlur = () => {
      handleInputChange(field, localValue ? `-${localValue}` : '');
    };
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-gray-200 rounded px-1 py-0.5 focus-within:border-accent bg-white">
          <span className="text-xs text-gray-600">-</span>
          <input
            type="text"
            inputMode="numeric"
            value={localValue}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setLocalValue(val);
            }}
            onBlur={handleBlur}
            className="w-10 text-center text-xs focus:outline-none bg-transparent"
            placeholder="XXX"
          />
        </div>
        <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 whitespace-nowrap">&lt; -{maxVal} FPM</span>
      </div>
    );
  };

  const GInput = ({ value, field, maxVal }: { value: string; field: keyof FormData; maxVal: string }) => {
    const [localValue, setLocalValue] = useState(value);
    
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
      handleInputChange(field, localValue);
    };

    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-accent"
          placeholder="X.XX"
        />
        <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 whitespace-nowrap">&lt; {maxVal} G</span>
      </div>
    );
  };

  const DataInput = ({ value, field, placeholder }: { value: string; field: keyof FormData; placeholder: string }) => {
    const [localValue, setLocalValue] = useState(value);
    
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
      handleInputChange(field, localValue);
    };

    return (
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className="w-16 text-center border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-accent"
        placeholder={placeholder}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] py-6 px-4">
      {/* Toolbar */}
      <div className="max-w-[210mm] mx-auto mb-4 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-lg bg-primary-light hover:bg-primary-dark transition-colors" title="返回">
              <ArrowLeft className="w-5 h-5 text-cream" />
            </button>
            {saveMessage && (
              <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {saveMessage.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {saveMessage.text}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={handleDownloadPDF} disabled={isUploading} className="btn-secondary flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4" /> 下載 PDF
            </button>
            <button onClick={handleSubmitScore} disabled={isUploading} className="btn-primary flex items-center gap-2 text-sm">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
              提交成績
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)} 
                className="btn-secondary p-2"
                title="更多選項"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-primary-light border border-cream/20 rounded-lg shadow-xl z-50 min-w-[160px]">
                  <button onClick={() => { handleSaveDraft(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-cream hover:bg-primary-dark flex items-center gap-2 rounded-t-lg">
                    <Save className="w-4 h-4" /> 儲存草稿 (本機)
                  </button>
                  <button onClick={() => { handleLoadDraft(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-cream hover:bg-primary-dark flex items-center gap-2">
                    <Download className="w-4 h-4" /> 載入草稿 (本機)
                  </button>
                  <div className="border-t border-cream/10 my-1"></div>
                  <button onClick={() => { handleSaveToCloud(); setShowMenu(false); }} disabled={isLoadingCloud} className="w-full px-4 py-2 text-left text-sm text-cream hover:bg-primary-dark flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> 儲存至雲端
                  </button>
                  <button onClick={() => { handleLoadCloudDrafts(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-cream hover:bg-primary-dark flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> 從雲端載入
                  </button>
                  <div className="border-t border-cream/10 my-1"></div>
                  <button onClick={() => { handleExport(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-cream hover:bg-primary-dark flex items-center gap-2">
                    <Upload className="w-4 h-4" /> 匯出 JSON
                  </button>
                  <button onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-cream hover:bg-primary-dark flex items-center gap-2">
                    <Download className="w-4 h-4" /> 匯入 JSON
                  </button>
                  <button onClick={() => { handleReset(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-primary-dark flex items-center gap-2 rounded-b-lg">
                    <RotateCcw className="w-4 h-4" /> 重置表單
                  </button>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" aria-label="匯入檔案" />
          </div>
        </div>
      </div>

      {/* A4 Paper */}
      <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl print:shadow-none print:w-full">
        <div className="p-[12mm] text-gray-800 text-sm">
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <Image src="/logo_dark.png" alt="vSTARLUX" width={140} height={42} className="object-contain" />
            <div className="text-right text-xs text-gray-500">
              <p>FORM: OPS-A350-TR-V2</p>
              <p>FLIGHT OPERATIONS DIVISION</p>
              <p>VIRTUAL STARLUX AIRLINES</p>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-xl font-bold tracking-wide mb-4">A350 TYPE RATING CHECK</h1>

          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-4 mb-4 pb-3 border-b border-gray-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1">PILOT NAME</label>
              <input type="text" value={formData.pilotName} onChange={(e) => handleInputChange('pilotName', e.target.value)} className="w-full px-0 py-1 border-b border-gray-300 bg-transparent focus:outline-none focus:border-accent" placeholder="Full Name" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CALLSIGN</label>
              <input type="text" value={formData.callsign} onChange={(e) => handleInputChange('callsign', e.target.value)} className="w-full px-0 py-1 border-b border-gray-300 bg-transparent focus:outline-none focus:border-accent" placeholder="STARWALKER XXX" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">DATE</label>
              <input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="w-full px-0 py-1 border-b border-gray-300 bg-transparent focus:outline-none focus:border-accent" />
            </div>
          </div>

          {/* Part I */}
          <div className="mb-3">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white px-3 py-1.5 flex justify-between items-center rounded-t text-xs">
              <span className="font-bold">PART I: IFR OPERATIONS - Select One Route - 40 pts</span>
              <span className="bg-white/20 px-2 py-0.5 rounded font-bold">40%</span>
            </div>
            {/* Route Selection - Styled like Image 2 */}
            <div className="flex gap-3 p-3 bg-gray-50 border-x border-gray-200">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer border-2 transition-all ${formData.selectedRoute === 'route1' ? 'bg-accent/10 border-accent text-accent' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                <input type="radio" name="route" value="route1" checked={formData.selectedRoute === 'route1'} onChange={() => handleInputChange('selectedRoute', 'route1')} className="sr-only" />
                <Check className={`w-4 h-4 ${formData.selectedRoute === 'route1' ? 'opacity-100' : 'opacity-0'}`} />
                <span className="font-medium">RCTP → RCKH</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer border-2 transition-all ${formData.selectedRoute === 'route2' ? 'bg-accent/10 border-accent text-accent' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                <input type="radio" name="route" value="route2" checked={formData.selectedRoute === 'route2'} onChange={() => handleInputChange('selectedRoute', 'route2')} className="sr-only" />
                <Check className={`w-4 h-4 ${formData.selectedRoute === 'route2' ? 'opacity-100' : 'opacity-0'}`} />
                <span className="font-medium">RCKH → RCTP</span>
              </label>
            </div>
            <table className="w-full text-xs border border-gray-200 border-t-0">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-3 py-1.5 font-normal border-b w-32">ROUTE</th>
                  <th className="text-left px-3 py-1.5 font-normal border-b">DATA & CRITERIA</th>
                  <th className="text-center px-3 py-1.5 font-normal border-b w-24">SCORE (MAX)</th>
                </tr>
              </thead>
              <tbody>
                <tr className={`border-b ${formData.selectedRoute !== 'route1' ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-2 font-medium">RCTP → RCKH</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">FPM:</span>
                        <FPMInput value={formData.route1FPM} field="route1FPM" maxVal={270} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">G:</span>
                        <GInput value={formData.route1G} field="route1G" maxVal="1.2" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{formData.selectedRoute === 'route1' ? <ScoreInput value={formData.route1Score} max={40} field="route1Score" /> : <span className="text-gray-300">- / 40</span>}</td>
                </tr>
                <tr className={`border-b ${formData.selectedRoute !== 'route2' ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-2 font-medium">RCKH → RCTP</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">FPM:</span>
                        <FPMInput value={formData.route2FPM} field="route2FPM" maxVal={270} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">G:</span>
                        <GInput value={formData.route2G} field="route2G" maxVal="1.2" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{formData.selectedRoute === 'route2' ? <ScoreInput value={formData.route2Score} max={40} field="route2Score" /> : <span className="text-gray-300">- / 40</span>}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-3 py-1.5 text-right font-medium text-gray-600">Part I Subtotal</td>
                  <td className="px-3 py-1.5 text-center font-bold text-accent">{part1Score} / 40</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part II */}
          <div className="mb-3">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white px-3 py-1.5 flex justify-between items-center rounded-t text-xs">
              <span className="font-bold">PART II: VISUAL CIRCUITS - Max -350 FPM / 1.3G - 40 pts</span>
              <span className="bg-white/20 px-2 py-0.5 rounded font-bold">40%</span>
            </div>
            <table className="w-full text-xs border border-gray-200 border-t-0">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-3 py-1.5 font-normal border-b w-24">TASK</th>
                  <th className="text-left px-3 py-1.5 font-normal border-b">TOUCHDOWN DATA & STANDARD</th>
                  <th className="text-center px-3 py-1.5 font-normal border-b w-24">SCORE (MAX)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">Circuit 1</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">FPM:</span>
                        <FPMInput value={formData.circuit1FPM} field="circuit1FPM" maxVal={350} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">G:</span>
                        <GInput value={formData.circuit1G} field="circuit1G" maxVal="1.3" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><ScoreInput value={formData.circuit1Score} max={8} field="circuit1Score" /></td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">Circuit 2</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">FPM:</span>
                        <FPMInput value={formData.circuit2FPM} field="circuit2FPM" maxVal={350} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">G:</span>
                        <GInput value={formData.circuit2G} field="circuit2G" maxVal="1.3" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><ScoreInput value={formData.circuit2Score} max={8} field="circuit2Score" /></td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">Go Around</td>
                  <td className="px-3 py-2 text-gray-600">Missed Approach Procedure, Altitude Management, Track Confirmation</td>
                  <td className="px-3 py-2"><ScoreInput value={formData.goAroundScore} max={8} field="goAroundScore" /></td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">Holding</td>
                  <td className="px-3 py-2 text-gray-600">Correct Entry, Standard &lt; 230 KIAS, Altitude +/-100 ft, Return Navigation</td>
                  <td className="px-3 py-2"><ScoreInput value={formData.holdingScore} max={8} field="holdingScore" /></td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">Circuit 3</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">FPM:</span>
                        <FPMInput value={formData.circuit3FPM} field="circuit3FPM" maxVal={350} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">G:</span>
                        <GInput value={formData.circuit3G} field="circuit3G" maxVal="1.3" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><ScoreInput value={formData.circuit3Score} max={8} field="circuit3Score" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-3 py-1.5 text-right font-medium text-gray-600">Part II Subtotal</td>
                  <td className="px-3 py-1.5 text-center font-bold text-accent">{part2Score} / 40</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part III */}
          <div className="mb-3">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white px-3 py-1.5 flex justify-between items-center rounded-t text-xs">
              <span className="font-bold">PART III: EMERGENCY PROCEDURES - Select One - 20 pts</span>
              <span className="bg-white/20 px-2 py-0.5 rounded font-bold">20%</span>
            </div>
            <table className="w-full text-xs border border-gray-200 border-t-0">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-3 py-1.5 font-normal border-b w-28">EMERGENCY TYPE</th>
                  <th className="text-left px-3 py-1.5 font-normal border-b">HANDLING STANDARD</th>
                  <th className="text-center px-3 py-1.5 font-normal border-b w-24">SCORE (MAX)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.emergencyType === 'eng_fire' ? 'border-accent bg-accent' : 'border-gray-300'}`}>
                        {formData.emergencyType === 'eng_fire' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      <input type="radio" name="emergency" value="eng_fire" checked={formData.emergencyType === 'eng_fire'} onChange={() => handleInputChange('emergencyType', 'eng_fire')} className="sr-only" />
                      <span className="font-medium">ENG FIRE</span>
                    </label>
                  </td>
                  <td className="px-3 py-2 text-gray-600">Memory Items &gt; ECAM Actions &gt; Eng Shutdown &gt; Squawk 7700 &gt; Diversion</td>
                  <td className="px-3 py-2">{formData.emergencyType === 'eng_fire' ? <ScoreInput value={formData.emergencyScore} max={20} field="emergencyScore" /> : <span className="text-gray-300">- / 20</span>}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.emergencyType === 'bird_strike' ? 'border-accent bg-accent' : 'border-gray-300'}`}>
                        {formData.emergencyType === 'bird_strike' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      <input type="radio" name="emergency" value="bird_strike" checked={formData.emergencyType === 'bird_strike'} onChange={() => handleInputChange('emergencyType', 'bird_strike')} className="sr-only" />
                      <span className="font-medium">BIRD STRIKE</span>
                    </label>
                  </td>
                  <td className="px-3 py-2 text-gray-600">ECAM Damage Check &gt; Decision &gt; Status Monitor &gt; Diversion - Crew Coord</td>
                  <td className="px-3 py-2">{formData.emergencyType === 'bird_strike' ? <ScoreInput value={formData.emergencyScore} max={20} field="emergencyScore" /> : <span className="text-gray-300">- / 20</span>}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.emergencyType === 'eng_failure' ? 'border-accent bg-accent' : 'border-gray-300'}`}>
                        {formData.emergencyType === 'eng_failure' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      <input type="radio" name="emergency" value="eng_failure" checked={formData.emergencyType === 'eng_failure'} onChange={() => handleInputChange('emergencyType', 'eng_failure')} className="sr-only" />
                      <span className="font-medium">ENG Failure</span>
                    </label>
                  </td>
                  <td className="px-3 py-2 text-gray-600">ECAM Items &gt; Route Adjustment</td>
                  <td className="px-3 py-2">{formData.emergencyType === 'eng_failure' ? <ScoreInput value={formData.emergencyScore} max={20} field="emergencyScore" /> : <span className="text-gray-300">- / 20</span>}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-3 py-1.5 text-right font-medium text-gray-600">Part III Subtotal</td>
                  <td className="px-3 py-1.5 text-center font-bold text-accent">{part3Score} / 20</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-accent mb-1">EXAMINER REMARKS</label>
            <textarea
              value={formData.examinerRemarks}
              onChange={(e) => handleInputChange('examinerRemarks', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-accent text-gray-800 resize-none text-xs"
              placeholder="Performance notes, commendations, areas for improvement..."
            />
          </div>

          {/* Result & Score - Matching Image Exactly */}
          <div className="flex gap-4">
            {/* Result Selection - Styled like Image 1 */}
            <div className="flex-1 border border-gray-200 rounded p-3 bg-gray-50">
              <p className="text-xs text-accent font-medium mb-2">OVERALL RESULT</p>
              <div className="flex items-stretch gap-0 mb-3">
                <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer border-2 rounded-l-md px-4 py-2 transition-all ${formData.result === 'fail' ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <input type="radio" name="result" value="fail" checked={formData.result === 'fail'} onChange={() => handleInputChange('result', 'fail')} className="sr-only" />
                  <X className="w-4 h-4" />
                  <span className="text-sm font-bold">FAIL</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer border-y-2 border-r-2 px-4 py-2 transition-all ${formData.result === 'partial' ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <input type="radio" name="result" value="partial" checked={formData.result === 'partial'} onChange={() => handleInputChange('result', 'partial')} className="sr-only" />
                  <span className="text-base">⚠</span>
                  <span className="text-sm font-bold">PARTIAL</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer border-y-2 border-r-2 rounded-r-md px-4 py-2 transition-all ${formData.result === 'passed' ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <input type="radio" name="result" value="passed" checked={formData.result === 'passed'} onChange={() => handleInputChange('result', 'passed')} className="sr-only" />
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-bold">PASSED</span>
                </label>
              </div>
              <div>
                <p className="text-xs text-accent font-medium mb-1">CHECK PILOT SIGNATURE</p>
                <input
                  type="text"
                  value={formData.examinerSignature}
                  onChange={(e) => handleInputChange('examinerSignature', e.target.value)}
                  className="w-full px-0 py-1 border-b-2 border-gray-800 bg-transparent focus:outline-none text-gray-800 italic text-base"
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Score Box - Dark theme matching Image 1 */}
            <div className="w-48 bg-[#2F3944] text-white rounded-lg p-4 text-center flex flex-col justify-between">
              <p className="text-accent text-xs font-medium tracking-wide">FINAL RATING SCORE</p>
              <p className="text-5xl font-bold text-red-500 my-2">{totalScore}</p>
              <p className="text-accent text-xs">PASSING REQ: &gt;= 80 / 100</p>
              <div className="flex justify-center gap-6 mt-3 text-xs border-t border-gray-600 pt-2">
                <div><span className="block text-lg font-medium text-gray-300">{part1Score}</span><span className="text-[10px] text-gray-500">Part I</span></div>
                <div><span className="block text-lg font-medium text-gray-300">{part2Score}</span><span className="text-[10px] text-gray-500">Part II</span></div>
                <div><span className="block text-lg font-medium text-gray-300">{part3Score}</span><span className="text-[10px] text-gray-500">Part III</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 確認重置對話框 */}
      {confirmDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
          <div className="bg-primary rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-cream/20">
            <div className="flex gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-cream mb-2">確認重置表單</h3>
                <p className="text-cream/70">確定要重置表單嗎？所有已填寫的資料將會清除。</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialogOpen(false)} className="px-6 py-2 rounded-lg font-semibold bg-cream/10 text-cream hover:bg-cream/20 transition-colors">
                取消
              </button>
              <button onClick={confirmReset} className="px-6 py-2 rounded-lg font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors">
                確定重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 雲端草稿選擇對話框 */}
      {cloudDraftsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
          <div className="bg-primary rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-cream/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-cream">從雲端載入草稿</h3>
              </div>
              <button onClick={() => setCloudDraftsOpen(false)} className="p-2 hover:bg-cream/10 rounded-lg transition-colors" title="關閉">
                <X className="w-5 h-5 text-cream/70" />
              </button>
            </div>
            
            {isLoadingCloud ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="ml-2 text-cream/70">載入中...</span>
              </div>
            ) : cloudDrafts.length === 0 ? (
              <div className="text-center py-8 text-cream/50">
                <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>沒有已儲存的雲端草稿</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {cloudDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => handleSelectCloudDraft(draft)}
                    className="flex items-center justify-between p-3 bg-cream/5 hover:bg-cream/10 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-medium truncate">
                        {draft.pilot_name || '未命名'} {draft.callsign && `(${draft.callsign})`}
                      </p>
                      <p className="text-cream/50 text-sm">
                        {new Date(draft.updated_at).toLocaleString('zh-TW')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteCloudDraft(draft.id, e)}
                      className="p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                      title="刪除草稿"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF URL Modal */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">PDF Generated</h3>
            <p className="text-sm text-gray-600 mb-3">Your rating form PDF has been uploaded. Copy the link below:</p>
            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
              <input type="text" value={pdfUrl} readOnly className="flex-1 bg-transparent text-sm text-gray-800 outline-none" />
              <button onClick={() => { navigator.clipboard.writeText(pdfUrl); setSaveMessage({ type: 'success', text: 'Link copied' }); setTimeout(() => setSaveMessage(null), 2000); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Copy link">
                <Copy className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="flex gap-2 mt-4">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 px-4 bg-accent text-white rounded-lg text-center text-sm hover:bg-accent-hover transition-colors">Open PDF</a>
              <button onClick={() => setPdfUrl(null)} className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-2xl">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span className="text-gray-800">Generating PDF...</span>
          </div>
        </div>
      )}
    </div>
  );
}
