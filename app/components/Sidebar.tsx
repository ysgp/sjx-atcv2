'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Trophy, ClipboardList, Settings } from 'lucide-react';

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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-primary-dark border-r border-cream/10 flex flex-col fixed h-full z-40">
      {/* Logo */}
      <div className="h-[72px] px-6 border-b border-cream/10 flex items-center">
        <Link href="/" className="block">
          <Image 
            src="/logo.png" 
            alt="Virtual Starlux" 
            width={180} 
            height={60}
            className="h-auto w-auto max-h-10"
            priority
          />
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-cream/10">
        <p className="text-xs text-cream/30 text-center">v2.0 © Virtual Starlux</p>
      </div>
    </aside>
  );
}
