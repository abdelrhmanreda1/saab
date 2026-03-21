import React from 'react';
import { Metadata } from 'next';
import { Timestamp } from 'firebase/firestore';
import { getPageBySlug } from '@/lib/firestore/pages_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { Page } from '@/lib/firestore/pages';

// For size-guide we render raw HTML (already contains full layout)
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

const serializeTimestamp = (timestamp: Timestamp | null | undefined): SerializedTimestamp => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000,
    };
  }
  if ('seconds' in timestamp && 'nanoseconds' in timestamp) {
    return timestamp as { seconds: number; nanoseconds: number };
  }
  return null;
};

const serializePage = (page: Page | null): SerializedPage | null => {
  if (!page) return null;

  return {
    id: page.id,
    slug: page.slug,
    isActive: page.isActive,
    createdAt: serializeTimestamp(page.createdAt),
    updatedAt: serializeTimestamp(page.updatedAt),
    translations:
      page.translations?.map((trans) => ({
        languageCode: trans.languageCode,
        title: trans.title,
        content: trans.content,
        metaTitle: trans.metaTitle,
        metaDescription: trans.metaDescription,
        updatedAt: serializeTimestamp(trans.updatedAt),
      })) || [],
  };
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO, page] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
      getPageSEO('/size-guide').catch(() => null),
      getPageBySlug('size-guide').catch(() => null),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    const pageTranslation =
      page?.translations?.find((t) => t.languageCode === 'en') || page?.translations?.[0];
    const pageMetaTitle = pageTranslation?.metaTitle?.trim();
    const pageMetaDescription = pageTranslation?.metaDescription?.trim();

    const pageSEOData =
      pageMetaTitle || pageMetaDescription
        ? {
            title: pageMetaTitle || pageSEO?.title,
            description: pageMetaDescription || pageSEO?.description,
            keywords: pageSEO?.keywords,
            metaImage: pageSEO?.metaImage,
            canonicalUrl: pageSEO?.canonicalUrl,
            noIndex: pageSEO?.noIndex ?? false,
            noFollow: pageSEO?.noFollow ?? false,
          }
        : pageSEO;

    return generateSEOMetadata({
      globalSEO,
      pageSEO: pageSEOData as typeof pageSEO,
      fallbackTitle:
        pageMetaTitle || pageSEO?.title || globalSEO?.siteTitle || companyName || 'Size Guide',
      fallbackDescription:
        pageMetaDescription || pageSEO?.description || globalSEO?.siteDescription || '',
      url: '/size-guide',
    });
  } catch {
    // Failed to generate size-guide metadata - return fallback
    try {
      const settings = await getSettings().catch(() => null);
      const companyName = settings?.company?.name || '';
      return {
        title: `Size Guide | ${companyName}`,
        description: '',
      };
    } catch {
      return {
        title: 'Size Guide',
        description: '',
      };
    }
  }
}

const SizeGuidePage = async () => {
  let page: Page | null = null;
  try {
    page = await getPageBySlug('size-guide');
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      // Permission denied - this is expected during build time
      page = null;
    } else {
      // Other errors - also handle gracefully
      page = null;
    }
  }
  
  const serialized = serializePage(page);

  const translation =
    serialized?.translations.find((t) => t.languageCode === 'en') ||
    serialized?.translations[0] ||
    null;

  if (!translation || !translation.content) {
    // Fallback to a simple message if content not configured in admin
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
              Size Guide
            </h1>
            <p className="text-sm text-gray-500">Size guide content will appear here soon.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white"
      dangerouslySetInnerHTML={{ __html: translation.content }}
    />
  );
};

export default SizeGuidePage;
