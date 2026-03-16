import { Metadata } from 'next';
import { SEOSettings } from '../firestore/settings';
import { PageSEO, ProductSEO, CategorySEO, BrandSEO, CollectionSEO, BlogSEO } from '../firestore/seo';
import { getBaseUrl } from './url';

interface GenerateMetadataOptions {
  globalSEO?: SEOSettings | null;
  pageSEO?: PageSEO | null;
  productSEO?: ProductSEO | null;
  categorySEO?: CategorySEO | null;
  brandSEO?: BrandSEO | null;
  collectionSEO?: CollectionSEO | null;
  blogSEO?: BlogSEO | null;
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackImage?: string;
  url?: string;
  productName?: string;
  productDescription?: string;
  productImages?: string[];
  openGraphType?: string;
  fallbackTitlePriority?: 'low' | 'high';
  fallbackDescriptionPriority?: 'low' | 'high';
}

export function generateSEOMetadata(options: GenerateMetadataOptions): Metadata {
  const {
    globalSEO,
    pageSEO,
    productSEO,
    categorySEO,
    brandSEO,
    collectionSEO,
    blogSEO,
    fallbackTitle = '',
    fallbackDescription = '',
    fallbackImage,
    url,
    productImages = [],
    openGraphType = 'website',
    fallbackTitlePriority = 'low',
    fallbackDescriptionPriority = 'low',
  } = options;

  const baseUrl = getBaseUrl();

  const normalizeText = (value?: string): string => {
    if (!value) return '';

    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizeDescription = (value?: string): string => {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    return normalized.length > 200 ? `${normalized.slice(0, 197).trim()}...` : normalized;
  };

  const toAbsoluteUrl = (value?: string): string | undefined => {
    if (!value) return undefined;
    return value.startsWith('http') ? value : `${baseUrl}${value}`;
  };
  
  // Priority: Entity SEO > Page SEO > Global SEO > Fallback
  const entityTitle =
    productSEO?.title ||
    categorySEO?.title ||
    brandSEO?.title ||
    collectionSEO?.title ||
    blogSEO?.title;

  const entityDescription =
    productSEO?.description ||
    categorySEO?.description ||
    brandSEO?.description ||
    collectionSEO?.description ||
    blogSEO?.description;

  const title =
    entityTitle ||
    pageSEO?.title ||
    (fallbackTitlePriority === 'high' ? fallbackTitle : globalSEO?.siteTitle) ||
    (fallbackTitlePriority === 'high' ? globalSEO?.siteTitle : fallbackTitle) ||
    '';

  const description = normalizeDescription(
    entityDescription ||
      pageSEO?.description ||
      (fallbackDescriptionPriority === 'high' ? fallbackDescription : globalSEO?.siteDescription) ||
      (fallbackDescriptionPriority === 'high' ? globalSEO?.siteDescription : fallbackDescription) ||
      ''
  );

  const keywords = 
    productSEO?.keywords || 
    categorySEO?.keywords || 
    brandSEO?.keywords || 
    collectionSEO?.keywords ||
    blogSEO?.keywords ||
    pageSEO?.keywords || 
    globalSEO?.siteKeywords || 
    [];

  const metaImage = 
    productSEO?.metaImage || 
    categorySEO?.metaImage || 
    brandSEO?.metaImage || 
    collectionSEO?.metaImage ||
    blogSEO?.metaImage ||
    pageSEO?.metaImage || 
    (productImages.length > 0 ? productImages[0] : undefined) ||
    globalSEO?.defaultMetaImage || 
    globalSEO?.ogDefaultImage || 
    fallbackImage;

  const canonicalUrl = 
    productSEO?.canonicalUrl || 
    categorySEO?.canonicalUrl || 
    brandSEO?.canonicalUrl || 
    collectionSEO?.canonicalUrl ||
    blogSEO?.canonicalUrl ||
    pageSEO?.canonicalUrl || 
    url ||
    baseUrl;

  // Robots meta
  const robots = {
    index: !(productSEO || categorySEO || brandSEO || collectionSEO || blogSEO || pageSEO)?.noIndex,
    follow: !(productSEO || categorySEO || brandSEO || collectionSEO || blogSEO || pageSEO)?.noFollow,
  };

  // Open Graph
  const ogTitle = title;
  const ogDescription = description;
  const ogImage = toAbsoluteUrl(metaImage);
  const ogUrl = toAbsoluteUrl(canonicalUrl) || baseUrl;
  const ogSiteName = globalSEO?.ogSiteName || 'Pardah';
  const ogLocale = globalSEO?.ogLocale || 'en_US';

  // Twitter Card
  const twitterCard = globalSEO?.twitterCard || 'summary_large_image';
  const twitterSite = globalSEO?.twitterSite;
  const twitterCreator = globalSEO?.twitterCreator;

  const metadata: Metadata = {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    robots: robots.index && robots.follow ? undefined : {
      index: robots.index,
      follow: robots.follow,
    },
    alternates: {
      canonical: toAbsoluteUrl(canonicalUrl) || canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: ogUrl,
      siteName: ogSiteName,
      locale: ogLocale,
      type: openGraphType as never,
      ...(ogImage && {
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: ogTitle,
          },
        ],
      }),
    },
    twitter: {
      card: twitterCard,
      title: ogTitle,
      description: ogDescription,
      ...(ogImage && {
        images: [ogImage],
      }),
      ...(twitterSite && { site: twitterSite }),
      ...(twitterCreator && { creator: twitterCreator }),
    },
  };

  return metadata;
}

