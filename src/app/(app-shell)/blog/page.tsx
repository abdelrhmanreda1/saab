import { Metadata } from 'next';
import BlogPageClient from './BlogPageClient';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { generateSEOMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, seoSettings, pageSEO] = await Promise.all([
    getSettings().catch(() => null),
    getSEOSettings().catch(() => null),
    getPageSEO('/blog').catch(() => null),
  ]);

  const globalSEO = seoSettings || settings?.seo;
  const companyName = settings?.company?.name || 'Store';

  return generateSEOMetadata({
    globalSEO,
    pageSEO,
    fallbackTitle: `Blog | ${companyName}`,
    fallbackDescription: 'Discover guides, updates, and useful articles from our store.',
    fallbackImage: pageSEO?.metaImage,
    url: '/blog',
    fallbackTitlePriority: 'high',
    fallbackDescriptionPriority: 'high',
  });
}

export default function BlogPage() {
  return <BlogPageClient />;
}
