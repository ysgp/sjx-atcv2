import './globals.css';
import type { Metadata } from 'next';
import { Home, BookOpen, Trophy, ClipboardList, Settings } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'STARLUX ATC Training',
  description: 'Virtual STARLUX ATC Training System',
};

const navItems = [
  { href: '/', label: '首頁', icon: 'home' },
  { href: '/quiz', label: '小考系統', icon: 'book' },
  { href: '/final', label: '結訓考試', icon: 'trophy' },
  { href: '/results', label: '成績查詢', icon: 'clipboard' },
  { href: '/sjx-admin-panel', label: '教官後台', icon: 'settings' },
];

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const iconClass = className || 'w-5 h-5';
  switch (icon) {
    case 'home': return <Home className={iconClass} />;
    case 'book': return <BookOpen className={iconClass} />;
    case 'trophy': return <Trophy className={iconClass} />;
    case 'clipboard': return <ClipboardList className={iconClass} />;
    case 'settings': return <Settings className={iconClass} />;
    default: return null;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-primary-dark border-r border-cream/10 flex flex-col fixed h-full z-40">
          {/* Logo */}
          <div className="p-6 border-b border-cream/10">
            <h1 className="text-2xl font-bold text-accent tracking-wide">STARLUX</h1>
            <p className="text-xs text-cream/50 mt-1 uppercase tracking-widest">ATC Training System</p>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-link"
              >
                <NavIcon icon={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-cream/10">
            <p className="text-xs text-cream/30 text-center">v2.0 © STARLUX Airlines</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 ml-64 flex flex-col">
          {/* Top Navbar */}
          <header className="h-16 bg-primary-light/50 backdrop-blur-sm border-b border-cream/10 flex items-center justify-between px-8 sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <span className="text-cream/60 text-sm">Virtual Training Platform</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-cream text-sm font-bold">
                SJX
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-8 bg-primary">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
