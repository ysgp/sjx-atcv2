'use client';
import { Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <header className="h-[72px] bg-primary-light/50 backdrop-blur-sm border-b border-cream/10 flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-cream/60 hover:text-cream transition-colors"
          aria-label="開啟選單"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <span className="text-cream/60 text-xs sm:text-sm">Virtual Training Platform</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-cream text-sm font-bold">
          VS
        </div>
      </div>
    </header>
  );
}
