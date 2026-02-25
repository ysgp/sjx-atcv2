'use client';

export default function Navbar() {
  return (
    <header className="h-[72px] bg-primary-light/50 backdrop-blur-sm border-b border-cream/10 flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <span className="text-cream/60 text-sm">Virtual Training Platform</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-cream text-sm font-bold">
          VS
        </div>
      </div>
    </header>
  );
}
