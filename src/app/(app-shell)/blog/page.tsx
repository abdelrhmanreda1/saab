import { Metadata } from 'next';
import BlogPageClient from './BlogPageClient';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { getAllBanners } from '@/lib/firestore/banners_db';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, seoSettings, pageSEO, banners] = await Promise.all([
    getSettings().catch(() => null),
    getSEOSettings().catch(() => null),
    getPageSEO('/blog').catch(() => null),
    getAllBanners().catch(() => []),
  ]);

  const activeBannerImage = banners.find((banner) => banner.isActive && banner.imageUrl)?.imageUrl;
  const globalSEO = seoSettings || settings?.seo;
  const companyName = settings?.company?.name || 'Store';

  return generateSEOMetadata({
    globalSEO,
    pageSEO,
    fallbackTitle: `Blog | ${companyName}`,
    fallbackDescription: 'Discover guides, updates, and useful articles from our store.',
    fallbackImage: activeBannerImage,
    url: '/blog',
    fallbackTitlePriority: 'high',
    fallbackDescriptionPriority: 'high',
  });
}

export default function BlogPage() {
  return <BlogPageClient />;
}
