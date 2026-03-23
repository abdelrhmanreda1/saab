import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllBrands } from '@/lib/firestore/brands_db';
import { getAllCollections } from '@/lib/firestore/collections_db';
import { getColors } from '@/lib/firestore/attributes_db';
import { Product } from '@/lib/firestore/products';
import { Category } from '@/lib/firestore/categories';
import { Brand } from '@/lib/firestore/brands';
import { Collection } from '@/lib/firestore/collections';
import { Color } from '@/lib/firestore/attributes';
import { generateSlug } from '@/lib/utils/slug';
import ShopClient from './ShopClient';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
      getPageSEO('/shop').catch(() => null),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `Shop | ${companyName}`,
      fallbackDescription: 'Browse our collection of modest fashion products.',
      fallbackImage: pageSEO?.metaImage,
      url: '/shop',
      fallbackTitlePriority: 'high',
      fallbackDescriptionPriority: 'high',
    });
  } catch {
    // Failed to generate shop metadata - return fallback
    try {
      const settings = await getSettings().catch(() => null);
      const companyName = settings?.company?.name || '';
      return {
        title: `Shop | ${companyName}`,
        description: 'Browse our collection of modest fashion products.',
      };
    } catch {
      return {
        title: 'Shop',
        description: 'Browse our collection of modest fashion products.',
      };
    }
  }
}

import { Timestamp } from 'firebase/firestore';

// Serialized types for client components
type SerializedTimestamp = { seconds: number; nanoseconds: number } | null;

