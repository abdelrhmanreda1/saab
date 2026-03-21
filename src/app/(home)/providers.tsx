'use client';

import { SettingsProvider } from '@/context/SettingsContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Settings } from '@/lib/firestore/settings';

export default function HomeProviders({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettings: Settings | null;
}) {
  return (
    <SettingsProvider initialSettings={initialSettings}>
      <LanguageProvider defaultLanguageCode="ar">
        <CurrencyProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </SettingsProvider>
  );
}
