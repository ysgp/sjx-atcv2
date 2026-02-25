// app/page.tsx
import Link from 'next/link';
import { BookOpen, Trophy, ClipboardList, Settings } from 'lucide-react';

export default function HomePage() {
  const menus = [
    { name: '小考系統', subtitle: 'Quiz System', href: '/quiz', desc: '章節制測驗，提升專業技能', icon: BookOpen, color: 'bg-blue-500/10 border-blue-500/30' },
    { name: '結訓考試', subtitle: 'Final Exam', href: '/final', desc: '綜合評估，獲取認證資格', icon: Trophy, color: 'bg-amber-500/10 border-amber-500/30' },
    { name: '成績查詢', subtitle: 'Results', href: '/results', desc: '查看個人學習進度與歷史', icon: ClipboardList, color: 'bg-green-500/10 border-green-500/30' },
    { name: '教官後台', subtitle: 'Admin Panel', href: '/sjx-admin-panel', desc: '系統管理與配置', icon: Settings, color: 'bg-purple-500/10 border-purple-500/30' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-cream mb-3">歡迎回來</h1>
        <p className="text-cream/60 text-lg">選擇您要進行的培訓項目</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-cream/50 text-sm">培訓模組</p>
            <p className="text-2xl font-bold text-cream">4</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-cream/50 text-sm">系統狀態</p>
            <p className="text-2xl font-bold text-green-400">Online</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-cream/50 text-sm">版本</p>
            <p className="text-2xl font-bold text-cream">v2.0</p>
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {menus.map((m) => (
          <Link 
            key={m.href} 
            href={m.href} 
            className={`card ${m.color} border hover:scale-[1.02] transition-all duration-300 group`}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                <m.icon className="w-7 h-7 text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <h2 className="text-xl font-bold text-cream">{m.name}</h2>
                  <span className="text-sm text-cream/40">{m.subtitle}</span>
                </div>
                <p className="text-cream/60">{m.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}