// Helper function to serialize Timestamp to plain object
// Always creates a brand new plain object to ensure no methods are present
const serializeTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | { toDate: () => Date } | null | undefined): SerializedTimestamp => {
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

type SerializedCategory = Omit<Category, 'createdAt' | 'updatedAt' | 'translations'> & {
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
  translations?: Array<{
    languageCode: string;
    name: string;
    description?: string;
    updatedAt: SerializedTimestamp;
  }>;
};

type SerializedBrand = Omit<Brand, 'createdAt' | 'updatedAt' | 'translations'> & {
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
  translations?: Array<{
    languageCode: string;
    name: string;
    description?: string;
    updatedAt: SerializedTimestamp;
  }>;
};

type SerializedCollection = Omit<Collection, 'createdAt' | 'updatedAt' | 'translations'> & {
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
  translations?: Array<{
    languageCode: string;
    name: string;
    description?: string;
    updatedAt: SerializedTimestamp;
  }>;
};

const serializeProduct = (product: Product): SerializedProduct => {
  // Ensure slug exists - generate if missing
  let slug = product.slug;
  if (!slug || slug.trim() === '') {
    slug = generateSlug(product.name || `product-${product.id}`);
  }
  
  const { translations, createdAt, updatedAt, preOrderExpectedDate, analytics, ...rest } = product;
  
  // Serialize translations if they exist
  const serializedTranslations = translations?.map(trans => {
    const serializedUpdatedAt = serializeTimestamp(trans.updatedAt);
    const plainUpdatedAt = serializedUpdatedAt ? JSON.parse(JSON.stringify({
      seconds: Number(serializedUpdatedAt.seconds),
      nanoseconds: Number(serializedUpdatedAt.nanoseconds),
    })) : null;
    
    const plainTrans: {
      languageCode: string;
      name: string;
      description: string;
      updatedAt: { seconds: number; nanoseconds: number } | null;
    } = {
      languageCode: String(trans.languageCode),
      name: String(trans.name),
      description: String(trans.description),
      updatedAt: plainUpdatedAt,
    };
    
    return JSON.parse(JSON.stringify(plainTrans));
  });
  
  return {
    ...rest,
    slug, // Ensure slug is always present
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

const serializeCategory = (category: Category): SerializedCategory => {
  const categoryWithTranslations = category as Category & { translations?: Array<{ languageCode: string; name: string; description?: string; updatedAt: Timestamp }> };
  const { translations, createdAt, updatedAt, ...rest } = categoryWithTranslations;
  
  // Ensure rest only contains plain primitive values (no nested objects with methods)
  const plainRest: Omit<Category, 'createdAt' | 'updatedAt' | 'translations'> = {
    id: String(rest.id),
    name: String(rest.name),
    slug: String(rest.slug),
    description: rest.description ? String(rest.description) : undefined,
    imageUrl: rest.imageUrl ? String(rest.imageUrl) : undefined,
    parentCategory: rest.parentCategory ? String(rest.parentCategory) : undefined,
  };
  
  const serialized: SerializedCategory = {
    ...plainRest,
    createdAt: serializeTimestamp(createdAt),
    updatedAt: serializeTimestamp(updatedAt),
    translations: translations?.map((trans: { languageCode: string; name: string; description?: string; updatedAt: Timestamp }) => {
      // Extract values directly from the Timestamp to avoid any method issues
      let seconds: number;
      let nanoseconds: number;
      
      if (trans.updatedAt instanceof Timestamp) {
        seconds = trans.updatedAt.seconds;
        nanoseconds = trans.updatedAt.nanoseconds;
      } else if (trans.updatedAt && typeof trans.updatedAt === 'object' && 'toDate' in trans.updatedAt) {
        const tsWithToDate = trans.updatedAt as { toDate: () => Date };
        const date = tsWithToDate.toDate();
        seconds = Math.floor(date.getTime() / 1000);
        nanoseconds = (date.getTime() % 1000) * 1000000;
      } else if (trans.updatedAt && typeof trans.updatedAt === 'object' && 'seconds' in trans.updatedAt) {
        const ts = trans.updatedAt as { seconds: number | string; nanoseconds: number | string };
        seconds = Number(ts.seconds);
        nanoseconds = Number(ts.nanoseconds);
      } else {
        // Return plain object even when updatedAt is null
        const plainTrans: {
          languageCode: string;
          name: string;
          description?: string;
          updatedAt: null;
        } = {
          languageCode: String(trans.languageCode),
          name: String(trans.name),
          updatedAt: null,
        };
        if (trans.description !== undefined) {
          plainTrans.description = String(trans.description);
        }
        return JSON.parse(JSON.stringify(plainTrans));
      }
      
      // Create completely plain object with primitive values
      // Use JSON.parse(JSON.stringify()) to ensure no prototype methods are present
      const plainUpdatedAt = JSON.parse(JSON.stringify({
        seconds: Number(seconds),
        nanoseconds: Number(nanoseconds),
      }));
      
      const plainTrans: {
        languageCode: string;
        name: string;
        description?: string;
        updatedAt: { seconds: number; nanoseconds: number };
      } = {
        languageCode: String(trans.languageCode),
        name: String(trans.name),
        updatedAt: plainUpdatedAt,
      };
      
      if (trans.description !== undefined) {
        plainTrans.description = String(trans.description);
      }
      
      // Use JSON.parse(JSON.stringify()) to ensure completely plain object
      return JSON.parse(JSON.stringify(plainTrans));
    }) || undefined
  };
  
  return serialized;
};

const serializeBrand = (brand: Brand): SerializedBrand => {
  const brandWithTranslations = brand as Brand & { translations?: Array<{ languageCode: string; name: string; description?: string; updatedAt: Timestamp }> };
  const { translations, createdAt, updatedAt, ...rest } = brandWithTranslations;
  
  // Ensure rest only contains plain primitive values (no nested objects with methods)
  const plainRest: Omit<Brand, 'createdAt' | 'updatedAt' | 'translations'> = {
    id: String(rest.id),
    name: String(rest.name),
    slug: String(rest.slug),
    description: rest.description ? String(rest.description) : undefined,
    logoUrl: rest.logoUrl ? String(rest.logoUrl) : undefined,
  };
  
  const serialized: SerializedBrand = {
    ...plainRest,
    createdAt: serializeTimestamp(createdAt),
    updatedAt: serializeTimestamp(updatedAt),
    translations: translations?.map((trans: { languageCode: string; name: string; description?: string; updatedAt: Timestamp }) => {
      // Extract values directly from the Timestamp to avoid any method issues
      let seconds: number;
      let nanoseconds: number;
      
      if (trans.updatedAt instanceof Timestamp) {
        seconds = trans.updatedAt.seconds;
        nanoseconds = trans.updatedAt.nanoseconds;
      } else if (trans.updatedAt && typeof trans.updatedAt === 'object' && 'toDate' in trans.updatedAt) {
        const tsWithToDate = trans.updatedAt as { toDate: () => Date };
        const date = tsWithToDate.toDate();
        seconds = Math.floor(date.getTime() / 1000);
        nanoseconds = (date.getTime() % 1000) * 1000000;
      } else if (trans.updatedAt && typeof trans.updatedAt === 'object' && 'seconds' in trans.updatedAt) {
        const ts = trans.updatedAt as { seconds: number | string; nanoseconds: number | string };
        seconds = Number(ts.seconds);
        nanoseconds = Number(ts.nanoseconds);
      } else {
        // Return plain object even when updatedAt is null
        const plainTrans: {
          languageCode: string;
          name: string;
          description?: string;
          updatedAt: null;
        } = {
          languageCode: String(trans.languageCode),
          name: String(trans.name),
          updatedAt: null,
        };
        if (trans.description !== undefined) {
          plainTrans.description = String(trans.description);
        }
        return JSON.parse(JSON.stringify(plainTrans));
      }
      
      // Create completely plain object with primitive values
      // Use JSON.parse(JSON.stringify()) to ensure no prototype methods are present
      const plainUpdatedAt = JSON.parse(JSON.stringify({
        seconds: Number(seconds),
        nanoseconds: Number(nanoseconds),
      }));
      
      const plainTrans: {
        languageCode: string;
        name: string;
        description?: string;
        updatedAt: { seconds: number; nanoseconds: number };
      } = {
        languageCode: String(trans.languageCode),
        name: String(trans.name),
        updatedAt: plainUpdatedAt,
      };
      
      if (trans.description !== undefined) {
        plainTrans.description = String(trans.description);
      }
      
      // Use JSON.parse(JSON.stringify()) to ensure completely plain object
      return JSON.parse(JSON.stringify(plainTrans));
    }) || undefined
  };
  
  return serialized;
};

const serializeCollection = (collection: Collection): SerializedCollection => {
  const { translations, createdAt, updatedAt, ...rest } = collection;
  
  // Ensure rest only contains plain primitive values (no nested objects with methods)
  const plainRest: Omit<Collection, 'createdAt' | 'updatedAt' | 'translations'> = {
    id: String(rest.id),
    name: String(rest.name),
    slug: String(rest.slug),
    description: rest.description ? String(rest.description) : undefined,
    imageUrl: rest.imageUrl ? String(rest.imageUrl) : undefined,
    parentCollection: rest.parentCollection ? String(rest.parentCollection) : undefined,
  };
  
  // Ensure all timestamp fields are properly serialized
  const serialized: SerializedCollection = {
    ...plainRest,
    createdAt: serializeTimestamp(createdAt),
    updatedAt: serializeTimestamp(updatedAt),
    translations: translations?.map(trans => {
      // Extract values directly from the Timestamp to avoid any method issues
      let seconds: number;
      let nanoseconds: number;
      
      if (trans.updatedAt instanceof Timestamp) {
        seconds = trans.updatedAt.seconds;
        nanoseconds = trans.updatedAt.nanoseconds;
      } else if (trans.updatedAt && typeof trans.updatedAt === 'object' && 'toDate' in trans.updatedAt) {
        const tsWithToDate = trans.updatedAt as { toDate: () => Date };
        const date = tsWithToDate.toDate();
        seconds = Math.floor(date.getTime() / 1000);
        nanoseconds = (date.getTime() % 1000) * 1000000;
      } else if (trans.updatedAt && typeof trans.updatedAt === 'object' && 'seconds' in trans.updatedAt) {
        const ts = trans.updatedAt as { seconds: number | string; nanoseconds: number | string };
        seconds = Number(ts.seconds);
        nanoseconds = Number(ts.nanoseconds);
      } else {
        // Return plain object even when updatedAt is null
        const plainTrans: {
          languageCode: string;
          name: string;
          description?: string;
          updatedAt: null;
        } = {
          languageCode: String(trans.languageCode),
          name: String(trans.name),
          updatedAt: null,
        };
        if (trans.description !== undefined) {
          plainTrans.description = String(trans.description);
        }
        return JSON.parse(JSON.stringify(plainTrans));
      }
      
      // Create completely plain object with primitive values
      // Use JSON.parse(JSON.stringify()) to ensure no prototype methods are present
      const plainUpdatedAt = JSON.parse(JSON.stringify({
        seconds: Number(seconds),
        nanoseconds: Number(nanoseconds),
      }));
      
      const plainTrans: {
        languageCode: string;
        name: string;
        description?: string;
        updatedAt: { seconds: number; nanoseconds: number };
      } = {
        languageCode: String(trans.languageCode),
        name: String(trans.name),
        updatedAt: plainUpdatedAt,
      };
      
      if (trans.description !== undefined) {
        plainTrans.description = String(trans.description);
      }
      
      // Use JSON.parse(JSON.stringify()) to ensure completely plain object
      return JSON.parse(JSON.stringify(plainTrans));
    }) || undefined
  };
  
  return serialized;
};

type SerializedColor = Omit<Color, 'createdAt' | 'updatedAt' | 'translations'> & {
  createdAt?: SerializedTimestamp;
  updatedAt?: SerializedTimestamp;
  translations?: Array<{
    languageCode: string;
    name: string;
    updatedAt: SerializedTimestamp;
  }>;
};

const serializeColor = (color: Color & { createdAt?: Timestamp; updatedAt?: Timestamp }): SerializedColor => {
  const { translations, createdAt, updatedAt, ...rest } = color;
  
  // Ensure rest only contains plain primitive values (no nested objects with methods)
  const plainRest: Omit<Color, 'translations'> = {
    id: rest.id ? String(rest.id) : undefined,
    name: String(rest.name),
    hexCode: String(rest.hexCode),
  };
  
  const serialized: SerializedColor = {
    ...plainRest,
  };
  
  // Serialize timestamps if they exist
  if (createdAt) {
    serialized.createdAt = serializeTimestamp(createdAt);
  }
  if (updatedAt) {
    serialized.updatedAt = serializeTimestamp(updatedAt);
  }
  
  // Serialize translations
  if (translations && translations.length > 0) {
    serialized.translations = translations.map(trans => {
      const serializedUpdatedAt = serializeTimestamp(trans.updatedAt);
      // Always create a brand new plain object using primitive values directly
      const plainUpdatedAt = serializedUpdatedAt ? JSON.parse(JSON.stringify({
        seconds: Number(serializedUpdatedAt.seconds),
        nanoseconds: Number(serializedUpdatedAt.nanoseconds),
      })) : null;
      
      const plainTrans: {
        languageCode: string;
        name: string;
        updatedAt: { seconds: number; nanoseconds: number } | null;
      } = {
        languageCode: String(trans.languageCode),
        name: String(trans.name),
        updatedAt: plainUpdatedAt,
      };
      
      // Use JSON.parse(JSON.stringify()) to ensure completely plain object
      return JSON.parse(JSON.stringify(plainTrans));
    });
  }
  
  return serialized;
};

const ShopPage = async () => {
  let products: Product[] = [];
  let categories: Category[] = [];
  let brands: Brand[] = [];
  let collections: Collection[] = [];
  let colors: Color[] = [];
  let settings = null;
  
  try {
    const [fetchedProducts, fetchedCategories, fetchedBrands, fetchedCollections, fetchedColors, fetchedSettings] = await Promise.all([
      getAllProducts().catch(() => []),
      getAllCategories().catch(() => []),
      getAllBrands().catch(() => []),
      getAllCollections().catch(() => []),
      getColors().catch(() => []),
      getSettings().catch(() => null),
    ]);
    
    products = fetchedProducts;
    categories = fetchedCategories;
    brands = fetchedBrands;
    collections = fetchedCollections;
    colors = fetchedColors;
    settings = fetchedSettings;
  } catch (error) {
    // Handle permission errors gracefully during build/prerender
    // The client component will handle fetching data on the client side if needed
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient')) {
      // Permission denied - this is expected during build time
      // The page will still render and can fetch data on client side
      products = [];
      categories = [];
      brands = [];
      collections = [];
      colors = [];
      settings = null;
    } else {
      // Other errors - also handle gracefully
      products = [];
      categories = [];
      brands = [];
      collections = [];
      colors = [];
      settings = null;
    }
  }

  // Serialize all data to remove Timestamp objects
  const serializedProducts = products.map(serializeProduct);
  const serializedCategories = categories.map(serializeCategory);
  const serializedBrands = brands.map(serializeBrand);
  const serializedCollections = collections.map(serializeCollection);
  const serializedColors = colors.map(serializeColor);

  return (
    <Suspense fallback={<div>Loading shop...</div>}>
      <ShopClient 
        initialProducts={serializedProducts as Product[]} 
        categories={serializedCategories as Category[]} 
        brands={serializedBrands as Brand[]}
        collections={serializedCollections as Collection[]}
        colors={serializedColors as Color[]}
        initialSettings={settings}
      />
    </Suspense>
  );
};

export default ShopPage;
