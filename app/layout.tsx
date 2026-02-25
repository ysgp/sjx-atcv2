import './globals.css';
import type { Metadata } from 'next';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

export const metadata: Metadata = {
  title: 'Virtual Starlux ATC Training',
  description: 'Virtual Starlux ATC Training System',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="flex min-h-screen">
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 ml-64 flex flex-col">
          <Navbar />

          {/* Page Content */}
          <main className="flex-1 p-8 bg-primary">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
