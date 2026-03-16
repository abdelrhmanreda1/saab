import { getProductBySlug } from '@/lib/firestore/products_db';
import { getSEOSettings, getProductSEO } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getBaseUrl } from '@/lib/utils/url';

type ProductSocialMetadataOptions = {
  productSlug: string;
  pagePath: string;
  fallbackDescriptionPrefix: string;
};

export type ProductSocialMetadata = {
  title: string;
  description: string;
  imageUrl?: string;
  pageUrl: string;
  siteName: string;
};

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
  const baseUrl = getBaseUrl();
  return value.startsWith('http') ? value : `${baseUrl}${value}`;
};

export async function getProductSocialMetadata(
  options: ProductSocialMetadataOptions
): Promise<ProductSocialMetadata | null> {
  const { productSlug, pagePath, fallbackDescriptionPrefix } = options;
  const product = await getProductBySlug(productSlug).catch(() => null);

  if (!product) {
    return null;
  }

  const [settings, seoSettings, productSEO] = await Promise.all([
    getSettings().catch(() => null),
    getSEOSettings().catch(() => null),
    getProductSEO(product.id).catch(() => null),
  ]);

  const baseUrl = getBaseUrl();
  const siteName =
    seoSettings?.ogSiteName ||
    settings?.seo?.ogSiteName ||
    settings?.company?.name ||
    'Pardah';

  const title = productSEO?.title || product.name;
  const description = normalizeDescription(
    productSEO?.description ||
      product.description ||
      `${fallbackDescriptionPrefix} ${product.name} on ${siteName}.`
  );
  const imageUrl = toAbsoluteUrl(
    productSEO?.metaImage ||
      product.images?.[0] ||
      seoSettings?.defaultMetaImage ||
      seoSettings?.ogDefaultImage ||
      settings?.seo?.defaultMetaImage ||
      settings?.seo?.ogDefaultImage
  );

  return {
    title,
    description,
    imageUrl,
    pageUrl: `${baseUrl}${pagePath}`,
    siteName,
  };
}
