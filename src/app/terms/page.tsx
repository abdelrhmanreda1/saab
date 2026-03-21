'use client';

import '../quill-content.css';
import React, { useEffect, useState } from 'react';
import { getPageBySlug } from '@/lib/firestore/pages_db';
import { Page, PageContentTranslation } from '@/lib/firestore/pages';
import { useLanguage } from '../../context/LanguageContext';

const TermsOfService = () => {
  const { currentLanguage } = useLanguage();
  const [, setPage] = useState<Page | null>(null);
  const [translation, setTranslation] = useState<PageContentTranslation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        // Add cache busting to ensure fresh data
        const pageData = await getPageBySlug('terms');
        setPage(pageData);
        
        if (pageData) {
          // Ensure translations array exists
          const translations = pageData.translations || [];
          
          // Find translation for current language
          const langCode = currentLanguage?.code || 'en';
          const pageTranslation = translations.find(t => t.languageCode === langCode)
            || translations.find(t => t.languageCode === 'en')
            || translations[0];
          
          setTranslation(pageTranslation || null);
        } else {
          setTranslation(null);
        }
      } catch {
        // Failed to load terms of service
        setTranslation(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadPage();
  }, [currentLanguage]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-2 w-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!translation) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-gray-500">Content not available in your language.</p>
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
            Last Updated: {translation.updatedAt && typeof translation.updatedAt.toDate === 'function' 
              ? new Date(translation.updatedAt.toDate()).toLocaleDateString() 
              : translation.updatedAt instanceof Date 
                ? translation.updatedAt.toLocaleDateString()
                : 'N/A'}
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

export default TermsOfService;
