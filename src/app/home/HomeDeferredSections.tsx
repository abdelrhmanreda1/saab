import HomeHero from './HomeHero';
import HomeDeferredSectionsClient from './HomeDeferredSectionsClient';
import HomeSectionViewportGate from './HomeSectionViewportGate';
import { getCachedSettings } from '@/lib/server/site-config';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllCollections } from '@/lib/firestore/collections_db';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { getAllReviews } from '@/lib/firestore/reviews_enhanced_db';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { getAllProductBundles } from '@/lib/firestore/product_bundles_db';
import {
  defaultHomepageSections,
  HomepageSection,
} from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import type { Product } from '@/lib/firestore/products';
import type { Review } from '@/lib/firestore/reviews_enhanced';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';
import { generateSlug } from '@/lib/utils/slug';

type ReviewStats = Record<string, { averageRating: number; reviewCount: number }>;

function buildReviewStats(reviews: Review[]): ReviewStats {
  return reviews.reduce<ReviewStats>((acc, review) => {
    if (!review.productId) return acc;
    const current = acc[review.productId] || { averageRating: 0, reviewCount: 0 };
    const nextCount = current.reviewCount + 1;
    const nextAverage =
      (current.averageRating * current.reviewCount + Number(review.rating || 0)) / nextCount;
    acc[review.productId] = { averageRating: nextAverage, reviewCount: nextCount };
    return acc;
  }, {});
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function HomeDeferredSections({ showHero = false }: { showHero?: boolean }) {
  const settings = await getCachedSettings().catch(() => null);
  const homepageSections = await getHomepageSections().catch(() => defaultHomepageSections);

  const [
    fetchedProducts,
    fetchedCategories,
    fetchedCollections,
    fetchedFlashSales,
    fetchedReviews,
    fetchedPosts,
    fetchedBundles,
  ] = await Promise.all([
    getAllProducts().catch(() => []),
    getAllCategories().catch(() => []),
    getAllCollections().catch(() => []),
    getAllFlashSales(true).catch(() => []),
    settings?.features?.productReviews ? getAllReviews().catch(() => []) : Promise.resolve([]),
    settings?.features?.blog ? getAllPosts(true).catch(() => []) : Promise.resolve([]),
    settings?.features?.productBundles ? getAllProductBundles(true).catch(() => []) : Promise.resolve([]),
  ]);

  const products = fetchedProducts
    .filter((product) => product.isActive)
    .map((product) => ({
      ...product,
      slug: product.slug || generateSlug(product.name || `product-${product.id}`),
    }));

  const featuredProducts = products.filter((product) => product.isFeatured);
  const topLevelCategories = fetchedCategories.filter((category) => !category.parentCategory);
  const topLevelCollections = fetchedCollections.filter((collection) => !collection.parentCollection);

  const now = new Date();
  const activeFlashSales = fetchedFlashSales.filter((sale) => {
    if (!sale.isActive) return false;
    const start = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
    const end = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
    return now >= start && now <= end;
  });

  const flashSaleProductIds = new Set<string>();
  activeFlashSales.forEach((sale) => {
    sale.productIds.forEach((productId) => flashSaleProductIds.add(productId));
  });
  const flashSaleProducts = products.filter((product) => flashSaleProductIds.has(product.id));

  const reviewStats = buildReviewStats(fetchedReviews);
  const testimonials = fetchedReviews
    .filter((review) => Number(review.rating || 0) >= 4)
    .slice(0, 10)
    .map((review) => ({
      id: review.id || `${review.productId}-${review.userId}`,
      userName: review.userName || 'Customer',
      comment: review.comment || '',
      rating: Number(review.rating || 0),
      verifiedPurchase: Boolean(review.verifiedPurchase),
    }));

  const activeBundles = fetchedBundles
    .filter((bundle) => {
      if (!bundle.isActive) return false;
      if (bundle.validFrom?.toDate && bundle.validFrom.toDate() > now) return false;
      if (bundle.validUntil?.toDate && bundle.validUntil.toDate() < now) return false;
      return true;
    })
    .map((bundle) => {
      const computedOriginalPrice = bundle.products.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) return sum;
        const pricing = getProductPricingSummary(
          product as Product,
          settings?.goldPricing,
          settings?.goldPricing?.cache
        );
        return sum + pricing.currentPrice * (item.quantity || 1);
      }, 0);

      return {
        id: bundle.id || '',
        name: bundle.name,
        description: bundle.description,
        image: bundle.image,
        originalPrice: computedOriginalPrice,
        bundlePrice: bundle.bundlePrice || computedOriginalPrice,
        itemCount: bundle.products.length,
        discountType: bundle.discountType,
        discountValue: bundle.discountValue,
      };
    });

  const blogPosts = fetchedPosts.slice(0, 3).map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    title_ar: post.title_ar,
    excerpt: post.excerpt,
    excerpt_ar: post.excerpt_ar,
    coverImage: post.coverImage,
  }));

  return (
    <>
      {showHero ? <HomeHero /> : null}
      <HomeSectionViewportGate minHeightClass="min-h-[1200px]" rootMargin="320px">
        <HomeDeferredSectionsClient
          featuredProducts={toPlain(featuredProducts)}
          flashSaleProducts={toPlain(flashSaleProducts)}
          categories={toPlain(topLevelCategories)}
          allCategories={toPlain(fetchedCategories)}
          collections={toPlain(topLevelCollections)}
          bundles={toPlain(activeBundles)}
          testimonials={toPlain(testimonials)}
          posts={toPlain(blogPosts)}
          reviewStats={toPlain(reviewStats)}
          homepageSections={toPlain(homepageSections as HomepageSection[])}
        />
      </HomeSectionViewportGate>
    </>
  );
}
