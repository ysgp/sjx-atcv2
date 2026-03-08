'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import OnboardingModal from './OnboardingModal';

// 不需要顯示 Sidebar/Navbar 的頁面
const FULL_PAGE_ROUTES = ['/login'];

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  
  // 登入頁面等全螢幕頁面不顯示 Sidebar 和 Navbar
  const isFullPage = FULL_PAGE_ROUTES.includes(pathname);

  if (isFullPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Onboarding Modal for unlinked users */}
      <OnboardingModal />
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 ml-0 lg:ml-64 flex flex-col transition-all duration-300">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 bg-primary">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
