'use client';
import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { ArrowLeft, Save, Upload, Download, Printer, RotateCcw, Check, X, Copy, Loader2, MoreVertical, SendHorizonal, Cloud, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ATCRatingFormProps {
  onBack: () => void;
}

interface FormData {
  pilotName: string;
  callsign: string;
  date: string;
  phonetics: number;
  readback: number;
  radioDiscipline: number;
  sectorHandover: number;
  navigation: number;
  emergencyResponse: number;
  instructorRemarks: string;
  instructorSignature: string;
  result: 'fail' | 'partial' | 'passed' | '';
}

const defaultFormData: FormData = {
  pilotName: '',
  callsign: '',
  date: '',
  phonetics: 0,
  readback: 0,
  radioDiscipline: 0,
  sectorHandover: 0,
  navigation: 0,
  emergencyResponse: 0,
  instructorRemarks: '',
  instructorSignature: '',
  result: '',
};

export default function ATCRatingForm({ onBack }: ATCRatingFormProps) {
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

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleScoreChange = (field: keyof FormData, value: number, max: number) => {
    const clampedValue = Math.min(Math.max(0, value), max);
    setFormData(prev => ({ ...prev, [field]: clampedValue }));
  };

  const part1Score = formData.phonetics + formData.readback + formData.radioDiscipline;
  const part2Score = formData.sectorHandover + formData.navigation;
  const part3Score = formData.emergencyResponse;
  const totalScore = part1Score + part2Score + part3Score;

  const handleSaveDraft = () => {
    localStorage.setItem('atc-rating-draft', JSON.stringify(formData));
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
          formType: 'atc',
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
      const res = await fetch('/api/rating-drafts?formType=atc');
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
    const draft = localStorage.getItem('atc-rating-draft');
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
    a.download = `ATC-Rating-${formData.callsign || 'form'}-${new Date().toISOString().split('T')[0]}.json`;
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
        setSaveMessage({ type: 'success', text: 'Data imported' });
        setTimeout(() => setSaveMessage(null), 3000);
      } catch {
        setSaveMessage({ type: 'error', text: 'Import failed: Invalid file format' });
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

    // Header right side
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('E-DOCUMENT: TRA-ATC-01', 196, 12, { align: 'right' });
    doc.text('TRAINING DIVISION', 196, 17, { align: 'right' });
    doc.text('VIRTUAL STARLUX AIRLINES', 196, 22, { align: 'right' });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text('ATC TRAINING FINAL RATING', 14, 38);

    // Basic Info
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('STUDENT NAME', 14, 48);
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

      // Part I Header
      let y = 65;
      doc.setFillColor(...accentColor);
      doc.rect(14, y, 182, 8, 'F');
      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PART I: COMMUNICATIONS & PHONETICS', 16, y + 5.5);
      doc.text('50%', 190, y + 5.5, { align: 'right' });

      // Part I Table
      autoTable(doc, {
        startY: y + 10,
        head: [['TASK', 'DESCRIPTION', 'SCORE (Max)']],
        body: [
          ['Phonetics & Numbers', 'Standard alphabet and number accuracy (Ch.3)', `${formData.phonetics} / 20`],
          ['Readback Accuracy', 'Clearance readback precision (Ch.11)', `${formData.readback} / 20`],
          ['Radio Discipline', 'Concise communications (Ch.4) - No filler words', `${formData.radioDiscipline} / 10`],
        ],
        headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'normal', fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
        theme: 'grid',
      });

      // Part II Header
      y = (doc as any).lastAutoTable.finalY + 6;
      doc.setFillColor(...accentColor);
      doc.rect(14, y, 182, 8, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.text('PART II: PROCEDURES & SECTORS', 16, y + 5.5);
      doc.text('30%', 190, y + 5.5, { align: 'right' });

      // Part II Table
      autoTable(doc, {
        startY: y + 10,
        head: [['TASK', 'DESCRIPTION', 'SCORE (Max)']],
        body: [
          ['Sector Handover', 'Position transfer logic (Ch.13) - Correct sequence', `${formData.sectorHandover} / 15`],
          ['Navigation / Charting', 'Route understanding (Ch.12) - SID/STAR knowledge', `${formData.navigation} / 15`],
        ],
        headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'normal', fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
        theme: 'grid',
      });

      // Part III Header
      y = (doc as any).lastAutoTable.finalY + 6;
      doc.setFillColor(...accentColor);
      doc.rect(14, y, 182, 8, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.text('PART III: MISSIONS & EMERGENCY', 16, y + 5.5);
      doc.text('20%', 190, y + 5.5, { align: 'right' });

      // Part III Table
      autoTable(doc, {
        startY: y + 10,
        head: [['TASK', 'DESCRIPTION', 'SCORE (Max)']],
        body: [
          ['Emergency Response', 'Emergency handling (Ch.15) - Mayday/NITS format', `${formData.emergencyResponse} / 20`],
        ],
        headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'normal', fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
        theme: 'grid',
      });

      // Remarks
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setTextColor(...accentColor);
      doc.setFont('helvetica', 'bold');
      doc.text('INSTRUCTOR REMARKS', 14, y);
      doc.setDrawColor(200);
      doc.rect(14, y + 3, 182, 20);
      if (formData.instructorRemarks) {
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(formData.instructorRemarks, 16, y + 10, { maxWidth: 178 });
      }

      // Result & Score Section
      y = y + 28;
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, 110, 22, 'F');
      doc.setDrawColor(200);
      doc.rect(14, y, 110, 22);
      
      // Only show selected result
      const resultConfig: Record<string, { label: string; color: [number, number, number] }> = {
        fail: { label: 'FAIL', color: [220, 38, 38] },
        partial: { label: 'PARTIAL', color: [217, 119, 6] },
        passed: { label: 'PASSED', color: [22, 163, 74] },
      };
      
      const selected = resultConfig[formData.result] || resultConfig['fail'];
      doc.setFillColor(...selected.color);
      doc.rect(20, y + 6, 60, 10, 'F');
      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(selected.label, 50, y + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      // Overall Score Box
      doc.setFillColor(...darkColor);
      doc.rect(130, y, 66, 22, 'F');
      doc.setTextColor(...accentColor);
      doc.setFontSize(8);
      doc.text('OVERALL SCORE', 163, y + 5, { align: 'center' });
      doc.setTextColor(255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(totalScore.toString(), 163, y + 16, { align: 'center' });
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
      doc.text(formData.instructorSignature || 'Sign here...', 14, y + 8);
      doc.setDrawColor(0);
      doc.line(14, y + 10, 100, y + 10);

      const filename = `ATC-Rating-${formData.callsign || 'form'}-${Date.now()}.pdf`;
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
            exam_type: 'rating_atc',
            score: totalScore,
            passed: totalScore >= 80 && formData.result === 'passed',
            detailed_answers: {
              part1Score,
              part2Score,
              part3Score,
              result: formData.result,
              examiner: formData.instructorSignature,
              pilot_name: formData.pilotName,
              date: formData.date,
              communications: {
                phonetics: formData.phonetics,
                readback: formData.readback,
                radioDiscipline: formData.radioDiscipline,
              },
              procedural: {
                sectorHandover: formData.sectorHandover,
                navigation: formData.navigation,
              },
              situational: {
                emergencyResponse: formData.emergencyResponse,
              },
              remarks: formData.instructorRemarks,
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
          className="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
        />
        <span className="text-gray-500 text-sm">/ {max}</span>
      </div>
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
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" aria-label="Import file" />
          </div>
        </div>
      </div>

      {/* A4 Paper */}
      <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl print:shadow-none print:w-full">
        <div className="p-[15mm] text-gray-800">
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <Image src="/logo_dark.png" alt="vSTARLUX" width={160} height={48} className="object-contain" />
            <div className="text-right text-xs text-gray-500">
              <p>E-DOCUMENT: TRA-ATC-01</p>
              <p>TRAINING DIVISION</p>
              <p>VIRTUAL STARLUX AIRLINES</p>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-bold tracking-wide mb-6">ATC TRAINING FINAL RATING</h1>

          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-6 mb-6 pb-4 border-b border-gray-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1">STUDENT NAME</label>
              <input
                type="text"
                value={formData.pilotName}
                onChange={(e) => handleInputChange('pilotName', e.target.value)}
                className="w-full px-0 py-1 border-b border-gray-300 bg-transparent focus:outline-none focus:border-accent text-gray-800"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CALLSIGN</label>
              <input
                type="text"
                value={formData.callsign}
                onChange={(e) => handleInputChange('callsign', e.target.value)}
                className="w-full px-0 py-1 border-b border-gray-300 bg-transparent focus:outline-none focus:border-accent text-gray-800"
                placeholder="STARWALKER XXX"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">DATE</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-0 py-1 border-b border-gray-300 bg-transparent focus:outline-none focus:border-accent text-gray-800"
              />
            </div>
          </div>

          {/* Part I */}
          <div className="mb-4">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white px-4 py-2 flex justify-between items-center rounded-t">
              <span className="font-bold text-sm">PART I: COMMUNICATIONS & PHONETICS</span>
              <span className="bg-white/20 px-3 py-0.5 rounded text-sm font-bold">50%</span>
            </div>
            <table className="w-full text-sm border border-gray-200 border-t-0">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2 font-normal border-b">TASK</th>
                  <th className="text-left px-4 py-2 font-normal border-b">DESCRIPTION</th>
                  <th className="text-center px-4 py-2 font-normal border-b w-28">SCORE (Max)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">Phonetics & Numbers</td>
                  <td className="px-4 py-3 text-gray-600">Standard alphabet and number accuracy (Ch.3)</td>
                  <td className="px-4 py-3"><ScoreInput value={formData.phonetics} max={20} field="phonetics" /></td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">Readback Accuracy</td>
                  <td className="px-4 py-3 text-gray-600">Clearance readback precision (Ch.11)</td>
                  <td className="px-4 py-3"><ScoreInput value={formData.readback} max={20} field="readback" /></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Radio Discipline</td>
                  <td className="px-4 py-3 text-gray-600">Concise communications (Ch.4) - No filler words</td>
                  <td className="px-4 py-3"><ScoreInput value={formData.radioDiscipline} max={10} field="radioDiscipline" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part II */}
          <div className="mb-4">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white px-4 py-2 flex justify-between items-center rounded-t">
              <span className="font-bold text-sm">PART II: PROCEDURES & SECTORS</span>
              <span className="bg-white/20 px-3 py-0.5 rounded text-sm font-bold">30%</span>
            </div>
            <table className="w-full text-sm border border-gray-200 border-t-0">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2 font-normal border-b">TASK</th>
                  <th className="text-left px-4 py-2 font-normal border-b">DESCRIPTION</th>
                  <th className="text-center px-4 py-2 font-normal border-b w-28">SCORE (Max)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">Sector Handover</td>
                  <td className="px-4 py-3 text-gray-600">Position transfer logic (Ch.13) - Correct sequence</td>
                  <td className="px-4 py-3"><ScoreInput value={formData.sectorHandover} max={15} field="sectorHandover" /></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Navigation / Charting</td>
                  <td className="px-4 py-3 text-gray-600">Route understanding (Ch.12) - SID/STAR knowledge</td>
                  <td className="px-4 py-3"><ScoreInput value={formData.navigation} max={15} field="navigation" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part III */}
          <div className="mb-5">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white px-4 py-2 flex justify-between items-center rounded-t">
              <span className="font-bold text-sm">PART III: MISSIONS & EMERGENCY</span>
              <span className="bg-white/20 px-3 py-0.5 rounded text-sm font-bold">20%</span>
            </div>
            <table className="w-full text-sm border border-gray-200 border-t-0">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2 font-normal border-b">TASK</th>
                  <th className="text-left px-4 py-2 font-normal border-b">DESCRIPTION</th>
                  <th className="text-center px-4 py-2 font-normal border-b w-28">SCORE (Max)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 font-medium">Emergency Response</td>
                  <td className="px-4 py-3 text-gray-600">Emergency handling (Ch.15) - Mayday/NITS format</td>
                  <td className="px-4 py-3"><ScoreInput value={formData.emergencyResponse} max={20} field="emergencyResponse" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-accent mb-2">INSTRUCTOR REMARKS</label>
            <textarea
              value={formData.instructorRemarks}
              onChange={(e) => handleInputChange('instructorRemarks', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-accent text-gray-800 resize-none text-sm"
              placeholder=""
            />
          </div>

          {/* Result & Score Section - Matching Image */}
          <div className="flex gap-4 mb-5">
            {/* Result Selection */}
            <div className="flex-1 border border-gray-200 rounded p-4 bg-gray-50">
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
                <p className="text-xs text-accent font-medium mb-1">INSTRUCTOR SIGNATURE</p>
                <input
                  type="text"
                  value={formData.instructorSignature}
                  onChange={(e) => handleInputChange('instructorSignature', e.target.value)}
                  className="w-full px-0 py-1 border-b-2 border-gray-800 bg-transparent focus:outline-none text-gray-800 italic text-base"
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Score Box - Dark theme */}
            <div className="w-48 bg-[#2F3944] text-white rounded-lg p-4 text-center flex flex-col justify-between">
              <p className="text-accent text-xs font-medium tracking-wide">OVERALL SCORE</p>
              <p className="text-5xl font-bold text-red-500 my-2">{totalScore}</p>
              <p className="text-accent text-xs">MINIMUM REQ: 80</p>
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
            <h3 className="text-lg font-bold text-gray-800 mb-4">PDF 已產生</h3>
            <p className="text-sm text-gray-600 mb-3">您的評核表單 PDF 已上傳，請複製以下連結：</p>
            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
              <input type="text" value={pdfUrl} readOnly className="flex-1 bg-transparent text-sm text-gray-800 outline-none" />
              <button
                onClick={() => { navigator.clipboard.writeText(pdfUrl); setSaveMessage({ type: 'success', text: 'Link copied' }); setTimeout(() => setSaveMessage(null), 2000); }}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Copy link"
              >
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
