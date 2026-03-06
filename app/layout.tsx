import './globals.css';
import type { Metadata } from 'next';
import LayoutWrapper from './components/LayoutWrapper';

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
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
