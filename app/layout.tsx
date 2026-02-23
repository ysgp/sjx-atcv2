import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'STARLUX ATC Training',
  description: 'Virtual STARLUX ATC Training System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
