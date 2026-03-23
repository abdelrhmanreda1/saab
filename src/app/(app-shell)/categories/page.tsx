import React from 'react';
import { Metadata } from 'next';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { pickFirstImage } from '@/lib/utils/metadata-images';
import CategoriesClient from './CategoriesClient';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO, categories] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
      getPageSEO('/categories').catch(() => null),
      getAllCategories().catch(() => []),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    const categoryImage = pickFirstImage(
      ...categories.map((category) => category.imageUrl)
    );

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `الأقسام | ${companyName}`,
      fallbackDescription: 'استكشف أقسام المنتجات المختلفة داخل المتجر.',
      fallbackImage: pickFirstImage(pageSEO?.metaImage, categoryImage),
      url: '/categories',
      fallbackTitlePriority: 'high',
      fallbackDescriptionPriority: 'high',
    });
  } catch {
    // Failed to generate categories metadata - return fallback
    try {
      const settings = await getSettings().catch(() => null);
      const companyName = settings?.company?.name || '';
      return {
        title: `الأقسام | ${companyName}`,
        description: 'استكشف أقسام المنتجات المختلفة داخل المتجر.',
      };
    } catch {
      return {
        title: 'الأقسام',
        description: 'استكشف أقسام المنتجات المختلفة داخل المتجر.',
      };
    }
  }
}

export const dynamic = 'force-dynamic';

import { Category } from '@/lib/firestore/categories';
import { Timestamp } from 'firebase/firestore';

interface SerializedCategory extends Omit<Category, 'createdAt' | 'updatedAt' | 'translations'> {
  createdAt: { seconds: number; nanoseconds: number } | null;
  updatedAt: { seconds: number; nanoseconds: number } | null;
  translations?: Array<{
    languageCode: string;
    name: string;
    description?: string;
    updatedAt: { seconds: number; nanoseconds: number } | null;
  }>;
}

const serializeTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | { toDate: () => Date } | null | undefined): { seconds: number; nanoseconds: number } | null => {
  if (!timestamp) return null;
  
  let seconds: number;
  let nanoseconds: number;
  
  // Handle Firestore Timestamp instance
  if (timestamp instanceof Timestamp) {
    seconds = timestamp.seconds;
    nanoseconds = timestamp.nanoseconds;
  }
  // Handle Timestamp-like object with toDate method
  else if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    seconds = Math.floor(date.getTime() / 1000);
    nanoseconds = (date.getTime() % 1000) * 1000000;
  }
  // Handle object with seconds and nanoseconds (extract values even if it has methods)
  else if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
    // Extract primitive values directly, don't reference the object
    const ts = timestamp as { seconds: number | string; nanoseconds: number | string };
    seconds = Number(ts.seconds);
    nanoseconds = Number(ts.nanoseconds);
  }
  else {
    return null;
  }
  
  // Create a completely plain object by using JSON.parse(JSON.stringify())
  // This completely strips any prototype methods including toJSON
  const plainObj = { seconds: Number(seconds), nanoseconds: Number(nanoseconds) };
  return JSON.parse(JSON.stringify(plainObj));
};

const serializeCategories = (categories: Category[]): SerializedCategory[] => {
  return categories.map(cat => ({
    ...cat,
    createdAt: serializeTimestamp(cat.createdAt),
    updatedAt: serializeTimestamp(cat.updatedAt),
    // Serialize translations array if it exists
    translations: cat.translations?.map(trans => ({
      ...trans,
      updatedAt: serializeTimestamp(trans.updatedAt),
    })),
  }));
};

const CategoriesPage = async () => {
  let categories: Category[] = [];
  
  try {
    categories = await getAllCategories().catch(() => []);
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      categories = [];
    } else {
      categories = [];
    }
  }
  
  const serializedCategories = serializeCategories(categories);

  return <CategoriesClient categories={serializedCategories} />;
};

export default CategoriesPage;
