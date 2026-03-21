'use client';

import React, { useEffect, useState } from 'react';
import { getPageBySlug } from '@/lib/firestore/pages_db';
import { Page, PageContentTranslation } from '@/lib/firestore/pages';
import { useLanguage } from '../../context/LanguageContext';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQs = () => {
  const { currentLanguage } = useLanguage();
  const [, setPage] = useState<Page | null>(null);
  const [translation, setTranslation] = useState<PageContentTranslation | null>(null);
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        const pageData = await getPageBySlug('faq');
        setPage(pageData);
        
        if (pageData) {
          const translations = pageData.translations || [];
          const langCode = currentLanguage?.code || 'en';
          const pageTranslation = translations.find(t => t.languageCode === langCode)
            || translations.find(t => t.languageCode === 'en')
            || translations[0];
          
          setTranslation(pageTranslation || null);
          
          // Parse FAQ items from HTML content
          if (pageTranslation?.content) {
            parseFAQContent(pageTranslation.content);
          } else {
            setFaqItems([]);
          }
        } else {
          setTranslation(null);
          setFaqItems([]);
        }
      } catch {
        // Failed to load FAQ page
        setTranslation(null);
        setFaqItems([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadPage();
  }, [currentLanguage]);

  const parseFAQContent = (htmlContent: string) => {
    if (!htmlContent) {
      setFaqItems([]);
      return;
    }
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const elements = Array.from(doc.body.children);
      const items: FAQItem[] = [];
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const tagName = element.tagName.toLowerCase();
        
        // Look for headings (h2-h6) as questions
        if (tagName.match(/^h[2-6]$/)) {
          const question = element.textContent?.trim() || '';
          let answer = '';
          
          // Get next sibling elements until next heading
          let nextSibling = element.nextElementSibling;
          while (nextSibling && !nextSibling.tagName.match(/^h[1-6]$/)) {
            answer += nextSibling.outerHTML;
            nextSibling = nextSibling.nextElementSibling;
          }
          
          if (question) {
            items.push({ question, answer: answer || '' });
          }
        }
      }
      
      setFaqItems(items);
    } catch {
      // Failed to parse FAQ content
      setFaqItems([]);
    }
  };

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

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {translation?.title || 'Frequently Asked Questions'}
          </h1>
          <p className="text-sm text-gray-500">Find answers to common questions about our products, shipping, and returns.</p>
        </div>
      </div>

      <div className="page-container max-w-3xl">
        {faqItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.71-.426 3.705-.426 5.242 0 1.562.39 2.512 1.864 2.512 3.484 0 1.621-.95 3.095-2.512 3.484-.426.106-.87.186-1.316.23v1.5a3.75 3.75 0 0 1-3.75 3.75H9a1.5 1.5 0 0 1-1.5-1.5v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v9.75c0 .621.504 1.125 1.125 1.125H4.5a1.5 1.5 0 0 1 1.5 1.5v1.5c0 .621.504 1.125 1.125 1.125h4.125c.621 0 1.125-.504 1.125-1.125v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v7.125c0 .621-.504 1.125-1.125 1.125h-9.75A2.25 2.25 0 0 1 3 18.375v-9.75A2.25 2.25 0 0 1 5.25 6.375h1.872c.311 0 .622.058.909.173l1.561.389A3.751 3.751 0 0 1 12 2.25c1.12 0 2.08.402 2.857 1.034l1.143.857A1.5 1.5 0 0 1 17.25 6.375v9.75a2.25 2.25 0 0 1-2.25 2.25h-9.75A2.25 2.25 0 0 1 3 16.125v-9.75Z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold mb-1 text-gray-900">No FAQs available</h2>
            <p className="text-xs text-gray-500">FAQs will be added soon. Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {faqItems.map((item, index) => (
              <FAQItem key={index} question={item.question} answer={item.answer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900 pr-4">{question}</h3>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 pb-4">
          <div 
            className="text-xs text-gray-600 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-a:text-gray-900 prose-a:underline hover:prose-a:text-gray-600"
            dangerouslySetInnerHTML={{ __html: answer || 'No answer provided.' }}
          />
        </div>
      )}
    </div>
  );
};

export default FAQs;
