'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useHomeCurrency, useHomeLanguage, useHomeSettings } from '@/app/(home)/home-context';
import HomeSectionViewportGate from './HomeSectionViewportGate';
import {
  defaultHomepageSections,
  HomepageSection,
  HomepageSectionId,
} from '@/lib/firestore/homepage_sections';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';
import { getSafeImageUrl } from '@/lib/utils/image';
import {
  getCategoryName,
  getCollectionDescription,
  getCollectionName,
  getProductName,
} from '@/lib/utils/translations';

const HomeNewsletterForm = dynamic(() => import('./HomeNewsletterForm'), { ssr: false });
const HomeTestimonialsCarousel = dynamic(() => import('./HomeTestimonialsCarousel'), {
  ssr: false,
});

type ReviewStats = Record<string, { averageRating: number; reviewCount: number }>;

type SerializableProduct = {
  id: string;
  slug?: string;
  name: string;
  category?: string;
  images?: string[];
  isFeatured?: boolean;
  variants?: Array<{ stock?: number }>;
  analytics?: { purchases?: number };
  createdAt?: { seconds?: number; nanoseconds?: number } | string | null;
};

type SerializableCategory = {
  id: string;
  slug?: string;
  name: string;
  imageUrl?: string;
};

type SerializableCollection = {
  id: string;
  slug?: string;
  name: string;
  imageUrl?: string;
};

type SerializableBundle = {
  id: string;
  name: string;
  description?: string;
  image?: string;
  originalPrice: number;
  bundlePrice: number;
  itemCount: number;
  discountType?: string;
  discountValue?: number;
};

type SerializablePost = {
  id: string;
  slug: string;
  title: string;
  title_ar?: string;
  excerpt?: string;
  excerpt_ar?: string;
  coverImage?: string;
};

type SerializableTestimonial = {
  id: string;
  userName: string;
  comment: string;
  rating: number;
  verifiedPurchase: boolean;
};

function timestampToMs(value: SerializableProduct['createdAt']) {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const seconds = Number(value.seconds || 0);
  const nanoseconds = Number(value.nanoseconds || 0);
  return seconds * 1000 + nanoseconds / 1_000_000;
}

function getHomepageSection(homepageSections: HomepageSection[], id: HomepageSectionId) {
  return (
    homepageSections.find((section) => section.id === id) ||
    defaultHomepageSections.find((section) => section.id === id)
  );
}

function isHomepageSectionEnabled(homepageSections: HomepageSection[], id: HomepageSectionId) {
  return getHomepageSection(homepageSections, id)?.enabled ?? true;
}

function getHomepageSectionTitle(
  homepageSections: HomepageSection[],
  id: HomepageSectionId,
  fallbackTitle: string
) {
  return getHomepageSection(homepageSections, id)?.title?.trim() || fallbackTitle;
}

function getHomepageSectionSubtitle(
  homepageSections: HomepageSection[],
  id: HomepageSectionId,
  fallbackSubtitle: string
) {
  return getHomepageSection(homepageSections, id)?.subtitle?.trim() || fallbackSubtitle;
}

function getHomepageSectionLimit(
  homepageSections: HomepageSection[],
  id: HomepageSectionId,
  fallbackLimit: number
) {
  const limit = getHomepageSection(homepageSections, id)?.itemLimit;
  return typeof limit === 'number' && limit > 0 ? limit : fallbackLimit;
}

