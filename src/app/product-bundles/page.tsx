import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { getAllProductBundles } from '@/lib/firestore/product_bundles_db';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { Timestamp } from 'firebase/firestore';
import ProductBundlesClient from './ProductBundlesClient';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
      getPageSEO('/product-bundles').catch(() => null),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `Product Bundles | ${companyName}`,
      fallbackDescription: 'Exclusive bundle deals and special offers - save more when you buy together!',
      url: '/product-bundles',
    });
  } catch {
    // Failed to generate product-bundles metadata - return fallback
    try {
      const settings = await getSettings().catch(() => null);
      const companyName = settings?.company?.name || '';
      return {
        title: `Product Bundles | ${companyName}`,
        description: 'Exclusive bundle deals and special offers - save more when you buy together!',
      };
    } catch {
      return {
        title: 'Product Bundles',
        description: 'Exclusive bundle deals and special offers - save more when you buy together!',
      };
    }
  }
}

// Serialized types for client components
type SerializedTimestamp = { seconds: number; nanoseconds: number } | null;

const serializeTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | { toDate: () => Date } | null | undefined): SerializedTimestamp => {
  if (!timestamp) return null;
  
  let seconds: number;
  let nanoseconds: number;
  
  if (timestamp instanceof Timestamp) {
    seconds = timestamp.seconds;
    nanoseconds = timestamp.nanoseconds;
  } else if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    seconds = Math.floor(date.getTime() / 1000);
    nanoseconds = (date.getTime() % 1000) * 1000000;
  } else if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
    const ts = timestamp as { seconds: number | string; nanoseconds: number | string };
    seconds = Number(ts.seconds);
    nanoseconds = Number(ts.nanoseconds);
  } else {
    return null;
  }
  
  const plainObj = { seconds: Number(seconds), nanoseconds: Number(nanoseconds) };
  return JSON.parse(JSON.stringify(plainObj));
};

type SerializedProductBundle = Omit<ProductBundle, 'validFrom' | 'validUntil' | 'createdAt' | 'updatedAt'> & {
  validFrom?: SerializedTimestamp;
  validUntil?: SerializedTimestamp;
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
};

const serializeBundle = (bundle: ProductBundle): SerializedProductBundle => {
  const { validFrom, validUntil, createdAt, updatedAt, ...rest } = bundle;
  return {
    ...rest,
    validFrom: validFrom ? serializeTimestamp(validFrom) : undefined,
    validUntil: validUntil ? serializeTimestamp(validUntil) : undefined,
    createdAt: serializeTimestamp(createdAt),
    updatedAt: serializeTimestamp(updatedAt),
  };
};

const ProductBundlesPage = async () => {
  let bundles: ProductBundle[] = [];
  
  try {
    bundles = await getAllProductBundles(true).catch(() => []); // activeOnly = true
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    // The client component will handle fetching data on the client side if needed
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      // Permission denied - this is expected during build time
      // The page will still render and can fetch data on client side
      bundles = [];
    } else {
      // Other errors - also handle gracefully
      bundles = [];
    }
  }

  // Filter valid bundles (current time between validFrom and validUntil)
  const now = new Date();
  const validBundles = bundles.filter(bundle => {
    if (!bundle.isActive) return false;
    if (bundle.validFrom && bundle.validFrom.toDate && bundle.validFrom.toDate() > now) return false;
    if (bundle.validUntil && bundle.validUntil.toDate && bundle.validUntil.toDate() < now) return false;
    return true;
  });

  // Serialize bundles
  const serializedBundles = validBundles.map(serializeBundle);

  return (
    <Suspense fallback={
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container">
            <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
          </div>
        </div>
        <div className="page-container pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <ProductBundlesClient bundles={serializedBundles as ProductBundle[]} />
    </Suspense>
  );
};

export default ProductBundlesPage;

