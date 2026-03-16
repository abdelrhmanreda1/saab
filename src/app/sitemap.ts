import { MetadataRoute } from 'next';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings } from '@/lib/firestore/seo_db';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllBrands } from '@/lib/firestore/brands_db';
import { getAllCollections } from '@/lib/firestore/collections_db';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { getAllPages } from '@/lib/firestore/pages_db';
import { getBaseUrl } from '@/lib/utils/url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // Get settings to check if sitemap is enabled
    const [settings, seoSettings] = await Promise.all([
      getSettings().catch(() => null),
      getSEOSettings().catch(() => null),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    
    // Check if sitemap is enabled
    if (globalSEO?.sitemapEnabled === false) {
      // Return empty sitemap if disabled
      return [];
    }

    // Get base URL
    const baseUrl = settings?.company?.website 
      ? (settings.company.website.startsWith('http') ? settings.company.website : `https://${settings.company.website}`)
      : getBaseUrl();

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/shop`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/categories`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/brands`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/blog`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/product-bundles`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/flash`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/contact`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/faq`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date(),
        changeFrequency: 'yearly',
        priority: 0.3,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date(),
        changeFrequency: 'yearly',
        priority: 0.3,
      },
      {
        url: `${baseUrl}/shipping-returns`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
      },
      {
        url: `${baseUrl}/size-guide`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
      },
      {
        url: `${baseUrl}/store-locator`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
    ];

    // Fetch dynamic content
    const [products, categories, brands, collections, blogPosts, pages] = await Promise.all([
      getAllProducts().catch(() => []),
      getAllCategories().catch(() => []),
      getAllBrands().catch(() => []),
      getAllCollections().catch(() => []),
      getAllPosts(true).catch(() => []), // Only published posts
      getAllPages().catch(() => []),
    ]);

    // Product pages
    const productPages: MetadataRoute.Sitemap = products
      // Only include active products with a valid slug
      .filter(product => product.isActive !== false && product.slug)
      .map(product => ({
        url: `${baseUrl}/products/${product.slug || product.id}`,
        lastModified: product.updatedAt?.toDate ? product.updatedAt.toDate() : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

    // Category pages
    const categoryPages: MetadataRoute.Sitemap = categories
      .filter(category => category.slug)
      .map(category => ({
        url: `${baseUrl}/categories/${category.slug || category.id}`,
        lastModified: category.updatedAt?.toDate ? category.updatedAt.toDate() : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));

    // Brand filter pages (using shop with brand query param)
    const brandPages: MetadataRoute.Sitemap = brands
      .filter(brand => brand.slug)
      .map(brand => ({
        url: `${baseUrl}/shop?brand=${brand.slug || brand.id}`,
        lastModified: brand.updatedAt?.toDate ? brand.updatedAt.toDate() : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));

    // Collection filter pages (using shop with collection query param)
    const collectionPages: MetadataRoute.Sitemap = collections
      .filter(collection => collection.slug)
      .map(collection => ({
        url: `${baseUrl}/shop?collection=${collection.slug || collection.id}`,
        lastModified: collection.updatedAt?.toDate ? collection.updatedAt.toDate() : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));

    // Blog post pages
    const blogPages: MetadataRoute.Sitemap = blogPosts
      .filter(post => post.slug && post.isPublished)
      .map(post => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.publishedAt?.toDate ? post.publishedAt.toDate() : post.updatedAt?.toDate ? post.updatedAt.toDate() : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));

    // Custom pages
    const customPages: MetadataRoute.Sitemap = pages
      .filter(page => page.slug && page.isActive !== false)
      .map(page => ({
        url: `${baseUrl}/${page.slug}`,
        lastModified: page.updatedAt?.toDate ? page.updatedAt.toDate() : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }));

    // Combine all sitemap entries
    return [
      ...staticPages,
      ...productPages,
      ...categoryPages,
      ...brandPages,
      ...collectionPages,
      ...blogPages,
      ...customPages,
    ];
  } catch (error) {
    // If sitemap generation fails, return at least the homepage
    const baseUrl = getBaseUrl();
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
    ];
  }
}

