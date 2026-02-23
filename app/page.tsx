// app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  const menus = [
    { name: '小考系統 Quiz', href: '/quiz', desc: '章節制測驗，提升技能' },
    { name: '結訓考試 Final', href: '/final', desc: '綜合評估，獲取認證' },
    { name: '成績查詢 Results', href: '/results', desc: '查看個人學習進度' },
    { name: '教官後台 Admin', href: '/sjx-admin-panel', desc: '管理與系統配置' },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#1a1a1a]">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold tracking-widest text-[#c5a059] mb-2">STARLUX</h1>
        <p className="text-xl tracking-widest opacity-80 uppercase text-white">ATC Training System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {menus.map((m) => (
          <Link key={m.href} href={m.href} className="bg-[#2d2d2d] p-6 rounded-lg border border-gray-700 shadow-xl hover:border-[#c5a059] transition-colors group">
            <h2 className="text-2xl font-bold text-[#c5a059] mb-2">{m.name}</h2>
            <p className="text-gray-400 group-hover:text-white transition-colors">{m.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}