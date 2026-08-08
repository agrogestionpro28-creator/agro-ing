import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agro Ing',
  description: 'Panel del ingeniero agrónomo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
