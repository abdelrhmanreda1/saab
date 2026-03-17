'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '@/lib/firestore/internationalization';

interface LanguageSwitcherProps {
  variant?: 'default' | 'minimal';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'default' }) => {
  const { currentLanguage, languages, setLanguage, isLoading } = useLanguage();
  const isRTL = currentLanguage?.isRTL || false;
  const [isOpen, setIsOpen] = useState(false);
  const isMinimal = variant === 'minimal';

  const getFallbackCode = () => {
    if (typeof document !== 'undefined') {
      const fromHtml = (document.documentElement.lang || '').trim().toLowerCase();
      if (fromHtml) return fromHtml;
    }
    if (typeof window !== 'undefined') {
      const fromStorage = (localStorage.getItem('preferredLanguage') || '').trim().toLowerCase();
      if (fromStorage) return fromStorage;
    }
    return 'ar';
  };

  const handleLanguageChange = async (language: Language) => {
    await setLanguage(language);
    setIsOpen(false);
  };

  const effectiveCode = (currentLanguage?.code || getFallbackCode()).toUpperCase();
  const canOpen = !isLoading && languages.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!canOpen) return;
          setIsOpen((prev) => !prev);
        }}
        className={`flex items-center gap-2 transition-colors ${
          isMinimal
            ? 'min-w-[56px] justify-center rounded-full bg-transparent px-2 py-1.5 text-[#6f6148] hover:bg-[#fff7e8]'
            : 'rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50'
        } ${canOpen ? '' : 'cursor-default opacity-80'}`}
        aria-label="Change language"
        aria-disabled={!canOpen}
        disabled={!canOpen}
      >
        {currentLanguage?.flag && (
          currentLanguage.flag.startsWith('http') ? (
            <Image
              src={currentLanguage.flag}
              alt={`${currentLanguage.name} flag`}
              width={20}
              height={20}
              className={`${isMinimal ? 'h-4 w-4' : 'h-5 w-5'} rounded object-cover`}
              unoptimized
            />
          ) : (
            <span className={isMinimal ? 'text-sm leading-none' : 'text-lg'}>{currentLanguage.flag}</span>
          )
        )}

        <span className={`${isMinimal ? 'text-[11px] font-semibold uppercase tracking-[0.08em]' : 'text-sm font-medium'}`}>
          {isMinimal
            ? effectiveCode
            : currentLanguage?.nativeName || currentLanguage?.name || 'Language'}
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className={`${isMinimal ? 'h-3.5 w-3.5' : 'h-4 w-4'} transition-transform ${isOpen ? 'rotate-180' : ''} ${
            canOpen ? '' : 'opacity-60'
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && canOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute end-0 top-full z-20 mt-2 max-h-64 min-w-[180px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {languages.map((language) => (
              <button
                key={language.id || language.code}
                onClick={() => handleLanguageChange(language)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50 ${
                  currentLanguage?.code === language.code ? 'bg-[#fff7e8] text-[#a87923]' : ''
                } ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {language.flag && (
                  language.flag.startsWith('http') ? (
                    <Image
                      src={language.flag}
                      alt={`${language.name} flag`}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-lg">{language.flag}</span>
                  )
                )}

                <div className="flex flex-col">
                  <span className="text-sm font-medium">{language.nativeName}</span>
                  <span className="text-xs text-gray-500">{language.name}</span>
                </div>

                {currentLanguage?.code === language.code && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="ms-auto h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;
