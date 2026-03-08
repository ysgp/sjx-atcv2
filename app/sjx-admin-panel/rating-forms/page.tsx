'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Plane, Radio, Save, Upload, Download, Printer, RotateCcw, Check, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import ATCRatingForm from './ATCRatingForm';
import A321A339RatingForm from './A321A339RatingForm';
import A350RatingForm from './A350RatingForm';

type RatingType = 'atc' | 'a321a339' | 'a350';

export default function RatingFormsPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedRating, setSelectedRating] = useState<RatingType | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          setIsAuth(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <div className="bg-primary-light border border-cream/10 rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-cream mb-2">未授權訪問</h2>
          <p className="text-cream/60 mb-6">請先登入教官後臺</p>
          <Link href="/sjx-admin-panel" className="btn-primary">
            返回登入
          </Link>
        </div>
      </div>
    );
  }

  const ratingOptions = [
    {
      id: 'atc' as RatingType,
      icon: Radio,
      title: 'ATC RATING',
      subtitle: '飛航管制員訓練考核系統',
      formCode: 'TRA-ATC-01',
      color: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      id: 'a321a339' as RatingType,
      icon: Plane,
      title: 'A321/A339 RATING',
      subtitle: '跨境航線挑戰與本場起落技術考核',
      formCode: 'OPS-A32X33X-TR',
      color: 'from-green-500/20 to-green-600/10',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400',
    },
    {
      id: 'a350' as RatingType,
      icon: Plane,
      title: 'A350 TYPE RATING',
      subtitle: 'A350 機型轉換與技術考核',
      formCode: 'OPS-A350-TR-V2',
      color: 'from-purple-500/20 to-purple-600/10',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
  ];

  const renderForm = () => {
    switch (selectedRating) {
      case 'atc':
        return <ATCRatingForm onBack={() => setSelectedRating(null)} />;
      case 'a321a339':
        return <A321A339RatingForm onBack={() => setSelectedRating(null)} />;
      case 'a350':
        return <A350RatingForm onBack={() => setSelectedRating(null)} />;
      default:
        return null;
    }
  };

  if (selectedRating) {
    return renderForm();
  }

  return (
    <div className="min-h-screen bg-primary p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/sjx-admin-panel"
            className="p-2 rounded-lg bg-primary-light hover:bg-primary-dark transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-cream" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-cream">訓練考核表單</h1>
            <p className="text-cream/60 text-sm">TRAINING RATING FORMS</p>
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-12">
          <div className="text-center">
            <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-12 h-12 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-cream mb-2">TRAINING MANAGEMENT SYSTEM</h2>
            <p className="text-cream/50 text-sm">選擇要使用的考核表單類型</p>
          </div>
        </div>

        {/* Rating Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {ratingOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedRating(option.id)}
              className={`group relative p-6 rounded-2xl border ${option.borderColor} bg-gradient-to-br ${option.color} hover:scale-[1.02] transition-all duration-300 text-left`}
            >
              <div className={`w-14 h-14 rounded-xl bg-primary-dark flex items-center justify-center mb-4 ${option.iconColor}`}>
                <option.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-cream mb-1">{option.title}</h3>
              <p className="text-cream/60 text-sm mb-4">{option.subtitle}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cream/40 bg-primary-dark px-2 py-1 rounded">
                  {option.formCode}
                </span>
                <span className="text-accent text-sm font-semibold group-hover:translate-x-1 transition-transform">
                  開啟表單 →
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-cream/40 text-sm">
          <p>VIRTUAL STARLUX AIRLINES © 2025-2026</p>
          <p>FLIGHT OPERATIONS & TRAINING DIVISION</p>
        </div>
      </div>
    </div>
  );
}
