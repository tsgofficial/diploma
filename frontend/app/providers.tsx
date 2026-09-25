'use client';

import { ThemeProvider } from 'next-themes';
import { Toast } from '@heroui/react';
import type { ReactNode } from 'react';

/** Client-only providers: theme (class strategy → HeroUI's `.dark`) and toasts. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toast.Provider placement="bottom end" />
    </ThemeProvider>
  );
}
