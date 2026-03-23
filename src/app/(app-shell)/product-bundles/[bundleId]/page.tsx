import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { getProductBundle } from '@/lib/firestore/product_bundles_db';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { getBaseUrl } from '@/lib/utils/url';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { Timestamp } from 'firebase/firestore';
import BundleClient from './BundleClient';

type BundlePageProps = {
  params: Promise<{ bundleId: string }>;
};

// Helper function to serialize Timestamp objects to plain objects
const serializeTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | { toDate: () => Date } | null | undefined): { seconds: number; nanoseconds: number } | null | undefined => {
  if (!timestamp) return timestamp;
  
  if (timestamp instanceof Timestamp) {
    return {
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds
    };
  }
  
  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000
    };
  }
  
  if (typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
    return timestamp as { seconds: number; nanoseconds: number };
  }
  
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

const serializeBundle = (bundle: ProductBundle | null): ProductBundle | null => {
  if (!bundle) return null;
  
  return {
    ...bundle,
    validFrom: bundle.validFrom ? serializeTimestamp(bundle.validFrom) : undefined,
    validUntil: bundle.validUntil ? serializeTimestamp(bundle.validUntil) : undefined,
    createdAt: serializeTimestamp(bundle.createdAt) as { seconds: number; nanoseconds: number },
    updatedAt: serializeTimestamp(bundle.updatedAt) as { seconds: number; nanoseconds: number },
  } as ProductBundle;
};

export async function generateMetadata({ params }: BundlePageProps): Promise<Metadata> {
  const { bundleId } = await params;
  let bundle = null;
  
  try {
    bundle = await getProductBundle(bundleId);
  } catch {
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `الباقة | ${companyName}`,
      description: `تعرّف على تفاصيل الباقة في ${companyName}.`,
    };
  }

  if (!bundle) {
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `الباقة غير موجودة | ${companyName}`,
      description: 'الباقة التي تبحث عنها غير موجودة.',
    };
  }

  const baseUrl = getBaseUrl();
  const bundleName = bundle.name;
  const bundleDescription = bundle.description || '';

  try {
    const [settings, seoSettings, pageSEO] = await Promise.all([
      getSettings(),
      getSEOSettings(),
      getPageSEO(`/product-bundles/${bundleId}`),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `${bundleName} | باقة من ${companyName}`,
      fallbackDescription: bundleDescription,
      fallbackImage: bundle.image,
      url: `${baseUrl}/product-bundles/${bundleId}`,
    });
  } catch {
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `${bundleName} | باقة من ${companyName}`,
      description: bundleDescription,
      openGraph: {
        title: `${bundleName} | باقة من ${companyName}`,
        description: bundleDescription,
        url: `${baseUrl}/product-bundles/${bundleId}`,
        ...(bundle.image && {
          images: [
            {
              url: bundle.image.startsWith('http') ? bundle.image : `${baseUrl}${bundle.image}`,
              width: 800,
              height: 600,
              alt: bundleName,
            },
          ],
        }),
      },
    };
  }
}

const BundleDetailPage = async ({ params }: BundlePageProps) => {
  const { bundleId } = await params;
  let bundle = null;
  
  try {
    bundle = await getProductBundle(bundleId);
  } catch (error: unknown) {
    const errorObj = error as { message?: string; code?: string };
    if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center max-w-md px-4">
            <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Access Restricted</h1>
            <p className="text-gray-500 mb-6">Unable to load bundle due to permissions. Please contact support if you believe this is an error.</p>
            <Link href="/product-bundles" className="inline-block bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
              Back to Bundles
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Product Bundle Not Found</h1>
          <p className="text-gray-500">The product bundle you are looking for does not exist or has been removed.</p>
          <Link href="/product-bundles" className="inline-block mt-4 bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
            Back to Bundles
          </Link>
        </div>
      </div>
    );
  }
  
  const serializedBundle = serializeBundle(bundle);

  if (!bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Product Bundle Not Found</h1>
          <p className="text-gray-500">The product bundle you are looking for does not exist or has been removed.</p>
          <Link href="/product-bundles" className="inline-block mt-4 bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
            Back to Bundles
          </Link>
        </div>
      </div>
    );
  }

  return <BundleClient bundle={serializedBundle} />;
};

export default BundleDetailPage;

