'use client';

import React, { useEffect, useState } from 'react';
import Image from "next/image";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { Banner } from '@/lib/firestore/banners';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllCollections } from '@/lib/firestore/collections_db';
import { Product } from '@/lib/firestore/products';
import { Category } from '@/lib/firestore/categories';
import { Collection } from '@/lib/firestore/collections';
import { generateSlug } from '@/lib/utils/slug';
import { useLanguage } from '../context/LanguageContext';
import { getProductName, getCategoryName, getCollectionDescription, getCollectionName } from '@/lib/utils/translations';
import { useCurrency } from '../context/CurrencyContext';
import { useSettings } from '../context/SettingsContext';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FlashSale } from '@/lib/firestore/campaigns';
import { getAllProductBundles } from '@/lib/firestore/product_bundles_db';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { getReviewsByProductId, getAllReviews } from '@/lib/firestore/reviews_enhanced_db';
import type { Review } from '@/lib/firestore/reviews_enhanced';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { BlogPost } from '@/lib/firestore/blog';
import { addNewsletterSubscription } from '@/lib/firestore/newsletter_db';
import SkeletonLoader from '../components/SkeletonLoader';
import { getRecentlyViewed } from '@/lib/firestore/product_features_db';
import { useAuth } from '../context/AuthContext';
import { getFlashSaleAdjustedPrice, getProductPricingSummary } from '@/lib/utils/product-pricing';
import { getSafeImageUrl } from '@/lib/utils/image';
import {
  defaultHomepageSections,
  HomepageSectionId,
} from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';

const CountdownTimer = dynamic(() => import('../components/CountdownTimer'), { ssr: false });

const runWhenIdle = (task: () => void) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const idleWindow = window as Window & {
      requestIdleCallback: (callback: IdleRequestCallback) => number;
    };
    idleWindow.requestIdleCallback(() => task());
    return;
  }

  setTimeout(task, 0);
};

