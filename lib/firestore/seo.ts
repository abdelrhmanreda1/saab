import { Timestamp } from 'firebase/firestore';

export interface SEOSettings {
  id?: string;
  // Global SEO Settings
  siteTitle: string;
  siteDescription: string;
  siteKeywords: string[];
  defaultMetaImage?: string;
  
  // Open Graph Settings
  ogSiteName: string;
  ogLocale: string;
  ogDefaultImage?: string;
  
  // Twitter Card Settings
  twitterCard: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterSite?: string;
  twitterCreator?: string;
  
  // Schema.org Structured Data
  organizationName: string;
  organizationLogo?: string;
  organizationUrl: string;
  
  // Robots & Sitemap
  robotsTxt?: string;
  sitemapEnabled: boolean;
  sitemapUrl?: string;
  
  // Analytics
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  
  // Verification
  googleVerificationCode?: string;
  bingVerificationCode?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PageSEO {
  id?: string;
  pagePath: string; // e.g., '/', '/shop', '/products/[id]'
  title?: string;
  description?: string;
  keywords?: string[];
  metaImage?: string;
  canonicalUrl?: string;
  noIndex: boolean;
  noFollow: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductSEO {
  id?: string;
  productId: string;
  title?: string;
  description?: string;
  keywords?: string[];
  metaImage?: string;
  canonicalUrl?: string;
  noIndex: boolean;
  noFollow: boolean;
  structuredData?: Record<string, unknown>; // JSON-LD structured data
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CategorySEO {
  id?: string;
  categoryId: string;
  title?: string;
  description?: string;
  keywords?: string[];
  metaImage?: string;
  canonicalUrl?: string;
  noIndex: boolean;
  noFollow: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BrandSEO {
  id?: string;
  brandId: string;
  title?: string;
  description?: string;
  keywords?: string[];
  metaImage?: string;
  canonicalUrl?: string;
  noIndex: boolean;
  noFollow: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CollectionSEO {
  id?: string;
  collectionId: string;
  title?: string;
  description?: string;
  keywords?: string[];
  metaImage?: string;
  canonicalUrl?: string;
  noIndex: boolean;
  noFollow: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BlogSEO {
  id?: string;
  blogPostId: string;
  title?: string;
  description?: string;
  keywords?: string[];
  metaImage?: string;
  canonicalUrl?: string;
  noIndex: boolean;
  noFollow: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