function ProductCard({
  product,
  reviewStats,
  categoryName,
}: {
  product: SerializableProduct;
  reviewStats?: { averageRating: number; reviewCount: number };
  categoryName?: string;
}) {
  const { t, currentLanguage } = useHomeLanguage();
  const { formatPrice } = useHomeCurrency();
  const { settings } = useHomeSettings();
  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();

  const totalStock = Array.isArray(product.variants)
    ? product.variants.reduce((sum, variant) => sum + Number(variant?.stock || 0), 0)
    : 0;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const hasPositiveVariantStock = hasVariants && product.variants!.some((variant) => Number(variant?.stock || 0) > 0);
  const stockInfo =
    totalStock > 0 && totalStock <= 10
      ? { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', color: 'bg-yellow-500' }
      : hasPositiveVariantStock
        ? { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'bg-green-500' }
        : null;
  const createdAtMs = timestampToMs(product.createdAt);
  const isNew = createdAtMs > 0 && Date.now() - createdAtMs < 30 * 24 * 60 * 60 * 1000;
  const pricing = getProductPricingSummary(
    product as never,
    settings?.goldPricing,
    settings?.goldPricing?.cache
  );
  const isOnSale = pricing.hasDiscount;
  const isBestSeller = Number(product.analytics?.purchases || 0) > 50;
  const displayImage = getSafeImageUrl(product.images?.[0]);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-xl">
      <Link
        href={`/products/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={t('home.view_product', {
          name: getProductName(product as never, languageCode),
        })}
      />

      <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
        {isNew && (
          <span className="rounded bg-blue-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {t('product.badge_new') || 'New'}
          </span>
        )}
        {isOnSale && (
          <span className="rounded bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {t('product.badge_sale') || 'Sale'}
          </span>
        )}
        {isBestSeller && (
          <span className="rounded bg-purple-700 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {t('product.badge_best_seller') || 'Best Seller'}
          </span>
        )}
      </div>

      {stockInfo && stockInfo.status !== 'in_stock' && (
        <div className="absolute right-3 top-3 z-20">
          <span className={`${stockInfo.color} rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white`}>
            {stockInfo.text}
          </span>
        </div>
      )}

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-50">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={getProductName(product as never, languageCode) || 'Product'}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
            quality={45}
            loading="lazy"
            className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="h-12 w-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4">
        {categoryName && (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#9f7424]">{categoryName}</p>
        )}
        <h3 className="truncate text-sm font-medium text-gray-900 md:text-base">
          {getProductName(product as never, languageCode)}
        </h3>
        <div className="mt-1">
          {reviewStats && reviewStats.reviewCount > 0 ? (
            <div className="flex items-center gap-1">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, index) => {
                  const roundedRating = Math.round(reviewStats.averageRating || 0);
                  return (
                    <svg
                      key={index}
                      className={`h-3 w-3 md:h-4 md:w-4 ${index < roundedRating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                    </svg>
                  );
                })}
              </div>
              <span className="text-xs text-gray-500">({reviewStats.reviewCount})</span>
            </div>
          ) : (
            <div className="h-5" />
          )}
        </div>
        <div className="mt-3 flex flex-col">
          {pricing.hasDiscount && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(pricing.originalPrice ?? 0)}</span>
          )}
          <span className="text-sm font-semibold text-gray-900 md:text-base">{formatPrice(pricing.currentPrice ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

export default function HomeDeferredSectionsClient({
  featuredProducts,
  flashSaleProducts,
  categories,
  allCategories,
  collections,
  bundles,
  testimonials,
  posts,
  reviewStats,
  homepageSections,
}: {
  featuredProducts: SerializableProduct[];
  flashSaleProducts: SerializableProduct[];
  categories: SerializableCategory[];
  allCategories: SerializableCategory[];
  collections: SerializableCollection[];
  bundles: SerializableBundle[];
  testimonials: SerializableTestimonial[];
  posts: SerializablePost[];
  reviewStats: ReviewStats;
  homepageSections: HomepageSection[];
}) {
  const { t, currentLanguage } = useHomeLanguage();
  const { formatPrice } = useHomeCurrency();
  const { settings } = useHomeSettings();
  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();
  const isArabic = languageCode === 'ar';
  const categoryMap = useMemo(
    () => new Map(allCategories.map((category) => [category.id, category])),
    [allCategories]
  );

  return (
    <div className="min-h-screen pb-20">
      {isHomepageSectionEnabled(homepageSections, 'trust-badges') && (
        <section className="w-full border-b border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50 py-16 md:py-20">
          <div className="page-container">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
              {[
                {
                  title: t('home.trust_free_shipping') || 'Free Shipping',
                  description: t('home.trust_free_shipping_desc') || 'On orders over $100',
                  iconBg: 'bg-blue-100',
                  iconColor: 'text-orange-700',
                  path: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m16.5 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
                },
                {
                  title: t('home.trust_secure_payment') || 'Secure Payment',
                  description: t('home.trust_secure_payment_desc') || '100% secure checkout',
                  iconBg: 'bg-green-100',
                  iconColor: 'text-green-700',
                  path: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
                },
                {
                  title: t('home.trust_authentic') || 'Authentic Products',
                  description: t('home.trust_authentic_desc') || '100% genuine items',
                  iconBg: 'bg-purple-100',
                  iconColor: 'text-purple-700',
                  path: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
                },
                {
                  title: t('home.trust_easy_returns') || 'Easy Returns',
                  description: t('home.trust_easy_returns_desc') || '30-day return policy',
                  iconBg: 'bg-orange-100',
                  iconColor: 'text-gray-700',
                  path: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.228a46.865 46.865 0 00-12.12 0m12.12 0a46.866 46.866 0 01-12.12 0',
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm md:flex-row md:text-left">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full md:h-14 md:w-14 ${item.iconBg}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`h-6 w-6 md:h-7 md:w-7 ${item.iconColor}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
                    </svg>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-semibold text-gray-900 md:text-base">{item.title}</p>
                    <p className="text-xs text-gray-600 md:text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'featured') && featuredProducts.length > 0 && (
        <section className="bg-white py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'featured', t('home.featured') || 'Featured Collection')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(homepageSections, 'featured', t('home.featured_desc') || 'Curated picks just for you')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
              {featuredProducts.slice(0, getHomepageSectionLimit(homepageSections, 'featured', 8)).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  reviewStats={reviewStats[product.id]}
                  categoryName={product.category ? getCategoryName(categoryMap.get(product.category) as never, languageCode) : undefined}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'categories') && categories.length > 0 && (
        <section className="bg-white py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'categories', t('home.shop_by_category') || 'Shop by Category')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(homepageSections, 'categories', t('home.shop_by_category_desc') || 'Browse by your favorite categories')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
              {categories.slice(0, getHomepageSectionLimit(homepageSections, 'categories', 8)).map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug || category.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-lg"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={getSafeImageUrl(category.imageUrl)}
                      alt={getCategoryName(category as never, languageCode)}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      quality={45}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-center text-base font-semibold text-gray-900 md:text-xl">
                      {getCategoryName(category as never, languageCode)}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'flash-sales') && flashSaleProducts.length > 0 && (
        <section className="bg-[#fcfaf5] py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'flash-sales', t('home.flash_sale') || 'Flash Sale')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(homepageSections, 'flash-sales', t('home.flash_sale_desc') || 'Limited time offers - grab them before they are gone')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
              {flashSaleProducts.slice(0, getHomepageSectionLimit(homepageSections, 'flash-sales', 8)).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  reviewStats={reviewStats[product.id]}
                  categoryName={product.category ? getCategoryName(categoryMap.get(product.category) as never, languageCode) : undefined}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'collections') && collections.length > 0 && (
        <section className="bg-[#fcfaf5] py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'collections', t('home.collections') || 'Our Collections')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(homepageSections, 'collections', t('home.collections_desc') || 'Explore curated collections designed for you')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {collections.slice(0, getHomepageSectionLimit(homepageSections, 'collections', 3)).map((collection) => (
                <Link
                  key={collection.id}
                  href={`/shop?collection=${collection.slug || collection.id}`}
                  className="group relative h-64 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm transition-all hover:border-gray-300 hover:shadow-lg md:h-80"
                >
                  <Image
                    src={getSafeImageUrl(collection.imageUrl)}
                    alt={getCollectionName(collection as never, languageCode)}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    quality={45}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-6">
                    <h3 className="mb-2 text-xl font-heading font-bold text-white md:text-2xl">
                      {getCollectionName(collection as never, languageCode)}
                    </h3>
                    {getCollectionDescription(collection as never, languageCode) && (
                      <p className="line-clamp-2 text-sm text-white/90">
                        {getCollectionDescription(collection as never, languageCode)}
                      </p>
                    )}
                    <span className="mt-3 inline-block border-b border-white/50 pb-1 text-sm font-medium text-white transition-colors group-hover:border-white">
                      {t('home.explore_collection') || 'Explore Collection'} {isArabic ? '←' : '→'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'bundles') && settings?.features?.productBundles && bundles.length > 0 && (
        <section className="bg-white py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'bundles', t('home.special_offers') || 'Special Offers')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(homepageSections, 'bundles', t('home.bundle_deals') || 'Exclusive bundle deals and offers')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
              {bundles.slice(0, getHomepageSectionLimit(homepageSections, 'bundles', 6)).map((bundle) => (
                <Link
                  key={bundle.id}
                  href={`/product-bundles/${bundle.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-lg"
                >
                  {bundle.image ? (
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={getSafeImageUrl(bundle.image)}
                        alt={bundle.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        quality={45}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="relative flex h-48 w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-sm text-gray-400">No Image</span>
                    </div>
                  )}
                  <div className="p-6">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="flex-1 text-xl font-heading font-bold text-gray-900 transition-colors group-hover:text-gray-600">
                        {bundle.name}
                      </h3>
                      <span className="ml-2 rounded bg-red-600 px-2 py-1 text-xs font-bold uppercase text-white">
                        Bundle
                      </span>
                    </div>
                    {bundle.description && (
                      <p className="mb-4 line-clamp-2 text-sm text-gray-600">{bundle.description}</p>
                    )}
                    <div className="mb-4">
                      <p className="mb-1 text-xs text-gray-500">
                        {isArabic ? `يشمل ${bundle.itemCount} ${bundle.itemCount === 1 ? 'منتج' : 'منتجات'}` : `Includes ${bundle.itemCount} ${bundle.itemCount === 1 ? 'item' : 'items'}`}
                      </p>
                      <div className="flex items-center gap-2">
                        {bundle.originalPrice > bundle.bundlePrice && (
                          <span className="text-sm text-gray-500 line-through">{formatPrice(bundle.originalPrice)}</span>
                        )}
                        <span className="text-xl font-heading font-bold text-gray-900">{formatPrice(bundle.bundlePrice)}</span>
                        {bundle.discountType === 'percentage' && bundle.discountValue ? (
                          <span className="text-sm font-medium text-red-600">-{bundle.discountValue}%</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center text-sm font-medium text-gray-900 transition-colors group-hover:text-gray-600">
                      {t('home.view_bundle') || 'View Bundle'} {isArabic ? '←' : '→'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'testimonials') && testimonials.length > 0 && (
        <section className="w-full bg-gradient-to-b from-white via-gray-50 to-white py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'testimonials', t('home.testimonials_title') || 'What Our Customers Say')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(homepageSections, 'testimonials', t('home.testimonials_subtitle') || 'Real reviews from real customers')}
              </p>
            </div>
            <HomeSectionViewportGate minHeightClass="min-h-[280px]">
              <HomeTestimonialsCarousel testimonials={testimonials} />
            </HomeSectionViewportGate>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'blog') && posts.length > 0 && (
        <section className="bg-white py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 flex items-end justify-between md:mb-12">
              <div>
                <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                  {getHomepageSectionTitle(homepageSections, 'blog', t('home.blog_title') || 'Latest from Our Blog')}
                </h2>
                <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                  {getHomepageSectionSubtitle(homepageSections, 'blog', t('home.blog_subtitle') || 'Fashion tips, style guides, and more')}
                </p>
              </div>
              <Link href="/blog" className="hidden border-b-2 border-gray-900 pb-1 text-sm font-medium text-gray-900 transition-opacity hover:opacity-70 md:block">
                {t('home.view_all_blog') || 'View All'} {isArabic ? '←' : '→'}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {posts.slice(0, getHomepageSectionLimit(homepageSections, 'blog', 3)).map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-lg"
                >
                  <div className="relative h-48 w-full flex-shrink-0 overflow-hidden bg-gray-100">
                    {post.coverImage ? (
                      <Image
                        src={getSafeImageUrl(post.coverImage)}
                        alt={isArabic && post.title_ar ? post.title_ar : post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        quality={45}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="h-12 w-12">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-grow flex-col p-6">
                    <h3 className="mb-2 line-clamp-2 text-xl font-heading font-bold text-gray-900 transition-colors group-hover:text-gray-600">
                      {isArabic && post.title_ar ? post.title_ar : post.title}
                    </h3>
                    <p className="mb-4 line-clamp-3 flex-grow text-sm text-gray-600">
                      {isArabic && post.excerpt_ar ? post.excerpt_ar : post.excerpt}
                    </p>
                    <div className="mt-auto flex items-center text-sm font-medium text-gray-900 transition-colors group-hover:text-gray-600">
                      {t('home.read_more') || 'Read More'} {isArabic ? '←' : '→'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-10 text-center md:hidden">
              <Link href="/blog" className="border-b-2 border-gray-900 pb-1 text-sm font-medium text-gray-900 transition-opacity hover:opacity-70">
                {t('home.view_all_blog') || 'View All'} {isArabic ? '←' : '→'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'newsletter') && (
        <section className="w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black py-12 md:py-16">
          <div className="page-container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="mb-5 text-3xl font-heading font-bold leading-tight text-white md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'newsletter', t('home.newsletter_title') || 'Subscribe to Our Newsletter')}
              </h2>
              <p className="mb-2 text-lg text-gray-300">
                {getHomepageSectionSubtitle(homepageSections, 'newsletter', t('home.newsletter_subtitle') || 'Get exclusive offers and updates')}
              </p>
              <p className="mb-8 text-base font-semibold text-yellow-400 md:text-lg">
                {t('home.newsletter_discount') || 'Get 10% off your first order!'}
              </p>
              <HomeSectionViewportGate minHeightClass="min-h-[72px]">
                <HomeNewsletterForm />
              </HomeSectionViewportGate>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
