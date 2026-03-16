'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '@/lib/firestore/internationalization';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import { getTranslationsByLanguage } from '@/lib/firestore/translations_db';
import { DEFAULT_TRANSLATION_KEYS } from '@/lib/firestore/translations';

interface LanguageContextType {
  currentLanguage: Language | null;
  languages: Language[];
  translations: Record<string, string>;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
  defaultLanguageCode?: string;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ 
  children, 
  defaultLanguageCode = 'en' 
}) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>(DEFAULT_TRANSLATION_KEYS);
  const [isLoading, setIsLoading] = useState(true);

  // Load translations when language changes
  const normalizeCode = (code?: string | null) => String(code || '').trim().toLowerCase();

  const setLanguage = async (language: Language) => {
    try {
      setIsLoading(true);
      const languageCode = normalizeCode(language.code) || language.code;
      const translationsData = await getTranslationsByLanguage(languageCode);
      
      // Merge with default translations (fallback)
      setTranslations({
        ...DEFAULT_TRANSLATION_KEYS,
        ...translationsData,
      });
      
      setCurrentLanguage(language);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferredLanguage', languageCode);
      }
      
      // Update document direction for RTL
      if (typeof document !== 'undefined') {
        document.documentElement.dir = language.isRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = languageCode;
      }
    } catch {
      // Failed to load translations
    } finally {
      setIsLoading(false);
    }
  };

  // Translation function
  const t = (key: string, params?: Record<string, string | number>): string => {
    let translation = translations[key] || key;
    
    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
      });
    }
    
    return translation;
  };

  // Load languages on mount
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const allLanguages = await getAllLanguages(true); // Only active languages
        setLanguages(allLanguages);
        const normalizedDefault = normalizeCode(defaultLanguageCode);
        
        // Check for saved preference first
        if (typeof window !== 'undefined') {
          const savedLanguageCode = normalizeCode(localStorage.getItem('preferredLanguage'));
          if (savedLanguageCode && allLanguages.length > 0) {
            const savedLanguage = allLanguages.find(lang => normalizeCode(lang.code) === savedLanguageCode);
            if (savedLanguage) {
              await setLanguage(savedLanguage);
              return;
            }
          }
        }
        
        // Set default language
        if (allLanguages.length > 0) {
          const defaultLang =
            allLanguages.find(lang => normalizeCode(lang.code) === normalizedDefault) || allLanguages[0];
          if (defaultLang) {
            await setLanguage(defaultLang);
          }
        } else {
          // No languages available, set loading to false
          setIsLoading(false);
        }
      } catch {
        // Failed to load languages
        setIsLoading(false);
      }
    };
    
    loadLanguages();
  }, [defaultLanguageCode]);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        languages,
        translations,
        setLanguage,
        t,
        isLoading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

