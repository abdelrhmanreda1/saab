'use client';

import dynamic from 'next/dynamic';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { SettingsProvider } from '../context/SettingsContext';
import { LanguageProvider } from '../context/LanguageContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/Toast';
import LayoutWrapper from '../components/LayoutWrapper';
import type { Settings } from '@/lib/firestore/settings';

const PWARegistration = dynamic(() => import('../components/PWARegistration'), { ssr: false });

export default function Providers({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettings: Settings | null;
}) {
  return (
    <SettingsProvider initialSettings={initialSettings}>
      <AuthProvider>
        <LanguageProvider defaultLanguageCode="ar">
          <CurrencyProvider>
            <CartProvider>
              <ThemeProvider>
                <ToastProvider>
                  <PWARegistration />
                  <LayoutWrapper>{children}</LayoutWrapper>
                </ToastProvider>
              </ThemeProvider>
            </CartProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
