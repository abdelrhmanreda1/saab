import { getPostBySlug } from '@/lib/firestore/blog_db';
import { getPageBySlug } from '@/lib/firestore/pages_db';
import { getPageSEO, getBlogSEO, getSEOSettings } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { getBaseUrl } from '@/lib/utils/url';

export type SocialMetadata = {
  title: string;
  description: string;
  imageUrl?: string;
  pageUrl: string;
  siteName: string;
};

const normalizeText = (value?: string): string => {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const normalizeDescription = (value?: string): string => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.length > 200 ? `${normalized.slice(0, 197).trim()}...` : normalized;
};

const toAbsoluteUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  const baseUrl = getBaseUrl();
  return value.startsWith('http') ? value : `${baseUrl}${value}`;
};

const getPreferredFallbackImage = async (): Promise<string | undefined> => {
  const banners = await getAllBanners().catch(() => []);
  const activeBanner = banners.find((banner) => banner.isActive && banner.imageUrl);
  return activeBanner?.imageUrl;
};

const getSiteName = async () => {
  const [settings, seoSettings, bannerImage] = await Promise.all([
    getSettings().catch(() => null),
    getSEOSettings().catch(() => null),
    getPreferredFallbackImage(),
  ]);

  return {
    settings,
    seoSettings,
    siteName:
      seoSettings?.ogSiteName ||
      settings?.seo?.ogSiteName ||
      settings?.company?.name ||
      'Pardah',
    defaultImage:
      bannerImage ||
      seoSettings?.defaultMetaImage ||
      seoSettings?.ogDefaultImage ||
      settings?.seo?.defaultMetaImage ||
      settings?.seo?.ogDefaultImage,
    siteLanguage: String(settings?.site?.language || 'ar').trim().toLowerCase(),
  };
};

export async function getBlogPostSocialMetadata(slug: string): Promise<SocialMetadata | null> {
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post || !post.isPublished) {
    return null;
  }

  const { siteName, defaultImage, siteLanguage } = await getSiteName();
  const blogSEO = post.id ? await getBlogSEO(post.id).catch(() => null) : null;
  const useArabic = siteLanguage === 'ar';
  const title = blogSEO?.title || (useArabic && post.title_ar ? post.title_ar : post.title);
  const description = normalizeDescription(
    blogSEO?.description ||
      (useArabic && post.excerpt_ar ? post.excerpt_ar : post.excerpt) ||
      (useArabic && post.content_ar ? post.content_ar : post.content)
  );

  return {
    title,
    description,
    imageUrl: toAbsoluteUrl(blogSEO?.metaImage || post.coverImage || defaultImage),
    pageUrl: `${getBaseUrl()}/blog/${slug}`,
    siteName,
  };
}

export async function getBlogIndexSocialMetadata(): Promise<SocialMetadata> {
  const { siteName, defaultImage } = await getSiteName();
  const pageSEO = await getPageSEO('/blog').catch(() => null);

  return {
    title: pageSEO?.title || `${siteName} Blog`,
    description: normalizeDescription(
      pageSEO?.description || 'Discover guides, updates, and useful articles from our store.'
    ),
    imageUrl: toAbsoluteUrl(pageSEO?.metaImage || defaultImage),
    pageUrl: `${getBaseUrl()}/blog`,
    siteName,
  };
}

export async function getCmsPageSocialMetadata(options: {
  slug: string;
  pagePath: string;
  fallbackTitle: string;
  fallbackDescription: string;
}): Promise<SocialMetadata> {
  const { slug, pagePath, fallbackTitle, fallbackDescription } = options;
  const { siteName, defaultImage, siteLanguage } = await getSiteName();
  const [pageSEO, page] = await Promise.all([
    getPageSEO(pagePath).catch(() => null),
    getPageBySlug(slug).catch(() => null),
  ]);

  const translations = page?.translations || [];
  const translation =
    translations.find((item) => String(item.languageCode || '').trim().toLowerCase() === siteLanguage) ||
    translations.find((item) => String(item.languageCode || '').trim().toLowerCase() === 'en') ||
    translations[0];

  const title = pageSEO?.title || translation?.metaTitle || translation?.title || fallbackTitle;
  const description = normalizeDescription(
    pageSEO?.description ||
      translation?.metaDescription ||
      translation?.content ||
      fallbackDescription
  );

  return {
    title,
    description,
    imageUrl: toAbsoluteUrl(pageSEO?.metaImage || defaultImage),
    pageUrl: `${getBaseUrl()}${pagePath}`,
    siteName,
  };
}

export async function getRouteSocialMetadata(options: {
  pagePath: string;
  fallbackTitle: string;
  fallbackDescription: string;
}): Promise<SocialMetadata> {
  const { pagePath, fallbackTitle, fallbackDescription } = options;
  const { siteName, defaultImage } = await getSiteName();
  const pageSEO = await getPageSEO(pagePath).catch(() => null);

  return {
    title: pageSEO?.title || fallbackTitle,
    description: normalizeDescription(pageSEO?.description || fallbackDescription),
    imageUrl: toAbsoluteUrl(pageSEO?.metaImage || defaultImage),
    pageUrl: `${getBaseUrl()}${pagePath}`,
    siteName,
  };
}
