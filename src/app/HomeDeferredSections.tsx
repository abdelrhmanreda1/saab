'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllCollections } from '@/lib/firestore/collections_db';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { getAllProductBundles } from '@/lib/firestore/product_bundles_db';
import { getAllReviews } from '@/lib/firestore/reviews_enhanced_db';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { addNewsletterSubscription } from '@/lib/firestore/newsletter_db';
import { getRecentlyViewed } from '@/lib/firestore/product_features_db';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import {
  defaultHomepageSections,
  HomepageSectionId,
} from '@/lib/firestore/homepage_sections';
import { Product } from '@/lib/firestore/products';
import { Category } from '@/lib/firestore/categories';
import { Collection } from '@/lib/firestore/collections';
import { FlashSale } from '@/lib/firestore/campaigns';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { BlogPost } from '@/lib/firestore/blog';
import type { Review } from '@/lib/firestore/reviews_enhanced';
import { generateSlug } from '@/lib/utils/slug';
import {
  getCategoryName,
  getCollectionDescription,
  getCollectionName,
  getProductName,
} from '@/lib/utils/translations';
import { getFlashSaleAdjustedPrice, getProductPricingSummary } from '@/lib/utils/product-pricing';
import { getSafeImageUrl } from '@/lib/utils/image';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

type SectionDataState = {
  featuredProducts: Product[];
  popularProducts: Product[];
  latestProducts: Product[];
  flashSaleProducts: Product[];
  categories: Category[];
  collections: Collection[];
  activeFlashSales: FlashSale[];
  activeBundles: ProductBundle[];
  testimonials: Review[];
  featuredBlogPosts: BlogPost[];
  recentlyViewedProducts: Product[];
};

const initialState: SectionDataState = {
  featuredProducts: [],
  popularProducts: [],
  latestProducts: [],
  flashSaleProducts: [],
  categories: [],
  collections: [],
  activeFlashSales: [],
  activeBundles: [],
  testimonials: [],
  featuredBlogPosts: [],
  recentlyViewedProducts: [],
};

