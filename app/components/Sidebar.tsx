'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Trophy, ClipboardList, Settings, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const INSTRUCTOR_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];

const baseNavItems = [
  { href: '/', label: '首頁', icon: 'home' },
  { href: '/quiz', label: '小考系統', icon: 'book' },
  { href: '/final', label: '結訓考試', icon: 'trophy' },
  { href: '/results', label: '成績查詢', icon: 'clipboard' },
];

const adminNavItem = { href: '/sjx-admin-panel', label: '教官後台', icon: 'settings' };

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

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isInstructor, setIsInstructor] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          const hasRole = data.user?.roles?.some((roleId: string) =>
            INSTRUCTOR_ROLE_IDS.includes(roleId)
          ) || data.user?.isInstructor;
          setIsInstructor(hasRole);
        }
      } catch (error) {
        // Not logged in or error
      }
    };
    checkRole();
  }, []);

  const navItems = isInstructor ? [...baseNavItems, adminNavItem] : baseNavItems;

  return (
    <aside className={`w-64 bg-primary-dark border-r border-cream/10 flex flex-col fixed h-full z-40 transition-transform duration-300 lg:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Logo */}
      <div className="h-[72px] px-6 border-b border-cream/10 flex items-center justify-between">
        <Link href="/" className="block" onClick={onClose}>
          <Image 
            src="/logo.png" 
            alt="Virtual Starlux" 
            width={180} 
            height={60}
            className="h-auto w-auto max-h-10"
            priority
          />
        </Link>
        
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden text-cream/60 hover:text-cream transition-colors"
          aria-label="關閉選單"
        >
          <X className="w-6 h-6" />
        </button>
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
              onClick={onClose}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-cream/10">
        <p className="text-xs text-cream/30 text-center">v2.3.0 © 2025-2026 Virtual Starlux</p>
      </div>
    </aside>
  );
}
