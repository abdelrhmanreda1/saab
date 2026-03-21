'use client';

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

interface AboutClientProps {
  initialPage: SerializedPage | null;
}

const AboutClient: React.FC<AboutClientProps> = ({ initialPage }) => {
  // Safely get language context with fallback
  const languageContext = useContext(LanguageContext);
  const currentLanguage = useMemo(() => {
    return languageContext?.currentLanguage || { code: 'en' };
  }, [languageContext?.currentLanguage]);

  const [page] = useState<SerializedPage | null>(initialPage);
  const [translation, setTranslation] = useState<SerializedPageContentTranslation | null>(null);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );
  const normalizeCode = (code?: string | null) => String(code || '').trim().toLowerCase();
  const langCode = normalizeCode(currentLanguage?.code) || 'en';
  const isArabic = langCode === 'ar';

  const decodeHtmlEntities = (input: string) => {
    const decodeOnce = (raw: string) => {
      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = raw;
        return textarea.value;
      }
      return raw
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
    };

    let s = String(input || '');
    for (let i = 0; i < 3; i++) {
      const decoded = decodeOnce(s);
      if (decoded === s) break;
      s = decoded;
    }
    return s;
  };

  const defaultTitle = t('about.default_title') || (isArabic ? 'من نحن' : 'About Us');
  const defaultSubtitle =
    t('about.default_subtitle')
    || (isArabic ? 'تعرف على متجرنا المتخصص في الذهب والمجوهرات.' : 'Learn more about our gold & jewelry store.');
  const defaultHtml =
    t('about.default_html')
    || (isArabic
      ? `
        <h2>رسالتنا</h2>
        <p>نقدم مجوهرات ذهبية بجودة عالية وتسعير واضح يعتمد على سعر الذهب حسب العيار، مع تجربة شراء سهلة وخدمة موثوقة.</p>
        <h2>لماذا نحن؟</h2>
        <ul>
          <li><strong>شفافية التسعير:</strong> عرض سعر الذهب حسب العيارات وتحديثه.</li>
          <li><strong>جودة ومنتجات مختارة:</strong> تصميمات راقية وخامات ممتازة.</li>
          <li><strong>خدمة عملاء:</strong> دعم سريع ومتابعة للطلبات.</li>
        </ul>
      `
      : `
        <h2>Our mission</h2>
        <p>We offer high-quality gold jewelry with clear pricing based on karat gold rates, backed by a smooth shopping experience and reliable service.</p>
        <h2>Why choose us</h2>
        <ul>
          <li><strong>Transparent pricing:</strong> live gold rates by karat.</li>
          <li><strong>Curated quality:</strong> premium materials and timeless designs.</li>
          <li><strong>Support:</strong> fast, helpful customer care.</li>
        </ul>
      `);

  useEffect(() => {
    if (!page) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTranslation(null);
      return;
    }

    const translations = page.translations || [];
    const pickByCode = (code: string) =>
      translations.find(tr => normalizeCode(tr.languageCode) === normalizeCode(code));

    const exact = pickByCode(langCode);
    const english = pickByCode('en');

    // Important: When UI language is Arabic and there's no Arabic content,
    // do NOT fall back to English content (to avoid showing English on Arabic UI).
    if (langCode === 'ar') {
      const hasArabic = Boolean(exact?.title?.trim() || exact?.content?.trim());
      setTranslation(hasArabic ? exact! : null);
      return;
    }

    const fallback = exact || english || translations[0] || null;
    setTranslation(fallback);
  }, [page, langCode]);

  const hasTranslationContent = Boolean(translation?.title?.trim() || translation?.content?.trim());

  if (!translation || !hasTranslationContent) {
    return (
      <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {defaultTitle}
          </h1>
          <p className="text-sm text-gray-600">{defaultSubtitle}</p>
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
            {t('common.last_updated') || 'Last Updated'}: {translation.updatedAt 
              ? (translation.updatedAt.seconds && translation.updatedAt.nanoseconds
                  ? new Date(translation.updatedAt.seconds * 1000 + translation.updatedAt.nanoseconds / 1000000).toLocaleDateString()
                  : t('common.not_available') || 'N/A')
              : t('common.not_available') || 'N/A'}
          </p>
        </div>
      </div>
      
      <div className="page-container max-w-3xl">
        <div className="bg-white border border-gray-100 rounded-xl p-6 md:p-8">
          <div 
            className="quill-content prose prose-sm max-w-none prose-headings:font-heading prose-headings:font-semibold prose-headings:text-gray-900 prose-h2:text-base prose-h3:text-sm prose-p:text-xs prose-p:text-gray-600 prose-p:leading-relaxed prose-p:my-2"
            dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(translation.content) }}
          />
        </div>
      </div>
    </div>
  );
};

export default AboutClient;

