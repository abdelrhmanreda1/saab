'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Language } from '@/lib/firestore/internationalization';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import { getTranslationsByLanguage } from '@/lib/firestore/translations_db';
import { DEFAULT_TRANSLATION_KEYS } from '@/lib/firestore/translations';
import arabicPack from '@/data/translations/ar.json';

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

  // Cache translations to make language switching instant
  const translationsCacheRef = useRef<Map<string, Record<string, string>>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<Record<string, string>>>>(new Map());

  const getCacheKey = (code: string) => `translations_cache_${code}`;

  const readCachedTranslations = (code: string): Record<string, string> | null => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(getCacheKey(code));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as Record<string, string>;
    } catch {
      return null;
    }
  };

  const writeCachedTranslations = (code: string, data: Record<string, string>) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(getCacheKey(code), JSON.stringify(data));
    } catch {
      // ignore
    }
  };

  const getInstantFallback = (code: string) => {
    if (code === 'ar') {
      return { ...DEFAULT_TRANSLATION_KEYS, ...(arabicPack as Record<string, string>) };
    }
    return { ...DEFAULT_TRANSLATION_KEYS };
  };

  const setLanguage = async (language: Language) => {
    const languageCode = normalizeCode(language.code) || language.code;
    try {
      // Instant UI switch (no waiting)
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

      // Apply cached translations immediately
      const memCached = translationsCacheRef.current.get(languageCode);
      const diskCached = memCached ? null : readCachedTranslations(languageCode);
      const instant = memCached || diskCached || getInstantFallback(languageCode);
      setTranslations(instant);
      if (diskCached && !memCached) {
        translationsCacheRef.current.set(languageCode, diskCached);
      }

      // Refresh from Firestore in background (still toggles instantly)
      setIsLoading(true);
      const existingInFlight = inFlightRef.current.get(languageCode);
      const promise =
        existingInFlight ||
        (async () => {
          const remote = await getTranslationsByLanguage(languageCode);
          if (languageCode === 'ar') {
            // For Arabic, always prefer the bundled `ar.json` pack over remote values to avoid
            // stale/incorrect Firestore translations overriding the curated UI copy.
            return { ...DEFAULT_TRANSLATION_KEYS, ...remote, ...(arabicPack as Record<string, string>) };
          }
          return { ...DEFAULT_TRANSLATION_KEYS, ...remote };
        })();
      inFlightRef.current.set(languageCode, promise);

      const mergedRemote = await promise;
      inFlightRef.current.delete(languageCode);

      // Only apply if user didn't switch again
      if (normalizeCode(currentLanguage?.code) === languageCode) {
        setTranslations(mergedRemote);
      }
      translationsCacheRef.current.set(languageCode, mergedRemote);
      writeCachedTranslations(languageCode, mergedRemote);
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