export default function HomeDeferredSections() {
  const { t, currentLanguage } = useLanguage();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const { user, demoUser } = useAuth();
  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();
  const isArabic = languageCode === 'ar';
  const [data, setData] = useState<SectionDataState>(initialState);
  const [homepageSections, setHomepageSections] = useState(defaultHomepageSections);
  const [goldBasePrice, setGoldBasePrice] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          fetchedProducts,
          fetchedCategories,
          fetchedCollections,
          flashSales,
          fetchedBundles,
          fetchedHomepageSections,
        ] = await Promise.all([
          getAllProducts(),
          getAllCategories(),
          getAllCollections(),
          getAllFlashSales(true),
          settings?.features?.productBundles ? getAllProductBundles(true) : Promise.resolve([]),
          getHomepageSections().catch(() => defaultHomepageSections),
        ]);

        setHomepageSections(fetchedHomepageSections);

        const activeProducts = fetchedProducts
          .filter((product) => product.isActive)
          .map((product) => ({
            ...product,
            slug: product.slug || generateSlug(product.name || `product-${product.id}`),
          }));

        const now = new Date();
        const validFlashSales = flashSales.filter((sale) => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        });

        const flashSaleProductIds = new Set<string>();
        validFlashSales.forEach((sale) => {
          sale.productIds.forEach((id) => flashSaleProductIds.add(id));
        });

        const recentUserId = user?.uid || (settings?.demoMode && demoUser ? 'demo-user' : null);

        const [reviews, posts, recentlyViewedProducts] = await Promise.all([
          settings?.features?.productReviews ? getAllReviews(6, 4).catch(() => []) : Promise.resolve([]),
          settings?.features?.blog ? getAllPosts(true).catch(() => []) : Promise.resolve([]),
          recentUserId ? getRecentlyViewed(recentUserId, 8).catch(() => []) : Promise.resolve([]),
        ]);

        const validBundles = (fetchedBundles || []).filter((bundle) => {
          if (!bundle.isActive) return false;
          if (bundle.validFrom?.toDate && bundle.validFrom.toDate() > now) return false;
          if (bundle.validUntil?.toDate && bundle.validUntil.toDate() < now) return false;
          return true;
        });

        setData({
          featuredProducts: activeProducts.filter((product) => product.isFeatured).slice(0, 8),
          popularProducts: [...activeProducts]
            .sort(
              (a, b) =>
                (b.analytics?.views || 0) - (a.analytics?.views || 0) ||
                (b.analytics?.purchases || 0) - (a.analytics?.purchases || 0)
            )
            .slice(0, 8),
          latestProducts: [...activeProducts]
            .sort((a, b) => {
              const aDate = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const bDate = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return bDate - aDate;
            })
            .slice(0, 8),
          flashSaleProducts: activeProducts.filter((product) => flashSaleProductIds.has(product.id)).slice(0, 8),
          categories: fetchedCategories.filter((category) => !category.parentCategory),
          collections: fetchedCollections.filter((collection) => !collection.parentCollection),
          activeFlashSales: validFlashSales,
          activeBundles: validBundles.slice(0, 6),
          testimonials: reviews,
          featuredBlogPosts: posts.slice(0, 3),
          recentlyViewedProducts,
        });
      } catch {
        // Deferred homepage sections fail silently to keep above-the-fold fast.
      }
    };

    loadData();
  }, [
    settings?.demoMode,
    settings?.features?.blog,
    settings?.features?.productBundles,
    settings?.features?.productReviews,
    user,
    demoUser,
  ]);

  useEffect(() => {
    const fetchGoldPrice = async () => {
      try {
        const response = await fetch('/api/gold-price', { cache: 'no-store' });
        const result = await response.json();
        if (response.ok && result?.success && Number(result?.pricePerGram) > 0) {
          setGoldBasePrice(Number(result.pricePerGram));
          return;
        }
      } catch {
        // Fall through to settings cache.
      }

      const cachedPrice = Number(settings?.goldPricing?.cache?.pricePerGram || 0);
      if (cachedPrice > 0) {
        setGoldBasePrice(cachedPrice);
      }
    };

    fetchGoldPrice();
  }, [settings?.goldPricing?.cache?.pricePerGram]);

  const getHomepageSection = (id: HomepageSectionId) =>
    homepageSections.find((section) => section.id === id) ||
    defaultHomepageSections.find((section) => section.id === id);

  const isHomepageSectionEnabled = (id: HomepageSectionId) =>
    getHomepageSection(id)?.enabled ?? true;

  const getHomepageSectionOrder = (id: HomepageSectionId) =>
    getHomepageSection(id)?.order ?? 999;

  const getHomepageSectionLimit = (id: HomepageSectionId, fallbackLimit: number) => {
    const itemLimit = getHomepageSection(id)?.itemLimit;
    return typeof itemLimit === 'number' && itemLimit > 0 ? itemLimit : fallbackLimit;
  };

  const getHomepageSectionTitle = (id: HomepageSectionId, fallbackTitle: string) =>
    getHomepageSection(id)?.title?.trim() || fallbackTitle;

  const getHomepageSectionSubtitle = (id: HomepageSectionId, fallbackSubtitle: string) =>
    getHomepageSection(id)?.subtitle?.trim() || fallbackSubtitle;

  const handleNewsletterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newsletterEmail || newsletterLoading) return;

    setNewsletterLoading(true);
    try {
      await addNewsletterSubscription({
        email: newsletterEmail,
        source: 'homepage',
      });
      setNewsletterSuccess(true);
      setNewsletterEmail('');
      setTimeout(() => setNewsletterSuccess(false), 3000);
    } catch {
      // Ignore write failures in the lightweight deferred form.
    } finally {
      setNewsletterLoading(false);
    }
  };

  const ProductCard = ({
    product,
    flashSale,
  }: {
    product: Product;
    flashSale?: FlashSale | null;
  }) => {
    const matchedCategory = data.categories.find((category) => category.id === product.category);
    const pricing = getProductPricingSummary(product, settings?.goldPricing, settings?.goldPricing?.cache);
    const flashPricing = flashSale
      ? getFlashSaleAdjustedPrice(product, flashSale, settings?.goldPricing, settings?.goldPricing?.cache)
      : null;
    const finalPrice = flashPricing?.currentPrice ?? pricing.currentPrice;

    return (
      <Link
        href={`/products/${product.slug}`}
        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
          <Image
            src={getSafeImageUrl(product.images?.[0])}
            alt={getProductName(product, languageCode) || product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            quality={44}
            loading="lazy"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
            {matchedCategory ? getCategoryName(matchedCategory, languageCode) : t('product.collection') || 'Collection'}
          </p>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-gray-900">
            {getProductName(product, languageCode)}
          </h3>
          <div className="mt-3 flex items-center gap-2">
            {pricing.originalPrice !== null && pricing.originalPrice > finalPrice && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(pricing.originalPrice)}</span>
            )}
            <span className="text-base font-bold text-gray-900">{formatPrice(finalPrice)}</span>
          </div>
        </div>
      </Link>
    );
  };

  const SectionHeader = ({
    id,
    title,
    subtitle,
    href,
  }: {
    id: HomepageSectionId;
    title: string;
    subtitle: string;
    href?: string;
  }) => (
    <div className="mb-10 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-gray-900 leading-tight">
          {getHomepageSectionTitle(id, title)}
        </h2>
        <p className="mt-3 text-base md:text-lg text-gray-600">
          {getHomepageSectionSubtitle(id, subtitle)}
        </p>
      </div>
      {href && (
        <Link href={href} className="hidden md:inline-flex text-sm font-semibold text-gray-900 border-b border-gray-900">
          {t('home.view_all') || 'View All'} {isArabic ? '←' : '→'}
        </Link>
      )}
    </div>
  );

  const productGrid = (products: Product[], flashSale?: FlashSale | null, limit = 8) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
      {products.slice(0, limit).map((product) => (
        <ProductCard key={product.id} product={product} flashSale={flashSale} />
      ))}
    </div>
  );

  const activeFlashSale = data.activeFlashSales[0] || null;

  return (
    <>
      {isHomepageSectionEnabled('gold-prices') && goldBasePrice > 0 && (
        <section
          data-section-id="gold-prices"
          className="w-full bg-gradient-to-b from-[#fdf8ee] to-[#f5eedc] py-14 md:py-20"
          style={{ order: getHomepageSectionOrder('gold-prices') }}
        >
          <div className="page-container">
            <SectionHeader
              id="gold-prices"
              title={isArabic ? 'أسعار الذهب اليوم' : 'Today Gold Prices'}
              subtitle={isArabic ? 'تحديثات سريعة لأسعار جرام الذهب في السعودية' : 'Fast updates for gram prices in Saudi Arabia'}
              href="/gold-price"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '24K', multiplier: 1 },
                { label: '22K', multiplier: 22 / 24 },
                { label: '21K', multiplier: 21 / 24 },
                { label: '18K', multiplier: 18 / 24 },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#e8dcc0] bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8a7a5a]">{item.label}</p>
                  <p className="mt-3 text-2xl font-bold text-[#23190a]">
                    {formatPrice(goldBasePrice * item.multiplier)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('featured') && data.featuredProducts.length > 0 && (
        <section className="bg-white py-12 md:py-16" style={{ order: getHomepageSectionOrder('featured') }}>
          <div className="page-container">
            <SectionHeader
              id="featured"
              title={t('home.featured') || 'Featured Collection'}
              subtitle={t('home.featured_desc') || 'Curated picks just for you'}
              href="/shop"
            />
            {productGrid(data.featuredProducts, null, getHomepageSectionLimit('featured', 8))}
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('flash-sales') && activeFlashSale && data.flashSaleProducts.length > 0 && (
        <section className="bg-gradient-to-br from-red-50 via-white to-red-50 py-12 md:py-16" style={{ order: getHomepageSectionOrder('flash-sales') }}>
          <div className="page-container">
            <SectionHeader
              id="flash-sales"
              title={t('home.flash_sale') || 'Flash Sale'}
              subtitle={t('home.flash_sale_desc') || 'Limited-time offers on selected products'}
              href="/flash"
            />
            {productGrid(data.flashSaleProducts, activeFlashSale, getHomepageSectionLimit('flash-sales', 8))}
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('popular') && data.popularProducts.length > 0 && (
        <section className="bg-white py-12 md:py-16" style={{ order: getHomepageSectionOrder('popular') }}>
          <div className="page-container">
            <SectionHeader
              id="popular"
              title={t('home.popular_products') || 'Popular Right Now'}
              subtitle={t('home.popular_products_desc') || 'Most viewed and best-performing picks'}
              href="/shop"
            />
            {productGrid(data.popularProducts, null, getHomepageSectionLimit('popular', 8))}
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('categories') && data.categories.length > 0 && (
        <section className="bg-gray-50 py-12 md:py-16" style={{ order: getHomepageSectionOrder('categories') }}>
          <div className="page-container">
            <SectionHeader
              id="categories"
              title={t('home.categories') || 'Browse Categories'}
              subtitle={t('home.categories_desc') || 'Explore the store by collection type'}
              href="/categories"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {data.categories.slice(0, getHomepageSectionLimit('categories', 8)).map((category) => (
                <Link
                  key={category.id}
                  href={`/shop?category=${category.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    {category.imageUrl ? (
                      <Image
                        src={getSafeImageUrl(category.imageUrl)}
                        alt={getCategoryName(category, languageCode)}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        quality={40}
                        loading="lazy"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-gray-900">
                      {getCategoryName(category, languageCode)}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('latest') && data.latestProducts.length > 0 && (
        <section className="bg-white py-12 md:py-16" style={{ order: getHomepageSectionOrder('latest') }}>
          <div className="page-container">
            <SectionHeader
              id="latest"
              title={t('home.latest_products') || 'Latest Arrivals'}
              subtitle={t('home.latest_products_desc') || 'Fresh pieces added to the catalog'}
              href="/shop"
            />
            {productGrid(data.latestProducts, null, getHomepageSectionLimit('latest', 8))}
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('collections') && data.collections.length > 0 && (
        <section className="bg-gray-50 py-12 md:py-16" style={{ order: getHomepageSectionOrder('collections') }}>
          <div className="page-container">
            <SectionHeader
              id="collections"
              title={t('home.collections') || 'Collections'}
              subtitle={t('home.collections_desc') || 'Shop by our curated themes'}
              href="/shop"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {data.collections.slice(0, getHomepageSectionLimit('collections', 6)).map((collection) => (
                <Link
                  key={collection.id}
                  href={`/shop?collection=${collection.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {collection.imageUrl ? (
                      <Image
                        src={getSafeImageUrl(collection.imageUrl)}
                        alt={getCollectionName(collection, languageCode)}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        quality={40}
                        loading="lazy"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {getCollectionName(collection, languageCode)}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {getCollectionDescription(collection, languageCode)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('bundles') && settings?.features?.productBundles && data.activeBundles.length > 0 && (
        <section className="bg-white py-12 md:py-16" style={{ order: getHomepageSectionOrder('bundles') }}>
          <div className="page-container">
            <SectionHeader
              id="bundles"
              title={t('home.special_offers') || 'Bundle Offers'}
              subtitle={t('home.bundle_deals') || 'Exclusive bundle deals and offers'}
              href="/product-bundles"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {data.activeBundles.slice(0, getHomepageSectionLimit('bundles', 6)).map((bundle) => (
                <Link key={bundle.id} href={`/product-bundles/${bundle.id}`} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {bundle.image ? (
                      <Image
                        src={getSafeImageUrl(bundle.image)}
                        alt={bundle.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        quality={40}
                        loading="lazy"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-gray-900">{bundle.name}</h3>
                    {bundle.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{bundle.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('testimonials') && data.testimonials.length > 0 && (
        <section className="bg-gradient-to-b from-white via-gray-50 to-white py-12 md:py-16" style={{ order: getHomepageSectionOrder('testimonials') }}>
          <div className="page-container">
            <SectionHeader
              id="testimonials"
              title={t('home.testimonials_title') || 'What Our Customers Say'}
              subtitle={t('home.testimonials_subtitle') || 'Real reviews from real customers'}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.testimonials.slice(0, getHomepageSectionLimit('testimonials', 3)).map((review) => (
                <div key={review.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-1 text-yellow-400">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <svg key={index} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm leading-7 text-gray-700 line-clamp-5">{review.comment}</p>
                  <p className="mt-4 text-sm font-semibold text-gray-900">{review.userName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('newsletter') && (
        <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-black py-12 md:py-16" style={{ order: getHomepageSectionOrder('newsletter') }}>
          <div className="page-container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-white">
                {getHomepageSectionTitle('newsletter', t('home.newsletter_title') || 'Subscribe to Our Newsletter')}
              </h2>
              <p className="mt-4 text-lg text-gray-300">
                {getHomepageSectionSubtitle('newsletter', t('home.newsletter_subtitle') || 'Get exclusive offers and updates')}
              </p>
              <form onSubmit={handleNewsletterSubmit} className="mt-8 flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  placeholder={t('home.newsletter_placeholder') || 'Enter your email'}
                  required
                  className="flex-1 rounded-full px-6 py-4 text-gray-900"
                />
                <button
                  type="submit"
                  disabled={newsletterLoading}
                  className="rounded-full bg-white px-8 py-4 font-semibold text-black disabled:opacity-70"
                >
                  {newsletterLoading
                    ? t('home.newsletter_subscribing') || 'Subscribing...'
                    : t('home.newsletter_subscribe') || 'Subscribe'}
                </button>
              </form>
              {newsletterSuccess && (
                <p className="mt-4 text-green-400">{t('home.newsletter_success') || 'Thank you for subscribing!'}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('blog') && data.featuredBlogPosts.length > 0 && (
        <section className="bg-white py-12 md:py-16" style={{ order: getHomepageSectionOrder('blog') }}>
          <div className="page-container">
            <SectionHeader
              id="blog"
              title={t('home.blog_title') || 'Latest from Our Blog'}
              subtitle={t('home.blog_subtitle') || 'Fashion tips, style guides, and more'}
              href="/blog"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {data.featuredBlogPosts.slice(0, getHomepageSectionLimit('blog', 3)).map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {post.coverImage ? (
                      <Image
                        src={getSafeImageUrl(post.coverImage)}
                        alt={isArabic && post.title_ar ? post.title_ar : post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        quality={40}
                        loading="lazy"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                      {isArabic && post.title_ar ? post.title_ar : post.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                      {isArabic && post.excerpt_ar ? post.excerpt_ar : post.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHomepageSectionEnabled('recently-viewed') && data.recentlyViewedProducts.length > 0 && (
        <section className="bg-gray-50 py-12 md:py-16" style={{ order: getHomepageSectionOrder('recently-viewed') }}>
          <div className="page-container">
            <SectionHeader
              id="recently-viewed"
              title={t('home.recently_viewed') || 'Recently Viewed'}
              subtitle={t('home.recently_viewed_desc') || 'Continue browsing where you left off'}
            />
            {productGrid(data.recentlyViewedProducts, null, getHomepageSectionLimit('recently-viewed', 8))}
          </div>
        </section>
      )}
    </>
  );
}
