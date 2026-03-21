import React from 'react';
import { Metadata } from 'next';
import { getAllBrands } from '@/lib/firestore/brands_db';
import { Brand } from '@/lib/firestore/brands';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import BrandsClient from './BrandsClient';
import { Timestamp } from 'firebase/firestore';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO] = await Promise.all([
      getSettings(),
      getSEOSettings(),
      getPageSEO('/brands'),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `Brands | ${companyName}`,
      fallbackDescription: 'Shop by your favorite brands.',
      url: '/brands',
    });
  } catch {
    // Failed to generate brands metadata
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `Brands | ${companyName}`,
      description: 'Shop by your favorite brands.',
    };
  }
}

export const dynamic = 'force-dynamic';

interface SerializedBrand extends Omit<Brand, 'createdAt' | 'updatedAt' | 'translations'> {
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

const serializeBrands = (brands: Brand[]): SerializedBrand[] => {
  return brands.map(brand => ({
    ...brand,
    createdAt: serializeTimestamp(brand.createdAt),
    updatedAt: serializeTimestamp(brand.updatedAt),
    // Serialize translations array if it exists
    translations: brand.translations?.map(trans => ({
      ...trans,
      updatedAt: serializeTimestamp(trans.updatedAt),
    })),
  }));
};

const BrandsPage = async () => {
  let brands: Brand[] = [];
  
  try {
    brands = await getAllBrands().catch(() => []);
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      brands = [];
    } else {
      brands = [];
    }
  }

  const serializedBrands = serializeBrands(brands);

  return <BrandsClient brands={serializedBrands} />;
};

export default BrandsPage;