export default function Home() {
  const { t, currentLanguage } = useLanguage();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();
  const isArabic = languageCode === 'ar';
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [latestProducts, setLatestProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeBundles, setActiveBundles] = useState<ProductBundle[]>([]);
  const [reviewStats, setReviewStats] = useState<Record<string, { averageRating: number; reviewCount: number }>>({});
  const [testimonials, setTestimonials] = useState<Review[]>([]);
  const [featuredBlogPosts, setFeaturedBlogPosts] = useState<BlogPost[]>([]);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<Product[]>([]);
  const [goldBasePrice, setGoldBasePrice] = useState(0);
  const [goldPriceFetchedAt, setGoldPriceFetchedAt] = useState('');
  const [homepageSections, setHomepageSections] = useState(defaultHomepageSections);
  const [showDeferredSections] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatKaratLabel = (karat: string) => {
    if (!isArabic) return karat;
    const match = String(karat).match(/^(\d{2})K$/i);
    return match ? `${t('gold_price.karat_prefix') || 'عيار'} ${match[1]}` : karat;
  };

  const getBannerText = React.useCallback(
    (banner: Banner | undefined, field: 'title' | 'subtitle') => {
      if (!banner) return '';
      const normalize = (code?: string | null) => String(code || '').trim().toLowerCase();
      const tr = (banner.translations || []).find(tl => normalize(tl.languageCode) === normalize(languageCode));
      const candidate = String((tr && tr[field]) || '');
      if (candidate.trim()) return candidate;
      // Back-compat fallback to root fields (stored as English)
      return String(banner[field] || '');
    },
    [languageCode]
  );
  const { user, demoUser } = useAuth();

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setCurrentBannerIndex((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
      }, 5000);
    }, 12000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [banners.length]);

  useEffect(() => {
    const fetchGoldPrice = async () => {
      try {
        const response = await fetch('/api/gold-price', { cache: 'no-store' });
        const result = await response.json();

        if (response.ok && result?.success && Number(result?.pricePerGram) > 0) {
          setGoldBasePrice(Number(result.pricePerGram));
          setGoldPriceFetchedAt(result.fetchedAt || '');
          return;
        }
      } catch {
        // Failed to fetch gold price
      }

      const cachedPrice = Number(settings?.goldPricing?.cache?.pricePerGram || 0);
      if (cachedPrice > 0) {
        setGoldBasePrice(cachedPrice);
        setGoldPriceFetchedAt(settings?.goldPricing?.cache?.fetchedAt || '');
      }
    };

    fetchGoldPrice();
  }, [settings?.goldPricing?.cache?.fetchedAt, settings?.goldPricing?.cache?.pricePerGram]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          fetchedBanners,
          fetchedProducts,
          fetchedCategories,
          flashSales,
          fetchedCollections,
          fetchedBundles,
          fetchedHomepageSections,
        ] = await Promise.all([
          getAllBanners(),
          getAllProducts(),
          getAllCategories(),
          getAllFlashSales(true),
          getAllCollections(),
          settings?.features?.productBundles ? getAllProductBundles(true) : Promise.resolve([]),
          getHomepageSections().catch(() => defaultHomepageSections),
        ]);
        setHomepageSections(fetchedHomepageSections);
        
        // Banners - filter by device type and sort by order
        const sortedBanners = fetchedBanners
          .filter(b => {
            if (!b.isActive) return false;
            if (b.deviceType === 'both') return true;
            if (isMobile && b.deviceType === 'mobile') return true;
            if (!isMobile && b.deviceType === 'desktop') return true;
            return false;
          })
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setBanners(sortedBanners);

        // Products - ensure all have slugs
        const activeProducts = fetchedProducts
          .filter(p => p.isActive)
          .map(p => ({
            ...p,
            slug: p.slug || generateSlug(p.name || `product-${p.id}`)
          }));
        
        // Featured Products
        setFeaturedProducts(activeProducts.filter(p => p.isFeatured).slice(0, 8));
        
        // Popular Products - Sort by views (analytics.views) or purchases, fallback to featured
        const popular = [...activeProducts].sort((a, b) => {
          const aViews = a.analytics?.views || 0;
          const bViews = b.analytics?.views || 0;
          const aPurchases = a.analytics?.purchases || 0;
          const bPurchases = b.analytics?.purchases || 0;
          // Sort by views first, then by purchases
          if (bViews !== aViews) return bViews - aViews;
          return bPurchases - aPurchases;
        }).slice(0, 8);
        setPopularProducts(popular);
        
        // Latest Products - Sort by createdAt (newest first)
        const latest = [...activeProducts].sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bDate - aDate;
        }).slice(0, 8);
        setLatestProducts(latest);

        // Categories - get only top-level categories for homepage
        const topLevelCategories = fetchedCategories.filter(c => !c.parentCategory);
        setCategories(topLevelCategories);

        // Collections - get only top-level collections (no parent)
        const topLevelCollections = fetchedCollections.filter(c => !c.parentCollection);
        setCollections(topLevelCollections);

        // Flash Sales - filter by current time
        const now = new Date();
        const validFlashSales = flashSales.filter(sale => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        });
        setActiveFlashSales(validFlashSales);
        
        // Get Flash Sale products
        if (validFlashSales.length > 0) {
          const flashSaleProductIds = new Set<string>();
          validFlashSales.forEach(sale => {
            sale.productIds.forEach(id => flashSaleProductIds.add(id));
          });
          const flashProducts = activeProducts.filter(p => flashSaleProductIds.has(p.id)).slice(0, 8);
          setFlashSaleProducts(flashProducts);
        }

        
        // Filter active bundles by validity dates
        if (settings?.features?.productBundles && fetchedBundles && fetchedBundles.length > 0) {
          const now = new Date();
          const validBundles = fetchedBundles.filter((bundle: ProductBundle) => {
            if (!bundle.isActive) return false;
            if (bundle.validFrom && bundle.validFrom.toDate && bundle.validFrom.toDate() > now) return false;
            if (bundle.validUntil && bundle.validUntil.toDate && bundle.validUntil.toDate() < now) return false;
            return true;
          });
          setActiveBundles(validBundles.slice(0, 6)); // Show max 6 bundles
        }
      } catch {
        // Failed to fetch data
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Load review statistics (average rating + review count) for products used on the homepage
  useEffect(() => {
    if (!settings?.features?.productReviews) return;

    const allProducts: Product[] = [
      ...featuredProducts,
      ...popularProducts,
      ...latestProducts,
      ...flashSaleProducts,
    ];
    const uniqueProducts = Array.from(new Map(allProducts.map((p) => [p.id, p])).values());

    if (uniqueProducts.length === 0) return;

    const loadReviewStats = async () => {
      try {
        const entries = await Promise.all(
          uniqueProducts.map(async (product) => {
            try {
              const reviews: Review[] = await getReviewsByProductId(product.id);
              if (!reviews || reviews.length === 0) {
                return [product.id, { averageRating: 0, reviewCount: 0 }] as const;
              }

              const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
              const averageRating = totalRating / reviews.length;

              return [product.id, { averageRating, reviewCount: reviews.length }] as const;
            } catch {
              // Failed to fetch reviews for this product
              return [product.id, { averageRating: 0, reviewCount: 0 }] as const;
            }
          })
        );

        const statsMap: Record<string, { averageRating: number; reviewCount: number }> = {};
        for (const [productId, stats] of entries) {
          statsMap[productId] = stats;
        }
        setReviewStats(statsMap);
      } catch {
        // Ignore review stats errors; homepage should still render
      }
    };

    runWhenIdle(loadReviewStats);
  }, [featuredProducts, popularProducts, latestProducts, flashSaleProducts, settings?.features?.productReviews]);

  // Load testimonials (reviews with rating >= 4)
  useEffect(() => {
    if (!settings?.features?.productReviews) return;
    
    const loadTestimonials = async () => {
      try {
        const allReviews = await getAllReviews(10, 4); // Get top 10 reviews with rating >= 4
        setTestimonials(allReviews);
      } catch {
        // Failed to load testimonials
      }
    };
    
    runWhenIdle(loadTestimonials);
  }, [settings?.features?.productReviews]);

  // Auto-rotate testimonials
  useEffect(() => {
    if (testimonials.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentTestimonialIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
    }, 5000); // Change testimonial every 5 seconds

    return () => clearInterval(interval);
  }, [testimonials.length]);

  // Load featured blog posts
  useEffect(() => {
    if (!settings?.features?.blog) return;
    
    const loadBlogPosts = async () => {
      try {
        const posts = await getAllPosts(true); // Only published posts
        setFeaturedBlogPosts(posts.slice(0, 3)); // Show top 3
      } catch {
        // Failed to load blog posts
      }
    };
    
    runWhenIdle(loadBlogPosts);
  }, [settings?.features?.blog]);

  // Load recently viewed products
  useEffect(() => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? 'demo-user' : null);
    if (!userId) return;
    
    const loadRecentlyViewed = async () => {
      try {
        const products = await getRecentlyViewed(userId, 8);
        setRecentlyViewedProducts(products);
      } catch {
        // Failed to load recently viewed
      }
    };
    
    runWhenIdle(loadRecentlyViewed);
  }, [user, demoUser, settings?.demoMode]);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Failed to subscribe
    } finally {
      setNewsletterLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        {/* Hero Skeleton */}
        <div className={`relative w-full bg-gray-200 animate-pulse ${isMobile ? 'h-[520px]' : 'h-[760px]'}`} />
        
        {/* Trust Badges Skeleton */}
        <section className="bg-white border-b border-gray-100 py-6 md:py-8">
          <div className="page-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col md:flex-row items-center gap-3">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-200 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Products Skeleton */}
        <section className="page-container py-20">
          <div className="mb-10 md:mb-12">
            <div className="h-8 bg-gray-200 rounded w-64 mb-3" />
            <div className="h-5 bg-gray-200 rounded w-48" />
          </div>
          <div className="hidden md:grid md:grid-cols-4 gap-6 md:gap-8">
            <SkeletonLoader type="product" count={4} />
          </div>
          <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              <SkeletonLoader type="product" count={4} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  const ProductCard = ({ product }: { product: Product }) => {
    const matchedCategory = categories.find(c => c.id === product.category);
    const categoryName = matchedCategory ? getCategoryName(matchedCategory, languageCode) : undefined;

    const getStockStatus = () => {
      if (product.variants && product.variants.length > 0) {
        const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
        if (totalStock > 10) return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'bg-green-500' };
        if (totalStock > 0) return { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', color: 'bg-yellow-500' };
        return { status: 'out_of_stock', text: t('product.out_of_stock') || 'Out of Stock', color: 'bg-red-500' };
      }
      return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'bg-green-500' };
    };

    const stockInfo = getStockStatus();
    const isNew = product.createdAt && product.createdAt.toDate && (Date.now() - product.createdAt.toDate().getTime()) < 30 * 24 * 60 * 60 * 1000;
    const pricing = getProductPricingSummary(product, settings?.goldPricing, settings?.goldPricing?.cache);
    const isOnSale = pricing.hasDiscount;
    const isBestSeller = (product.analytics?.purchases || 0) > 50;
    const displayImage = getSafeImageUrl(product.images?.[0]);

    return (
        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-gray-300">
          <Link 
            href={`/products/${product.slug}`} 
            className="absolute inset-0 z-10"
            aria-label={t('home.view_product', { name: getProductName(product, languageCode) }) || `View product: ${getProductName(product, languageCode)}`}
          />
          
          {/* Badges */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
            {isNew && (
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">
                {t('product.badge_new') || 'New'}
              </span>
            )}
            {isOnSale && (
              <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">
                {t('product.badge_sale') || 'Sale'}
              </span>
            )}
            {isBestSeller && (
              <span className="bg-purple-700 text-white text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">
                {t('product.badge_best_seller') || 'Best Seller'}
              </span>
            )}
          </div>

          {/* Stock Indicator */}
          {stockInfo.status !== 'in_stock' && (
            <div className="absolute top-3 right-3 z-20">
              <span className={`${stockInfo.color} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide`}>
                {stockInfo.text}
              </span>
            </div>
          )}

          {/* Image Container */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-50">
            {displayImage ? (
              <Image 
                src={displayImage} 
                alt={getProductName(product, languageCode) || 'Product'} 
                fill 
                className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
                quality={45}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
            )}
          </div>

          <div className="p-3 md:p-4">
            <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">
              {getProductName(product, languageCode)}
            </h3>
            <div className="mt-1">
              {settings?.features?.productReviews &&
              reviewStats[product.id] &&
              reviewStats[product.id].reviewCount > 0 ? (
                <div className="flex items-center gap-1">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const rating = reviewStats[product.id].averageRating || 0;
                      const roundedRating = Math.round(rating);
                      const isFilled = index < roundedRating;
                      return (
                        <svg
                          key={index}
                          className={`w-3 h-3 md:w-4 md:h-4 ${
                            isFilled ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                        </svg>
                      );
                    })}
                  </div>
                  <span className="text-[10px] md:text-xs text-gray-500">
                    ({reviewStats[product.id].reviewCount} {t('product.reviews') || 'reviews'})
                  </span>
                </div>
              ) : (
                <p className="text-xs md:text-sm text-gray-500 mt-1 truncate">
                  {categoryName || t('product.collection') || 'Collection'}
                </p>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              {pricing.originalPrice !== null && pricing.originalPrice > pricing.currentPrice && (
                <span className="text-sm text-gray-500 line-through">
                  {formatPrice(pricing.originalPrice)}
                </span>
              )}
              <span className="text-sm md:text-base font-semibold text-gray-900">
                {formatPrice(pricing.currentPrice)}
              </span>
            </div>
          </div>
        </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getSectionClasses = (_sectionId?: string) => {
    return '';
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const goldPriceCards = [
    { karat: '24K', multiplier: 1, purity: '99.9%' },
    { karat: '22K', multiplier: 22 / 24, purity: '91.6%' },
    { karat: '21K', multiplier: 21 / 24, purity: '87.5%' },
    { karat: '18K', multiplier: 18 / 24, purity: '75.0%' },
  ].map((item) => {
    const marketPrice = goldBasePrice * item.multiplier;
    const taxRate = Number(settings?.goldPricing?.karatTaxRates?.[item.karat as '24K' | '22K' | '21K' | '18K'] || 0);

    return {
      ...item,
      taxRate,
      marketPrice,
      storePrice: marketPrice * (1 + taxRate / 100),
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formattedGoldUpdate = goldPriceFetchedAt
    ? new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-SA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(goldPriceFetchedAt))
    : isArabic
      ? 'غير متاح'
      : 'Not available';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatGoldAmount = (value: number) =>
    new Intl.NumberFormat(isArabic ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

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

  return (
    <div className="min-h-screen pb-20 flex flex-col">
      
      {/* 1. Banners (Hero Section) */}
      {isHomepageSectionEnabled('hero') && (
      <section 
        data-section-id="hero"
        className={`relative w-full overflow-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e4_100%)] ${isMobile ? 'min-h-[520px]' : 'min-h-[760px]'} ${getSectionClasses('hero')}`}
        style={{ order: getHomepageSectionOrder('hero') }}
      >
        {banners.length > 0 ? (
           <>
            <div className="page-container py-4 md:py-6">
              <div className="relative overflow-hidden rounded-[2.25rem] border border-[#ead8ab] bg-[#f8f3e8] shadow-[0_30px_80px_rgba(115,84,28,0.12)]">
                <div className={`relative ${isMobile ? 'h-[520px]' : 'h-[680px]'}`}>
            {/* Banner Images */}
            <div className={`relative h-full ${isMobile ? 'w-full' : 'w-full'}`}>
              {banners.map((banner, index) => (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  <Image
                    src={getSafeImageUrl(banner.imageUrl)}
                    alt={getBannerText(banner, 'title') || settings?.company?.name || ''}
                    fill
                    sizes="(max-width: 768px) 100vw, 1216px"
                    priority={index === 0}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 ? 'high' : undefined}
                    quality={42}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            
            <div className="absolute inset-0 z-20 bg-[linear-gradient(90deg,rgba(249,244,231,0.92)_0%,rgba(249,244,231,0.72)_38%,rgba(34,24,8,0.08)_100%)]"></div>
            <div className="absolute inset-0 z-20 bg-[radial-gradient(circle_at_top_left,rgba(234,198,111,0.30),transparent_28%)]"></div>
            
            {/* Banner Content */}
            <div className="absolute inset-0 z-30 flex items-center">
              <div className="w-full px-6 md:px-14">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center rounded-full border border-[#caa14d] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#9f7424] shadow-sm backdrop-blur">
                    {isArabic ? 'مجموعة ذهبية مختارة' : 'Curated Gold Collection'}
                  </span>
                  <h1 
                    className="mt-5 text-4xl md:text-6xl lg:text-7xl font-heading font-bold mb-5 md:mb-8 leading-[1.05] tracking-tight"
                    style={{ color: banners[currentBannerIndex].titleColor || '#fff' }}
                  >
                    {getBannerText(banners[currentBannerIndex], 'title') || getHomepageSectionTitle('hero', t('home.banner_title') || "Discover Your Elegance")}
                  </h1>
                  <p 
                    className="text-lg md:text-xl lg:text-2xl mb-8 md:mb-10 leading-relaxed max-w-xl"
                    style={{ color: banners[currentBannerIndex].subtitleColor || '#fff' }}
                  >
                    {getBannerText(banners[currentBannerIndex], 'subtitle') || getHomepageSectionSubtitle('hero', t('home.banner_subtitle') || "Explore our latest collection of premium modest fashion designed for the modern woman.")}
                  </p>
                  
                  {/* Countdown Timer for Flash Sales */}
                  {activeFlashSales.length > 0 && activeFlashSales[0].endTime && (
                    <div className="mb-8 md:mb-10">
                      <p className="mb-3 text-sm md:text-base font-medium text-[#4f3d18]">
                        {t('home.limited_time_offer') || 'Limited Time Offer'}
                      </p>
                      <CountdownTimer 
                        endTime={activeFlashSales[0].endTime.toDate()}
                      />
                    </div>
                  )}

                  {/* Multiple CTAs - Touch-friendly */}
                  <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                    <Link
                      href={banners[currentBannerIndex].linkTo || "/shop"}
                      className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white transition-all hover:scale-[1.02] hover:bg-[#36280e] md:px-10 md:py-5 md:text-base"
                    >
                      {t('home.shop_collection') || 'Shop Collection'}
                    </Link>
                    {activeFlashSales.length > 0 && (
                      <Link
                        href="/flash"
                        className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#caa14d] bg-white/70 px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#8a6721] backdrop-blur transition-all hover:scale-[1.02] hover:bg-white md:px-10 md:py-5 md:text-base"
                      >
                        {t('home.shop_flash_sale') || 'Shop Flash Sale'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Dots */}
            {banners.length > 1 && (
              <div className="absolute bottom-8 right-8 z-30 flex gap-2">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBannerIndex(index)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                    aria-label={`Go to banner ${index + 1}`}
                  >
                    <span
                      className={`block rounded-full transition-all ${
                        index === currentBannerIndex ? 'h-2.5 w-8 bg-[#1a1307]' : 'h-2.5 w-2.5 bg-[#d2bb85] hover:bg-[#b99343]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
                </div>
              </div>
            </div>

           </>
        ) : (
          <div className="page-container py-6">
            <div className="flex min-h-[560px] items-center justify-center rounded-[2.25rem] border border-[#ead8ab] bg-[linear-gradient(135deg,#f7f1e4_0%,#fffdf8_100%)] text-center shadow-[0_30px_80px_rgba(115,84,28,0.12)]">
            <div className="text-center px-6">
              <h1 className="mb-4 text-5xl font-heading font-bold text-[#24180a] md:text-6xl">
                {getHomepageSectionTitle('hero', t('home.welcome')?.replace('{company}', settings?.company?.name || '') || `Welcome to ${settings?.company?.name || ''}`)}
              </h1>
              <p className="text-xl text-gray-300 mb-8"></p>
              <Link href="/shop" className="inline-block rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#36280e]">
                {t('home.shop_now') || 'Shop Now'}
              </Link>
            </div>
            </div>
          </div>
        )}
      </section>
      )}

      {/* Trust Badges Section - Full Width */}
      {isHomepageSectionEnabled('trust-badges') && (
      <section 
        data-section-id="trust-badges"
        className={`w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 border-b border-gray-200 py-16 md:py-20 ${getSectionClasses('trust-badges')}`}
        style={{ order: getHomepageSectionOrder('trust-badges') }}
      >
        <div className="page-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <div className="flex flex-col md:flex-row items-center gap-3 text-center md:text-left bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 md:w-7 md:h-7 text-orange-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m16.5 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                  {t('home.trust_free_shipping') || 'Free Shipping'}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  {t('home.trust_free_shipping_desc') || 'On orders over $100'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-3 text-center md:text-left bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 md:w-7 md:h-7 text-green-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                  {t('home.trust_secure_payment') || 'Secure Payment'}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  {t('home.trust_secure_payment_desc') || '100% secure checkout'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-3 text-center md:text-left bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 md:w-7 md:h-7 text-purple-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                  {t('home.trust_authentic') || 'Authentic Products'}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  {t('home.trust_authentic_desc') || '100% genuine items'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-3 text-center md:text-left bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 md:w-7 md:h-7 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.228a46.865 46.865 0 00-12.12 0m12.12 0a46.866 46.866 0 01-12.12 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                  {t('home.trust_easy_returns') || 'Easy Returns'}
                </p>
                <p className="text-xs md:text-sm text-gray-500">
                  {t('home.trust_easy_returns_desc') || '30-day return policy'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {isHomepageSectionEnabled('gold-prices') && goldBasePrice > 0 && (() => {
        // Ounce = 31.1035 grams, approximate SAR/USD rate
        const sarToUsd = 3.75;
        const gramsPerOunce = 31.1035;
        const goldOunceSAR = goldBasePrice * gramsPerOunce;
        const goldOunceUSD = goldOunceSAR / sarToUsd;
        // Approximate high/low (±2%)
        const goldHighSAR = goldBasePrice * gramsPerOunce * 1.005;
        const goldLowSAR = goldBasePrice * gramsPerOunce * 0.995;
        // Silver approximation (~1/85 of gold)
        const silverRatio = 85;
        const silverOunceSAR = goldOunceSAR / silverRatio;
        const silverOunceUSD = silverOunceSAR / sarToUsd;
        const silverHighSAR = silverOunceSAR * 1.008;
        const silverLowSAR = silverOunceSAR * 0.992;

        const fmtSAR = (v: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(v);
        const fmtUSD = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
        const fmtDecimal = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

        return (
        <section
          data-section-id="gold-prices"
          className={`w-full bg-gradient-to-b from-[#fdf8ee] to-[#f5eedc] py-14 md:py-20 ${getSectionClasses('gold-prices')}`}
          style={{ order: getHomepageSectionOrder('gold-prices') }}
        >
          <div className="page-container max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl lg:text-[2.6rem] font-heading font-bold leading-snug text-[#23190a]">
                {t('home.gold_section_title') || 'وجهتك الأولى لمعرفة سعر الذهب اليوم في السعودية'}
              </h2>
              <p className="mt-5 max-w-2xl mx-auto text-sm md:text-[15px] leading-7 text-[#6b5d42]">
                {t('home.gold_section_desc') || 'نوفر لك أسعار الذهب اللحظية لجميع العيارات وأسعار البيع والشراء وأدوات تحليلية وحاسبات دقيقة للذهب والزكاة، ومحتوى عميق يشرف عليها خبراء متخصصون في سوق الذهب، لتمكينك من اتخاذ قراراتك الاستثمارية بثقة ووعي تام.'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center gap-0 mb-8 bg-white rounded-2xl overflow-hidden border border-[#e8dcc0] shadow-sm">
              {[
                { label: t('home.gold_tab_price_now') || 'السعر الآن', active: true },
                { label: t('home.gold_tab_karats') || 'العيارات', active: false },
                { label: t('home.gold_tab_buy_sell') || 'البيع والشراء', active: false },
                { label: t('home.gold_tab_chart') || 'الرسم البياني', active: false },
              ].map((tab, idx) => (
                <Link
                  key={idx}
                  href={tab.active ? '#' : '/gold-price'}
                  className={`flex-1 py-3 px-2 text-center text-sm font-semibold transition-colors ${
                    tab.active
                      ? 'bg-[#c9a84c] text-white'
                      : 'text-[#6b5d42] hover:bg-[#f5eedc]'
                  } ${idx > 0 ? 'border-r border-[#e8dcc0]' : ''}`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            {/* Price Rows */}
            <div className="space-y-4">
              {/* Gold Ounce Row */}
              <div className="bg-white rounded-2xl border border-[#e8dcc0] shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_auto_auto_1.2fr] items-center divide-y md:divide-y-0 md:divide-x divide-[#f0e6d0]">
                  {/* SAR Price */}
                  <div className="flex items-center gap-4 p-5 md:p-6">
                    <div className="flex-1 text-right">
                      <p className="text-xs text-[#8a7a5a] mb-1">{t('home.gold_ounce_sar') || 'أونصة الذهب بالريال'}</p>
                      <div className="flex items-baseline gap-2 justify-end">
                        <span className="text-[10px] text-[#8a7a5a]">﷼</span>
                        <span className="text-2xl md:text-3xl font-bold text-[#23190a]">{fmtSAR(goldOunceSAR)}</span>
                      </div>
                    </div>
                  </div>

                  {/* High / Low */}
                  <div className="p-5 md:p-6 text-center">
                    <div className="flex flex-col gap-1 text-xs text-[#6b5d42]">
                      <div className="flex items-center justify-between gap-4">
                        <span>{isArabic ? 'أعلى سعر' : 'High'}</span>
                        <span className="font-semibold text-[#23190a]">{fmtDecimal(goldHighSAR)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>{isArabic ? 'أقل سعر' : 'Low'}</span>
                        <span className="font-semibold text-[#23190a]">{fmtDecimal(goldLowSAR)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Change */}
                  <div className="p-5 md:p-6 text-center">
                    <p className="text-[10px] text-[#8a7a5a] mb-1">{isArabic ? 'قيمة التغيير' : 'Change'}</p>
                    <span className="inline-flex items-center gap-1 text-red-600 font-bold text-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      20%
                    </span>
                  </div>

                  {/* USD Price */}
                  <div className="flex items-center gap-4 p-5 md:p-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-[#23190a]">$</span>
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-xs text-[#8a7a5a] mb-1">{t('home.gold_ounce_usd') || 'أونصة الذهب بالدولار'}</p>
                      <span className="text-xl md:text-2xl font-bold text-[#23190a]">{fmtUSD(goldOunceUSD)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Silver Ounce Row */}
              <div className="bg-white rounded-2xl border border-[#e8dcc0] shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_auto_auto_1.2fr] items-center divide-y md:divide-y-0 md:divide-x divide-[#f0e6d0]">
                  {/* SAR Price */}
                  <div className="flex items-center gap-4 p-5 md:p-6">
                    <div className="flex-1 text-right">
                      <p className="text-xs text-[#8a7a5a] mb-1">{t('home.silver_ounce_sar') || 'أونصة الفضة بالريال'}</p>
                      <div className="flex items-baseline gap-2 justify-end">
                        <span className="text-[10px] text-[#8a7a5a]">﷼</span>
                        <span className="text-2xl md:text-3xl font-bold text-[#23190a]">{fmtSAR(silverOunceSAR)}</span>
                      </div>
                    </div>
                  </div>

                  {/* High / Low */}
                  <div className="p-5 md:p-6 text-center">
                    <div className="flex flex-col gap-1 text-xs text-[#6b5d42]">
                      <div className="flex items-center justify-between gap-4">
                        <span>{isArabic ? 'أعلى سعر' : 'High'}</span>
                        <span className="font-semibold text-[#23190a]">{fmtDecimal(silverHighSAR)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>{isArabic ? 'أقل سعر' : 'Low'}</span>
                        <span className="font-semibold text-[#23190a]">{fmtDecimal(silverLowSAR)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Change */}
                  <div className="p-5 md:p-6 text-center">
                    <p className="text-[10px] text-[#8a7a5a] mb-1">{isArabic ? 'قيمة التغيير' : 'Change'}</p>
                    <span className="inline-flex items-center gap-1 text-red-600 font-bold text-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      20%
                    </span>
                  </div>

                  {/* USD Price */}
                  <div className="flex items-center gap-4 p-5 md:p-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-[#23190a]">$</span>
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-xs text-[#8a7a5a] mb-1">{t('home.silver_ounce_usd') || 'أونصة الفضة بالدولار'}</p>
                      <span className="text-xl md:text-2xl font-bold text-[#23190a]">{fmtUSD(silverOunceUSD)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* View Full Page Link */}
            <div className="text-center mt-8">
              <Link
                href="/gold-price"
                className="inline-flex items-center gap-2 rounded-full bg-[#1f1608] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#36280e] shadow-lg"
              >
                {t('home.gold_prices_view_full') || (isArabic ? 'عرض صفحة الذهب كاملة' : 'View full gold page')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={isArabic ? "M19 12H5m0 0l7 7m-7-7l7-7" : "M5 12h14m0 0l-7-7m7 7l-7 7"} /></svg>
              </Link>
            </div>
          </div>
        </section>
        );
      })()}

      {/* 2. Featured Products - Container with Asymmetric Grid */}
      {showDeferredSections && isHomepageSectionEnabled('featured') && featuredProducts.length > 0 && (
        <section 
          data-section-id="featured"
          className={`bg-white py-12 md:py-16 ${getSectionClasses('featured')}`}
          style={{ order: getHomepageSectionOrder('featured') }}
        >
          <div className="page-container">
            <div className="flex justify-between items-end mb-12 md:mb-16">
                <div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">{getHomepageSectionTitle('featured', t('home.featured') || 'Featured Collection')}</h2>
                    <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">{getHomepageSectionSubtitle('featured', t('home.featured_desc') || 'Curated picks just for you')}</p>
                </div>
                <Link href="/shop" className="text-sm font-medium text-gray-900 border-b-2 border-gray-900 pb-1 hover:opacity-70 transition-opacity hidden md:block">
                  {t('home.view_all') || 'View All'} {isArabic ? '←' : '→'}
                </Link>
            </div>
            {/* Desktop Grid */}
            <div className="hidden md:grid md:grid-cols-4 gap-6 md:gap-8">
                {featuredProducts.slice(0, getHomepageSectionLimit('featured', 8)).map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
            {/* Mobile Horizontal Scroll - Swipeable */}
            <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-4 items-stretch" style={{ width: 'max-content' }}>
                {featuredProducts.slice(0, getHomepageSectionLimit('featured', 8)).map((product, index) => (
                  <div key={product.id} className={`flex-shrink-0 w-[45vw] h-full ${index === 0 ? '' : ''}`} style={{ scrollSnapAlign: 'start' }}>
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center mt-10 md:hidden">
              <Link href="/shop" className="text-sm font-medium text-gray-900 border-b-2 border-gray-900 pb-1 hover:opacity-70 transition-opacity">
                {t('home.view_all') || 'View All'} {isArabic ? '←' : '→'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 3. Flash Sales - Full Width */}
      {showDeferredSections && isHomepageSectionEnabled('flash-sales') && activeFlashSales.length > 0 && flashSaleProducts.length > 0 && (
        <section 
          data-section-id="flash-sales"
          className={`w-full bg-gradient-to-br from-red-50 via-white to-red-50 py-12 md:py-16 ${getSectionClasses('flash-sales')}`}
          style={{ order: getHomepageSectionOrder('flash-sales') }}
        >
          <div className="page-container">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 md:mb-12">
              <div>
                <div className="inline-block bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                  Flash Sale
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-gray-900 mb-3 leading-tight">
                  {getHomepageSectionTitle('flash-sales', activeFlashSales[0].name || (t('home.flash_sale') || 'Flash Sale'))}
                </h2>
                <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">
                  {getHomepageSectionSubtitle('flash-sales', activeFlashSales[0].description || (t('home.flash_sale_desc') || 'Limited time offers - grab them before they\'re gone'))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {flashSaleProducts.slice(0, getHomepageSectionLimit('flash-sales', 8)).map((product) => {
                const matchedCategory = categories.find((c) => c.id === product.category);
                const categoryName = matchedCategory ? getCategoryName(matchedCategory, languageCode) : undefined;

                // Find applicable flash sale for this product
                const productSale = activeFlashSales.find((sale) =>
                  sale.productIds.includes(product.id)
                );

                const flashPricing = getFlashSaleAdjustedPrice(
                  product,
                  productSale,
                  settings?.goldPricing,
                  settings?.goldPricing?.cache
                );

                return (
                  <Link key={product.id} href={`/flash/products/${product.slug || product.id}`} className="group block">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 rounded-2xl mb-3 border-2 border-gray-200 group-hover:border-red-300 transition-all shadow-lg group-hover:shadow-xl">
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={getSafeImageUrl(product.images[0])}
                          alt={getProductName(product, languageCode)}
                          fill
                          className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
                          quality={45}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-300">
                          <span className="text-xs uppercase tracking-widest">No Image</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider z-10">
                        Flash Sale
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {getProductName(product, languageCode)}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">{categoryName || 'Collection'}</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        {flashPricing.originalPrice !== null && flashPricing.originalPrice > flashPricing.currentPrice && (
                          <span className="text-xs text-gray-500 line-through">
                            {formatPrice(flashPricing.originalPrice)}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-red-600">
                          {formatPrice(flashPricing.currentPrice)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 4. Popular Products - Container */}
      {showDeferredSections && isHomepageSectionEnabled('popular') && popularProducts.length > 0 && (
        <section 
          data-section-id="popular"
          className={`bg-white py-12 md:py-16 ${getSectionClasses('popular')}`}
          style={{ order: getHomepageSectionOrder('popular') }}
        >
          <div className="page-container">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">{getHomepageSectionTitle('popular', t('home.popular') || 'Popular This Week')}</h2>
                    <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">{getHomepageSectionSubtitle('popular', t('home.popular_desc') || 'Top trending styles loved by our customers')}</p>
                </div>
                {/* Desktop Grid */}
                <div className="hidden md:grid md:grid-cols-4 gap-6 md:gap-8">
                    {popularProducts.slice(0, getHomepageSectionLimit('popular', 8)).map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
                {/* Mobile Horizontal Scroll - Swipeable */}
                <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                  <div className="flex gap-4 items-stretch" style={{ width: 'max-content' }}>
                    {popularProducts.slice(0, getHomepageSectionLimit('popular', 8)).map((product, index) => (
                      <div key={product.id} className={`flex-shrink-0 w-[45vw] h-full ${index === 0 ? '' : ''}`} style={{ scrollSnapAlign: 'start' }}>
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                </div>
          </div>
        </section>
      )}

      {/* 5. Shop by Category - Full Width with Asymmetric Grid */}
      {showDeferredSections && isHomepageSectionEnabled('categories') && categories.length > 0 && (
        <section 
          data-section-id="categories"
          className={`w-full bg-gradient-to-b from-white via-gray-50 to-white py-12 md:py-16 ${getSectionClasses('categories')}`}
          style={{ order: getHomepageSectionOrder('categories') }}
        >
          <div className="page-container">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">{getHomepageSectionTitle('categories', t('home.shop_by_category') || 'Shop by Category')}</h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">{getHomepageSectionSubtitle('categories', t('home.shop_by_category_desc') || 'Browse by your favorite categories')}</p>
            </div>
            {/* Asymmetric Grid: First item larger, rest in grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {categories.slice(0, getHomepageSectionLimit('categories', 8)).map((category, index) => (
                  <Link 
                    key={category.id} 
                    href={`/shop?category=${category.slug}`} 
                    className={`group relative rounded-2xl overflow-hidden bg-gray-100 border-2 border-gray-200 hover:border-gray-300 transition-all shadow-lg hover:shadow-xl ${
                      index === 0 ? 'md:col-span-2 md:row-span-2 h-48 md:h-96' : 'h-48 md:h-64'
                    }`}
                  >
                      {category.imageUrl ? (
                        <Image
                          src={getSafeImageUrl(category.imageUrl)}
                          alt={getCategoryName(category, languageCode)}
                          fill
                          sizes={index === 0 ? "(max-width: 768px) 100vw, 620px" : "(max-width: 768px) 50vw, 320px"}
                          quality={45}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />
                      )}
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors z-10" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-4 text-center">
                          <span className="text-white text-xl md:text-2xl font-heading font-bold">{getCategoryName(category, languageCode)}</span>
                          <span className="text-white/90 text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
                              {t('home.explore') || 'Explore'} {isArabic ? '←' : '→'}
                          </span>
                      </div>
                  </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Latest Products - Container */}
      {showDeferredSections && isHomepageSectionEnabled('latest') && latestProducts.length > 0 && (
        <section 
          data-section-id="latest"
          className={`bg-white py-12 md:py-16 ${getSectionClasses('latest')}`}
          style={{ order: getHomepageSectionOrder('latest') }}
        >
          <div className="page-container">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 md:mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-gray-900 mb-4 md:mb-5 leading-tight">{getHomepageSectionTitle('latest', t('home.new_arrivals') || 'New Arrivals')}</h2>
                <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">{getHomepageSectionSubtitle('latest', t('home.new_arrivals_desc') || 'Discover our latest additions')}</p>
              </div>
              <Link href="/shop?sort=newest" className="mt-4 md:mt-0 px-6 py-2.5 border-2 border-gray-900 rounded-full text-sm font-medium hover:bg-gray-900 hover:text-white transition-colors">
                  {t('home.browse_all_new') || 'Browse All New'}
              </Link>
          </div>
          {/* Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-4 gap-6 md:gap-8">
              {latestProducts.slice(0, getHomepageSectionLimit('latest', 8)).map(product => (
                  <ProductCard key={product.id} product={product} />
              ))}
          </div>
          {/* Mobile Horizontal Scroll - Swipeable */}
          <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-4 items-stretch" style={{ width: 'max-content' }}>
              {latestProducts.slice(0, getHomepageSectionLimit('latest', 8)).map((product, index) => (
                <div key={product.id} className={`flex-shrink-0 w-[45vw] h-full ${index === 0 ? '' : ''}`} style={{ scrollSnapAlign: 'start' }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
          </div>
        </section>
      )}

      {/* 7. Collections - Full Width */}
      {showDeferredSections && isHomepageSectionEnabled('collections') && collections.length > 0 && (
        <section 
          data-section-id="collections"
          className={`w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 py-12 md:py-16 ${getSectionClasses('collections')}`}
          style={{ order: getHomepageSectionOrder('collections') }}
        >
          <div className="page-container">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">{getHomepageSectionTitle('collections', t('home.collections') || 'Our Collections')}</h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">{getHomepageSectionSubtitle('collections', t('home.collections_desc') || 'Explore curated collections designed for you')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {collections.slice(0, getHomepageSectionLimit('collections', 6)).map((collection) => (
                <Link 
                  key={collection.id} 
                  href={`/shop?collection=${collection.slug}`} 
                  className="group relative h-64 md:h-80 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all shadow-sm hover:shadow-lg"
                >
                  {collection.imageUrl ? (
                    <Image
                      src={getSafeImageUrl(collection.imageUrl)}
                      alt={collection.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      quality={45}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                    <h3 className="text-white text-xl md:text-2xl font-heading font-bold mb-2">{getCollectionName(collection, languageCode)}</h3>
                    {getCollectionDescription(collection, languageCode) && (
                      <p className="text-white/90 text-sm line-clamp-2">{getCollectionDescription(collection, languageCode)}</p>
                    )}
                    <span className="inline-block mt-3 text-white text-sm font-medium border-b border-white/50 pb-1 group-hover:border-white transition-colors">
                      {t('home.explore_collection') || 'Explore Collection'} {isArabic ? '←' : '→'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. Product Bundles / Special Offers - Container */}
      {showDeferredSections && isHomepageSectionEnabled('bundles') && settings?.features?.productBundles && activeBundles.length > 0 && (
        <section 
          data-section-id="bundles"
          className={`bg-white py-12 md:py-16 ${getSectionClasses('bundles')}`}
          style={{ order: getHomepageSectionOrder('bundles') }}
        >
          <div className="page-container">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">{getHomepageSectionTitle('bundles', t('home.special_offers') || 'Special Offers')}</h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">{getHomepageSectionSubtitle('bundles', t('home.bundle_deals') || 'Exclusive bundle deals and offers')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {activeBundles.slice(0, getHomepageSectionLimit('bundles', 6)).map((bundle) => {
              // Calculate bundle price
              let bundlePrice = 0;
              let originalPrice = 0;
              
              // Get all products for price calculation
              const allProducts = [...featuredProducts, ...popularProducts, ...latestProducts];
              const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());
              
              if (bundle.bundlePrice) {
                bundlePrice = bundle.bundlePrice;
                // Calculate original price from products
                bundle.products.forEach(p => {
                  const product = uniqueProducts.find(pr => pr.id === p.productId);
                  if (product) {
                    const itemPrice = getProductPricingSummary(
                      product,
                      settings?.goldPricing,
                      settings?.goldPricing?.cache
                    ).currentPrice;
                    originalPrice += itemPrice * (p.quantity || 1);
                  }
                });
              } else {
                // Calculate from products
                bundle.products.forEach(p => {
                  const product = uniqueProducts.find(pr => pr.id === p.productId);
                  if (product) {
                    const itemPrice = getProductPricingSummary(
                      product,
                      settings?.goldPricing,
                      settings?.goldPricing?.cache
                    ).currentPrice;
                    const quantity = p.quantity || 1;
                    originalPrice += itemPrice * quantity;
                    
                    if (p.discount) {
                      bundlePrice += itemPrice * quantity * (1 - p.discount / 100);
                    } else {
                      bundlePrice += itemPrice * quantity;
                    }
                  }
                });
                
                // Apply bundle-level discount
                if (bundle.discountType === 'percentage' && bundle.discountValue) {
                  bundlePrice = bundlePrice * (1 - bundle.discountValue / 100);
                } else if (bundle.discountType === 'fixed' && bundle.discountValue) {
                  bundlePrice = bundlePrice - bundle.discountValue;
                }
              }
              
              return (
                <Link
                  key={bundle.id}
                  href={`/product-bundles/${bundle.id}`}
                  className="group relative bg-white rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all shadow-sm hover:shadow-lg"
                >
                  {bundle.image ? (
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={getSafeImageUrl(bundle.image)}
                        alt={bundle.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        quality={45}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="relative h-48 w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No Image</span>
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-heading font-bold text-gray-900 group-hover:text-gray-600 transition-colors flex-1">
                        {bundle.name}
                      </h3>
                      <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded uppercase">
                        Bundle
                      </span>
                    </div>
                    {bundle.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{bundle.description}</p>
                    )}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">Includes {bundle.products.length} {bundle.products.length === 1 ? 'item' : 'items'}</p>
                      <div className="flex items-center gap-2">
                        {originalPrice > bundlePrice && (
                          <span className="text-sm text-gray-500 line-through">{formatPrice(originalPrice)}</span>
                        )}
                        <span className="text-xl font-heading font-bold text-gray-900">{formatPrice(bundlePrice)}</span>
                        {bundle.discountType === 'percentage' && bundle.discountValue && (
                          <span className="text-sm font-medium text-red-600">-{bundle.discountValue}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-sm font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                      {t('home.view_bundle') || 'View Bundle'} {isArabic ? '←' : '→'}
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        </section>
      )}

      {/* 9. Customer Testimonials/Reviews Carousel - Full Width */}
      {showDeferredSections && isHomepageSectionEnabled('testimonials') && testimonials.length > 0 && (
        <section 
          data-section-id="testimonials"
          className={`w-full bg-gradient-to-b from-white via-gray-50 to-white py-12 md:py-16 ${getSectionClasses('testimonials')}`}
          style={{ order: getHomepageSectionOrder('testimonials') }}
        >
          <div className="page-container">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">
                {getHomepageSectionTitle('testimonials', t('home.testimonials_title') || 'What Our Customers Say')}
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">
                {getHomepageSectionSubtitle('testimonials', t('home.testimonials_subtitle') || 'Real reviews from real customers')}
              </p>
            </div>
            <div className="max-w-4xl mx-auto relative">
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
                {testimonials.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const rating = testimonials[currentTestimonialIndex]?.rating || 0;
                        const isFilled = index < rating;
                        return (
                          <svg
                            key={index}
                            className={`w-5 h-5 md:w-6 md:h-6 ${
                              isFilled ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                          </svg>
                        );
                      })}
                    </div>
                    <p className="text-lg md:text-xl text-gray-700 mb-6 italic">
                      &quot;{testimonials[currentTestimonialIndex]?.comment}&quot;
                    </p>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {testimonials[currentTestimonialIndex]?.userName}
                        </p>
                        {testimonials[currentTestimonialIndex]?.verifiedPurchase && (
                          <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            {t('home.verified_purchase') || 'Verified Purchase'}
                          </p>
                        )}
                      </div>
                      {testimonials.length > 1 && (
                        <div className="flex gap-3 justify-center md:justify-end">
                          {testimonials.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentTestimonialIndex(index)}
                              className={`h-4 rounded-full transition-all ${
                                index === currentTestimonialIndex ? 'bg-gray-900 w-10' : 'bg-gray-300 hover:bg-gray-400 w-4'
                              }`}
                              aria-label={`Go to testimonial ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 10. Newsletter Signup Section - Full Width */}
      {showDeferredSections && isHomepageSectionEnabled('newsletter') && (
      <section 
        data-section-id="newsletter"
        className={`w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black py-12 md:py-16 ${getSectionClasses('newsletter')}`}
        style={{ order: getHomepageSectionOrder('newsletter') }}
      >
        <div className="page-container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-white mb-5 md:mb-6 leading-tight">
              {getHomepageSectionTitle('newsletter', t('home.newsletter_title') || 'Subscribe to Our Newsletter')}
            </h2>
            <p className="text-lg md:text-xl text-gray-300 mb-2">
              {getHomepageSectionSubtitle('newsletter', t('home.newsletter_subtitle') || 'Get exclusive offers and updates')}
            </p>
            <p className="text-base md:text-lg text-yellow-400 font-semibold mb-8">
              {t('home.newsletter_discount') || 'Get 10% off your first order!'}
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder={t('home.newsletter_placeholder') || 'Enter your email'}
                required
                className="flex-1 px-6 py-4 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button
                type="submit"
                disabled={newsletterLoading}
                className="px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {newsletterLoading ? (t('home.newsletter_subscribing') || 'Subscribing...') : (t('home.newsletter_subscribe') || 'Subscribe')}
              </button>
            </form>
            {newsletterSuccess && (
              <p className="mt-4 text-green-400 font-medium">
                {t('home.newsletter_success') || 'Thank you for subscribing!'}
              </p>
            )}
          </div>
        </div>
      </section>
      )}

      {/* 11. Featured Blog Posts Section - Container */}
      {showDeferredSections && isHomepageSectionEnabled('blog') && featuredBlogPosts.length > 0 && (
        <section 
          data-section-id="blog"
          className={`bg-white py-12 md:py-16 ${getSectionClasses('blog')}`}
          style={{ order: getHomepageSectionOrder('blog') }}
        >
          <div className="page-container">
            <div className="flex justify-between items-end mb-10 md:mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">
                  {getHomepageSectionTitle('blog', t('home.blog_title') || 'Latest from Our Blog')}
                </h2>
                <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">
                  {getHomepageSectionSubtitle('blog', t('home.blog_subtitle') || 'Fashion tips, style guides, and more')}
                </p>
              </div>
              <Link href="/blog" className="text-sm font-medium text-gray-900 border-b-2 border-gray-900 pb-1 hover:opacity-70 transition-opacity hidden md:block">
                {t('home.view_all_blog') || 'View All'} {isArabic ? '←' : '→'}
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {featuredBlogPosts.slice(0, getHomepageSectionLimit('blog', 3)).map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all shadow-sm hover:shadow-lg h-full flex flex-col"
              >
                <div className="relative h-48 w-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {post.coverImage ? (
                    <Image
                      src={getSafeImageUrl(post.coverImage)}
                      alt={isArabic && post.title_ar ? post.title_ar : post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      quality={45}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-heading font-bold text-gray-900 mb-2 group-hover:text-gray-600 transition-colors line-clamp-2">
                    {isArabic && post.title_ar ? post.title_ar : post.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                    {isArabic && post.excerpt_ar ? post.excerpt_ar : post.excerpt}
                  </p>
                  <div className="flex items-center text-sm font-medium text-gray-900 group-hover:text-gray-600 transition-colors mt-auto">
                    {t('home.read_more') || 'Read More'} {isArabic ? '←' : '→'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10 md:hidden">
            <Link href="/blog" className="text-sm font-medium text-gray-900 border-b-2 border-gray-900 pb-1 hover:opacity-70 transition-opacity">
              {t('home.view_all_blog') || 'View All'} {isArabic ? '←' : '→'}
            </Link>
          </div>
          </div>
        </section>
      )}

      {/* 13. Recently Viewed Products Section - Container */}
      {showDeferredSections && isHomepageSectionEnabled('recently-viewed') && recentlyViewedProducts.length > 0 && (
        <section 
          data-section-id="recently-viewed"
          className={`bg-white py-12 md:py-16 ${getSectionClasses('recently-viewed')}`}
          style={{ order: getHomepageSectionOrder('recently-viewed') }}
        >
          <div className="page-container">
            <div className="flex justify-between items-end mb-10 md:mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold mb-4 md:mb-5 text-gray-900 leading-tight">
                  {getHomepageSectionTitle('recently-viewed', t('home.recently_viewed') || 'Recently Viewed')}
                </h2>
                <p className="text-base md:text-lg lg:text-xl text-gray-600 font-medium">
                  {getHomepageSectionSubtitle('recently-viewed', t('home.recently_viewed_desc') || 'Continue browsing where you left off')}
                </p>
              </div>
            </div>
            {/* Desktop Grid */}
            <div className="hidden md:grid md:grid-cols-4 gap-6 md:gap-8">
              {recentlyViewedProducts.slice(0, getHomepageSectionLimit('recently-viewed', 8)).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {/* Mobile Horizontal Scroll - Swipeable */}
            <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-4" style={{ width: 'max-content' }}>
                {recentlyViewedProducts.slice(0, getHomepageSectionLimit('recently-viewed', 8)).map(product => (
                  <div key={product.id} className="flex-shrink-0 w-[45vw]" style={{ scrollSnapAlign: 'start' }}>
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
