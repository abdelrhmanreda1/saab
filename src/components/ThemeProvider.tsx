'use client';

import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const theme = settings?.theme;

    // Font map for all available fonts
    const fontMap: { [key: string]: string } = {
      'Inter': 'var(--font-inter), Inter, sans-serif',
      'Poppins': 'var(--font-poppins), Poppins, sans-serif',
      'Roboto': 'var(--font-roboto), Roboto, sans-serif',
      'Open Sans': 'var(--font-open-sans), "Open Sans", sans-serif',
      'Montserrat': 'var(--font-montserrat), Montserrat, sans-serif',
    };

    // Always set fonts (defaults or from settings)
    if (theme?.fonts) {
      root.style.setProperty('--theme-heading-font', fontMap[theme.fonts.heading || 'Poppins'] || fontMap['Poppins']);
      root.style.setProperty('--theme-body-font', fontMap[theme.fonts.body || 'Inter'] || fontMap['Inter']);
    } else {
      // Set defaults immediately if settings not loaded yet
      root.style.setProperty('--theme-heading-font', fontMap['Poppins']);
      root.style.setProperty('--theme-body-font', fontMap['Inter']);
    }

    // Set colors if available
    if (theme?.colors) {
      root.style.setProperty('--theme-header-bg', theme.colors.headerBackground || '#ffffff');
      root.style.setProperty('--theme-header-text', theme.colors.headerText || '#000000');
      root.style.setProperty('--theme-footer-bg', theme.colors.footerBackground || '#1f2937');
      root.style.setProperty('--theme-footer-text', theme.colors.footerText || '#ffffff');
      root.style.setProperty('--theme-primary-button', theme.colors.primaryButton || '#000000');
      root.style.setProperty('--theme-primary-button-text', theme.colors.primaryButtonText || '#ffffff');
      root.style.setProperty('--theme-secondary-button', theme.colors.secondaryButton || '#f3f4f6');
      root.style.setProperty('--theme-secondary-button-text', theme.colors.secondaryButtonText || '#000000');
    }
  }, [settings]);

  return <>{children}</>;
}
