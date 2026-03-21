'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { useHomeCurrency, useHomeLanguage, useHomeSettings } from '@/app/(home)/home-context';
import HomeSectionViewportGate from './HomeSectionViewportGate';
import {
  defaultHomepageSections,
  HomepageSection,
  HomepageSectionId,
} from '@/lib/firestore/homepage_sections';
import { getSafeImageUrl } from '@/lib/utils/image';
import { getCollectionDescription, getCollectionName } from '@/lib/utils/translations';

const HomeNewsletterForm = dynamic(() => import('./HomeNewsletterForm'), { ssr: false });
const HomeTestimonialsCarousel = dynamic(() => import('./HomeTestimonialsCarousel'), {
  ssr: false,
});

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

export default function HomeDeferredSectionsBelowFold({
  collections,
  bundles,
  testimonials,
  posts,
  homepageSections,
}: {
  collections: SerializableCollection[];
  bundles: SerializableBundle[];
  testimonials: SerializableTestimonial[];
  posts: SerializablePost[];
  homepageSections: HomepageSection[];
}) {
  const { t, currentLanguage } = useHomeLanguage();
  const { formatPrice } = useHomeCurrency();
  const { settings } = useHomeSettings();
  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();
  const isArabic = languageCode === 'ar';

  const bundleItemLabel = useMemo(
    () => (count: number) =>
      isArabic
        ? `يشمل ${count} ${count === 1 ? 'منتج' : 'منتجات'}`
        : `Includes ${count} ${count === 1 ? 'item' : 'items'}`,
    [isArabic]
  );

  return (
    <>
      {isHomepageSectionEnabled(homepageSections, 'collections') && collections.length > 0 && (
        <section className="bg-[#fcfaf5] py-12 md:py-16">
          <div className="page-container">
            <div className="mb-10 text-center md:mb-12">
              <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                {getHomepageSectionTitle(homepageSections, 'collections', t('home.collections') || 'Our Collections')}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(
                  homepageSections,
                  'collections',
                  t('home.collections_desc') || 'Explore curated collections designed for you'
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {collections
                .slice(0, getHomepageSectionLimit(homepageSections, 'collections', 3))
                .map((collection) => {
                  const collectionImage = getSafeImageUrl(collection.imageUrl);
                  return (
                  <Link
                    key={collection.id}
                    href={`/shop?collection=${collection.slug || collection.id}`}
                    className="group relative h-64 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm transition-all hover:border-gray-300 hover:shadow-lg md:h-80"
                  >
                    {collectionImage ? (
                      <Image
                        src={collectionImage}
                        alt={getCollectionName(collection as never, languageCode)}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        quality={42}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                          className="h-16 w-16"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                      </div>
                    )}
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
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled(homepageSections, 'bundles') &&
        settings?.features?.productBundles &&
        bundles.length > 0 && (
          <section className="bg-white py-12 md:py-16">
            <div className="page-container">
              <div className="mb-10 text-center md:mb-12">
                <h2 className="mb-4 text-3xl font-heading font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl xl:text-6xl">
                  {getHomepageSectionTitle(
                    homepageSections,
                    'bundles',
                    t('home.special_offers') || 'Special Offers'
                  )}
                </h2>
                <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                  {getHomepageSectionSubtitle(
                    homepageSections,
                    'bundles',
                    t('home.bundle_deals') || 'Exclusive bundle deals and offers'
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
                {bundles
                  .slice(0, getHomepageSectionLimit(homepageSections, 'bundles', 6))
                  .map((bundle) => (
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
                            sizes="(max-width: 768px) 100vw, 33vw"
                            quality={42}
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
                          <p className="mb-1 text-xs text-gray-500">{bundleItemLabel(bundle.itemCount)}</p>
                          <div className="flex items-center gap-2">
                            {bundle.originalPrice > bundle.bundlePrice && (
                              <span className="text-sm text-gray-500 line-through">
                                {formatPrice(bundle.originalPrice)}
                              </span>
                            )}
                            <span className="text-xl font-heading font-bold text-gray-900">
                              {formatPrice(bundle.bundlePrice)}
                            </span>
                            {bundle.discountType === 'percentage' && bundle.discountValue ? (
                              <span className="text-sm font-medium text-red-600">
                                -{bundle.discountValue}%
                              </span>
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
                {getHomepageSectionTitle(
                  homepageSections,
                  'testimonials',
                  t('home.testimonials_title') || 'What Our Customers Say'
                )}
              </h2>
              <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                {getHomepageSectionSubtitle(
                  homepageSections,
                  'testimonials',
                  t('home.testimonials_subtitle') || 'Real reviews from real customers'
                )}
              </p>
            </div>
            <HomeSectionViewportGate minHeightClass="min-h-[280px]" enableIdleFallback={false}>
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
                  {getHomepageSectionTitle(
                    homepageSections,
                    'blog',
                    t('home.blog_title') || 'Latest from Our Blog'
                  )}
                </h2>
                <p className="text-base font-medium text-gray-600 md:text-lg lg:text-xl">
                  {getHomepageSectionSubtitle(
                    homepageSections,
                    'blog',
                    t('home.blog_subtitle') || 'Fashion tips, style guides, and more'
                  )}
                </p>
              </div>
              <Link
                href="/blog"
                className="hidden border-b-2 border-gray-900 pb-1 text-sm font-medium text-gray-900 transition-opacity hover:opacity-70 md:block"
              >
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
                        sizes="(max-width: 768px) 100vw, 33vw"
                        quality={42}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                          className="h-12 w-12"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
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
              <Link
                href="/blog"
                className="border-b-2 border-gray-900 pb-1 text-sm font-medium text-gray-900 transition-opacity hover:opacity-70"
              >
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
                {getHomepageSectionTitle(
                  homepageSections,
                  'newsletter',
                  t('home.newsletter_title') || 'Subscribe to Our Newsletter'
                )}
              </h2>
              <p className="mb-2 text-lg text-gray-300">
                {getHomepageSectionSubtitle(
                  homepageSections,
                  'newsletter',
                  t('home.newsletter_subtitle') || 'Get exclusive offers and updates'
                )}
              </p>
              <p className="mb-8 text-base font-semibold text-yellow-400 md:text-lg">
                {t('home.newsletter_discount') || 'Get 10% off your first order!'}
              </p>
              <HomeSectionViewportGate minHeightClass="min-h-[72px]" enableIdleFallback={false}>
                <HomeNewsletterForm />
              </HomeSectionViewportGate>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
