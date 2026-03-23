import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { Product } from '@/lib/firestore/products';
import { FlashSale } from '@/lib/firestore/campaigns';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { pickFirstImage } from '@/lib/utils/metadata-images';
import { Timestamp } from 'firebase/firestore';
import FlashClient from './FlashClient';
import { generateSlug } from '@/lib/utils/slug';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO, products, flashSales] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
      getPageSEO('/flash').catch(() => null),
      getAllProducts().catch(() => []),
      getAllFlashSales(true).catch(() => []),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    const now = new Date();
    const activeFlashProductIds = new Set(
      flashSales
        .filter((sale) => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        })
        .flatMap((sale) => sale.productIds)
    );

    const flashImage = pickFirstImage(
      ...products
        .filter((product) => product.isActive !== false && activeFlashProductIds.has(product.id))
        .flatMap((product) => product.images || [])
    );

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `Flash Sale | ${companyName}`,
      fallbackDescription: 'Limited time flash sale offers - grab them before they\'re gone!',
      fallbackImage: pickFirstImage(pageSEO?.metaImage, flashImage),
      url: '/flash',
    });
  } catch {
    // Failed to generate flash metadata - return fallback
    try {
      const settings = await getSettings().catch(() => null);
      const companyName = settings?.company?.name || '';
      return {
        title: `Flash Sale | ${companyName}`,
        description: 'Limited time flash sale offers - grab them before they\'re gone!',
      };
    } catch {
      return {
        title: 'Flash Sale',
        description: 'Limited time flash sale offers - grab them before they\'re gone!',
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

type SerializedProduct = Omit<Product, 'createdAt' | 'updatedAt' | 'preOrderExpectedDate' | 'analytics' | 'translations'> & {
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
  preOrderExpectedDate?: SerializedTimestamp;
  analytics?: Omit<Product['analytics'], 'lastViewed'> & {
    lastViewed?: SerializedTimestamp;
  };
  translations?: Array<{
    languageCode: string;
    name: string;
    description: string;
    updatedAt: SerializedTimestamp;
  }>;
};

type SerializedFlashSale = Omit<FlashSale, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'> & {
  startTime: SerializedTimestamp;
  endTime: SerializedTimestamp;
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
};

const serializeProduct = (product: Product): SerializedProduct => {
  let slug = product.slug;
  if (!slug || slug.trim() === '') {
    slug = generateSlug(product.name || `product-${product.id}`);
  }
  
  const { translations, createdAt, updatedAt, preOrderExpectedDate, analytics, ...rest } = product;
  
  const serializedTranslations = translations?.map(trans => {
    const serializedUpdatedAt = serializeTimestamp(trans.updatedAt);
    const plainUpdatedAt = serializedUpdatedAt ? JSON.parse(JSON.stringify({
      seconds: Number(serializedUpdatedAt.seconds),
      nanoseconds: Number(serializedUpdatedAt.nanoseconds),
    })) : null;
    
    const plainTrans = {
      languageCode: String(trans.languageCode),
      name: String(trans.name),
      description: String(trans.description),
      updatedAt: plainUpdatedAt,
    };
    
    return JSON.parse(JSON.stringify(plainTrans));
  });
  
  return {
    ...rest,
    slug,
    createdAt: serializeTimestamp(createdAt),
    updatedAt: serializeTimestamp(updatedAt),
    preOrderExpectedDate: preOrderExpectedDate ? serializeTimestamp(preOrderExpectedDate) : undefined,
    analytics: analytics ? {
      ...analytics,
      lastViewed: analytics.lastViewed ? serializeTimestamp(analytics.lastViewed) : undefined
    } : undefined,
    translations: serializedTranslations,
  };
};

const serializeFlashSale = (sale: FlashSale): SerializedFlashSale => {
  const { startTime, endTime, createdAt, updatedAt, ...rest } = sale;
  return {
    ...rest,
    startTime: serializeTimestamp(startTime),
    endTime: serializeTimestamp(endTime),
    createdAt: serializeTimestamp(createdAt),
    updatedAt: serializeTimestamp(updatedAt),
  };
};

const FlashPage = async () => {
  let products: Product[] = [];
  let flashSales: FlashSale[] = [];
  
  try {
    const [fetchedProducts, fetchedFlashSales] = await Promise.all([
      getAllProducts().catch(() => []),
      getAllFlashSales(true).catch(() => []), // activeOnly = true
    ]);
    
    products = fetchedProducts;
    flashSales = fetchedFlashSales;
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    // The client component will handle fetching data on the client side if needed
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      // Permission denied - this is expected during build time
      // The page will still render and can fetch data on client side
      products = [];
      flashSales = [];
    } else {
      // Other errors - also handle gracefully
      products = [];
      flashSales = [];
    }
  }

  // Filter valid flash sales (current time between start and end)
  const now = new Date();
  const validFlashSales = flashSales.filter(sale => {
    if (!sale.isActive) return false;
    const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
    const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
    return now >= startTime && now <= endTime;
  });

  // Get all product IDs from valid flash sales
  const flashSaleProductIds = new Set<string>();
  validFlashSales.forEach(sale => {
    sale.productIds.forEach(id => flashSaleProductIds.add(id));
  });

  // Filter products that are in flash sales and are active
  const flashSaleProducts = products
    .filter(p => p.isActive !== false && flashSaleProductIds.has(p.id))
    .map(serializeProduct);

  // Serialize flash sales
  const serializedFlashSales = validFlashSales.map(serializeFlashSale);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <FlashClient 
        products={flashSaleProducts as Product[]} 
        flashSales={serializedFlashSales as FlashSale[]}
      />
    </Suspense>
  );
};

export default FlashPage;

