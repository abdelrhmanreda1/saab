import React from 'react';
import { Metadata } from 'next';
import { Timestamp } from 'firebase/firestore';
import { getPageBySlug } from '@/lib/firestore/pages_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { Page } from '@/lib/firestore/pages';
import { DEFAULT_TRANSLATION_KEYS } from '@/lib/firestore/translations';
import AboutClient from './AboutClient';

// Serialized types for client components
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

// Helper function to serialize Timestamp to plain object
const serializeTimestamp = (timestamp: Timestamp | null | undefined): SerializedTimestamp => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000,
    };
  }
  // If it's already a plain object with seconds/nanoseconds
  if ('seconds' in timestamp && 'nanoseconds' in timestamp) {
    return timestamp as { seconds: number; nanoseconds: number };
  }
  return null;
};

// Serialize Page object for client component
const serializePage = (page: Page | null): SerializedPage | null => {
  if (!page) return null;
  
  return {
    id: page.id,
    slug: page.slug,
    isActive: page.isActive,
    createdAt: serializeTimestamp(page.createdAt),
    updatedAt: serializeTimestamp(page.updatedAt),
    translations: page.translations?.map(trans => ({
      languageCode: trans.languageCode,
      title: trans.title,
      content: trans.content,
      metaTitle: trans.metaTitle,
      metaDescription: trans.metaDescription,
      updatedAt: serializeTimestamp(trans.updatedAt),
    })) || [],
  };
};

const pickPreferredTranslation = (translations: Page['translations'] | undefined, preferredLanguage: string) => {
  const normalizedPreferred = preferredLanguage.trim().toLowerCase();
  const normalizedTranslations = (translations || []).map((translation) => ({
    raw: translation,
    languageCode: String(translation.languageCode || '').trim().toLowerCase(),
    metaTitle: translation.metaTitle?.trim() || '',
    metaDescription: translation.metaDescription?.trim() || '',
    title: translation.title?.trim() || '',
    content: translation.content?.trim() || '',
  }));

  const exactWithSeo = normalizedTranslations.find(
    (translation) =>
      translation.languageCode === normalizedPreferred &&
      (translation.metaTitle || translation.metaDescription)
  );
  if (exactWithSeo) return exactWithSeo.raw;

  const exact = normalizedTranslations.find(
    (translation) => translation.languageCode === normalizedPreferred
  );
  if (exact) return exact.raw;

  const englishWithSeo = normalizedTranslations.find(
    (translation) =>
      translation.languageCode === 'en' &&
      (translation.metaTitle || translation.metaDescription)
  );
  if (englishWithSeo) return englishWithSeo.raw;

  const arabicWithSeo = normalizedTranslations.find(
    (translation) =>
      translation.languageCode === 'ar' &&
      (translation.metaTitle || translation.metaDescription)
  );
  if (arabicWithSeo) return arabicWithSeo.raw;

  return normalizedTranslations[0]?.raw;
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO, page] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
      getPageSEO('/about').catch(() => null),
      getPageBySlug('about').catch(() => null),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';
    const siteLanguage = String(settings?.site?.language || 'en');
    
    // Prefer a matching translation case-insensitively, and prefer the one that
    // actually contains SEO fields when duplicates like EN/en both exist.
    const pageTranslation = pickPreferredTranslation(page?.translations, siteLanguage);
    const pageMetaTitle = pageTranslation?.metaTitle?.trim();
    const pageMetaDescription = pageTranslation?.metaDescription?.trim();
    const pageTitle = pageTranslation?.title?.trim();
    const pageContent = pageTranslation?.content?.trim();

    // Create a PageSEO-like object prioritizing page translation SEO over page_seo collection
    // Only use page translation SEO if it's not empty
    const pageSEOData = (pageMetaTitle || pageMetaDescription) ? {
      title: pageMetaTitle || pageSEO?.title,
      description: pageMetaDescription || pageSEO?.description,
      keywords: pageSEO?.keywords,
      metaImage: pageSEO?.metaImage,
      canonicalUrl: pageSEO?.canonicalUrl,
      noIndex: pageSEO?.noIndex ?? false,
      noFollow: pageSEO?.noFollow ?? false,
    } : pageSEO;

    return generateSEOMetadata({
      globalSEO,
      pageSEO: pageSEOData as typeof pageSEO,
      fallbackTitle:
        pageMetaTitle ||
        pageSEO?.title ||
        pageTitle ||
        `${DEFAULT_TRANSLATION_KEYS['footer.about_us'] || 'About Us'} | ${companyName}`,
      fallbackDescription:
        pageMetaDescription ||
        pageSEO?.description ||
        pageContent ||
        `Learn more about ${companyName}.`,
      fallbackImage: pageSEO?.metaImage,
      url: '/about',
      fallbackTitlePriority: 'high',
      fallbackDescriptionPriority: 'high',
    });
  } catch {
    // Error generating about metadata - return fallback
    try {
      const settings = await getSettings().catch(() => null);
      const companyName = settings?.company?.name || '';
      return {
        title: `${DEFAULT_TRANSLATION_KEYS['footer.about_us']} | ${companyName}`,
        description: '',
      };
    } catch {
      return {
        title: DEFAULT_TRANSLATION_KEYS['footer.about_us'] || 'About Us',
        description: '',
      };
    }
  }
}

const AboutPage = async () => {
  let page: Page | null = null;
  try {
    page = await getPageBySlug('about');
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    // The client component will handle fetching data on the client side if needed
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      // Permission denied - this is expected during build time
      // The page will still render and can fetch data on client side
      page = null;
    } else {
      // Other errors - also handle gracefully
      page = null;
    }
  }
  
  const serializedPage = serializePage(page);

  return <AboutClient initialPage={serializedPage} />;
};

export default AboutPage;
