import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { getProductBySlug } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { getBaseUrl } from '@/lib/utils/url';
import ProductClient, { SerializedProduct } from '@/app/products/[productId]/ProductClient';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getProductSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { Timestamp } from 'firebase/firestore';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FlashSale } from '@/lib/firestore/campaigns';

type FlashProductPageProps = {
  params: Promise<{ productId: string }>;
};

// Helper function to serialize Timestamp objects to plain objects
const serializeTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | { toDate: () => Date } | null | undefined): { seconds: number; nanoseconds: number } | null | undefined => {
  if (!timestamp) return timestamp;
  
  // Convert Timestamp to plain object
  if (timestamp instanceof Timestamp) {
    return {
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds
    };
  }
  
  // Handle Firestore Timestamp with toDate method
  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000
    };
  }
  
  // If it's already a plain object with seconds and nanoseconds, return as-is
  if (typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
    return timestamp as { seconds: number; nanoseconds: number };
  }
  
  // Fallback: try to extract seconds/nanoseconds if present
  if (typeof timestamp === 'object' && timestamp !== null) {
    const ts = timestamp as { seconds?: number; nanoseconds?: number };
    if (typeof ts.seconds === 'number' && typeof ts.nanoseconds === 'number') {
      return {
        seconds: ts.seconds,
        nanoseconds: ts.nanoseconds
      };
    }
  }
  
  return null;
};

const serializeProduct = (product: Product | null): SerializedProduct | null => {
  if (!product) return null;
  
  // Convert all Timestamp fields to plain objects
  const serialized: Omit<Product, 'createdAt' | 'updatedAt' | 'preOrderExpectedDate' | 'analytics' | 'translations'> & {
    createdAt: { seconds: number; nanoseconds: number } | null;
    updatedAt: { seconds: number; nanoseconds: number } | null;
    preOrderExpectedDate?: { seconds: number; nanoseconds: number } | null | undefined;
    analytics?: Omit<Product['analytics'], 'lastViewed'> & {
      lastViewed?: { seconds: number; nanoseconds: number } | null | undefined;
    } | undefined;
    translations?: Array<Omit<NonNullable<Product['translations']>[number], 'updatedAt'> & {
      updatedAt: { seconds: number; nanoseconds: number };
    }>;
  } = {
    ...product,
    createdAt: product.createdAt ? (serializeTimestamp(product.createdAt) ?? null) : null,
    updatedAt: product.updatedAt ? (serializeTimestamp(product.updatedAt) ?? null) : null,
    preOrderExpectedDate: product.preOrderExpectedDate ? serializeTimestamp(product.preOrderExpectedDate) : undefined,
  };

  // Serialize translations array if it exists
  if (product.translations && Array.isArray(product.translations)) {
    serialized.translations = product.translations.map(translation => ({
      ...translation,
      updatedAt: serializeTimestamp(translation.updatedAt) as { seconds: number; nanoseconds: number },
    }));
  }

  // Serialize analytics if it exists
  if (product.analytics) {
    const { lastViewed, ...analyticsWithoutLastViewed } = product.analytics;
    serialized.analytics = {
      ...analyticsWithoutLastViewed,
      lastViewed: lastViewed ? serializeTimestamp(lastViewed) : null
    } as SerializedProduct['analytics'];
  }

  return serialized as SerializedProduct;
};

export async function generateMetadata({ params }: FlashProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  let product = null;
  
  try {
    product = await getProductBySlug(productId);
  } catch {
    // Failed to fetch product for metadata
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `Flash Sale Product | ${companyName}`,
      description: `View flash sale product details on ${companyName}.`,
    };
  }

  if (!product) {
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `Flash Sale Product Not Found | ${companyName}`,
      description: 'The flash sale product you are looking for does not exist.',
    };
  }

  const baseUrl = getBaseUrl();
  const productName = product.name;
  const productDescription = product.description;
  const productImages = product.images || [];

  try {
    const [settings, seoSettings, productSEO] = await Promise.all([
      getSettings(),
      getSEOSettings(),
      getProductSEO(product.id),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      productSEO,
      fallbackTitle: productName,
      fallbackDescription: productDescription || `View flash sale details for ${productName} on ${companyName}.`,
      url: `${baseUrl}/flash/products/${productId}`,
      productName,
      productDescription,
      productImages,
      openGraphType: 'website',
      fallbackTitlePriority: 'high',
      fallbackDescriptionPriority: 'high',
    });
  } catch {
    // Failed to generate product metadata
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: productName,
      description: productDescription || `View flash sale details for ${productName} on ${companyName}.`,
      openGraph: {
        title: productName,
        description: productDescription || `View flash sale details for ${productName} on ${companyName}.`,
        url: `${baseUrl}/flash/products/${productId}`,
        type: 'website',
        siteName: companyName || 'Pardah',
        ...(productImages.length > 0 && {
          images: [
            {
              url: productImages[0].startsWith('http') ? productImages[0] : `${baseUrl}${productImages[0]}`,
              width: 1200,
              height: 630,
              alt: productName,
            },
          ],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title: productName,
        description: productDescription || `View flash sale details for ${productName} on ${companyName}.`,
        ...(productImages.length > 0 && {
          images: [productImages[0].startsWith('http') ? productImages[0] : `${baseUrl}${productImages[0]}`],
        }),
      },
    };
  }
}

const FlashProductDetailPage = async ({ params }: FlashProductPageProps) => {
  const { productId } = await params;
  let product: Product | null = null;
  let activeFlashSales: FlashSale[] = [];
  
  try {
    product = await getProductBySlug(productId);
    const flashSales = await getAllFlashSales(true);
    const now = new Date();
    activeFlashSales = flashSales.filter(sale => {
      if (!sale.isActive) return false;
      const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
      const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
      return now >= startTime && now <= endTime && sale.productIds.includes(product?.id || '');
    });
  } catch (error: unknown) {
    // Failed to fetch product
    const errorObj = error as { message?: string; code?: string };
    if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center max-w-md px-4">
            <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Access Restricted</h1>
            <p className="text-gray-500 mb-6">Unable to load product due to permissions. Please contact support if you believe this is an error.</p>
            <Link href="/flash" className="inline-block bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
              Back to Flash Sale
            </Link>
          </div>
        </div>
      );
    }
    // For other errors, show product not found
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Flash Sale Product Not Found</h1>
          <p className="text-gray-500">The flash sale product you are looking for does not exist or has been removed.</p>
          <Link href="/flash" className="inline-block mt-4 bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
            Back to Flash Sale
          </Link>
        </div>
      </div>
    );
  }
  
  const serializedProduct = serializeProduct(product);
  const serializedFlashSales = activeFlashSales.map(sale => ({
    ...sale,
    startTime: serializeTimestamp(sale.startTime),
    endTime: serializeTimestamp(sale.endTime),
    createdAt: serializeTimestamp(sale.createdAt),
    updatedAt: serializeTimestamp(sale.updatedAt),
  })) as FlashSale[];

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Flash Sale Product Not Found</h1>
          <p className="text-gray-500">The flash sale product you are looking for does not exist or has been removed.</p>
          <Link href="/flash" className="inline-block mt-4 bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
            Back to Flash Sale
          </Link>
        </div>
      </div>
    );
  }

  return <ProductClient product={serializedProduct} productId={product.id} isFlashSalePage={true} flashSales={serializedFlashSales} />;
};

export default FlashProductDetailPage;

