'use client';

import React from 'react';
import { useHomeLanguage } from '@/app/(home)/home-context';

interface HomeLanguageSwitcherProps {
  variant?: 'default' | 'minimal';
}

const HomeLanguageSwitcher: React.FC<HomeLanguageSwitcherProps> = ({ variant = 'default' }) => {
  const { currentLanguage, languages, setLanguage } = useHomeLanguage();
  const isMinimal = variant === 'minimal';
  const currentCode = (currentLanguage?.code || 'ar').toLowerCase();
  const isArabic = currentCode === 'ar';

  const handleToggle = async () => {
    const targetCode = isArabic ? 'en' : 'ar';
    const targetLang = languages.find((language) => language.code.toLowerCase() === targetCode);
    if (!targetLang) return;
    await setLanguage(targetLang);
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative flex items-center gap-1.5 transition-all duration-200 ${
        isMinimal
          ? 'min-w-[48px] justify-center rounded-full px-2.5 py-1.5 text-[#6f6148] hover:bg-[#fff7e8] active:scale-95'
          : 'rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 active:scale-95'
      }`}
      aria-label={`Switch to ${isArabic ? 'English' : 'Arabic'}`}
      title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={isMinimal ? 'h-3.5 w-3.5' : 'h-4 w-4'}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>
      <span
        className={`font-bold tracking-wide ${isMinimal ? 'text-[11px] uppercase tracking-[0.08em]' : 'text-xs'}`}
      >
        {isArabic ? 'EN' : 'AR'}
      </span>
    </button>
  );
};

export default HomeLanguageSwitcher;
