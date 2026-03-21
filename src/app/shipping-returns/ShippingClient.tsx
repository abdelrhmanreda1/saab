'use client';

import '../quill-content.css';
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { LanguageContext } from '../../context/LanguageContext';

// Serialized types matching server component
type SerializedTimestamp = { seconds: number; nanoseconds: number } | null;

interface SerializedPageContentTranslation {
  languageCode: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  updatedAt: SerializedTimestamp;
}

interface SerializedPage {
  id?: string;
  slug: string;
  isActive: boolean;
  translations: SerializedPageContentTranslation[];
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
}

interface ShippingClientProps {
  initialPage: SerializedPage | null;
}

const ShippingClient: React.FC<ShippingClientProps> = ({ initialPage }) => {
  // Safely get language context with fallback
  const languageContext = useContext(LanguageContext);
  const currentLanguage = useMemo(() => {
    return languageContext?.currentLanguage || { code: 'en' };
  }, [languageContext?.currentLanguage]);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const [page] = useState<SerializedPage | null>(initialPage);
  const [translation, setTranslation] = useState<SerializedPageContentTranslation | null>(null);

  useEffect(() => {
    if (!page) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTranslation(null);
      return;
    }

    const translations = page.translations || [];
    const langCode = currentLanguage?.code || 'en';
    const pageTranslation = translations.find(t => t.languageCode === langCode)
      || translations.find(t => t.languageCode === 'en')
      || translations[0];
    
    setTranslation(pageTranslation || null);
  }, [page, currentLanguage]);

  if (!translation) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">{t('shipping_returns.title') || 'Shipping & Returns'}</h1>
            <p className="text-gray-500">{t('shipping_returns.content_not_available') || 'Content not available in your language.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">{translation.title}</h1>
          <p className="text-xs text-gray-500">
            {t('shipping_returns.last_updated') || 'Last Updated:'} {translation.updatedAt 
              ? (translation.updatedAt.seconds && translation.updatedAt.nanoseconds
                  ? new Date(translation.updatedAt.seconds * 1000 + translation.updatedAt.nanoseconds / 1000000).toLocaleDateString()
                  : (t('shipping_returns.not_available') || 'N/A'))
              : (t('shipping_returns.not_available') || 'N/A')}
          </p>
        </div>
      </div>
      
      <div className="page-container max-w-3xl">
        <div className="bg-white border border-gray-100 rounded-xl p-6 md:p-8">
          <div 
            className="quill-content prose prose-sm max-w-none prose-headings:font-heading prose-headings:font-semibold prose-headings:text-gray-900 prose-h2:text-base prose-h3:text-sm prose-p:text-xs prose-p:text-gray-600 prose-p:leading-relaxed prose-p:my-2"
            dangerouslySetInnerHTML={{ __html: translation.content }}
          />
        </div>
      </div>
    </div>
  );
};

export default ShippingClient;

