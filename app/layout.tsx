import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Report Assistant',
  description: 'Deterministic Word + Excel ingestion with fail-closed validation.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-paper">
          <div className="glow">
            <div className="mx-auto max-w-6xl px-6 py-10">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

