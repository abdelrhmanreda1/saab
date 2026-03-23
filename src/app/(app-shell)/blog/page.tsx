import { Metadata } from 'next';
import BlogPageClient from './BlogPageClient';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { pickFirstImage } from '@/lib/utils/metadata-images';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, seoSettings, pageSEO, posts] = await Promise.all([
    getSettings().catch(() => null),
    getSEOSettings().catch(() => null),
    getPageSEO('/blog').catch(() => null),
    getAllPosts(true).catch(() => []),
  ]);

  const globalSEO = seoSettings || settings?.seo;
  const companyName = settings?.company?.name || 'Store';

  const blogImage = pickFirstImage(
    ...posts
      .filter((post) => post.isPublished !== false)
      .map((post) => post.coverImage)
  );

  return generateSEOMetadata({
    globalSEO,
    pageSEO,
    fallbackTitle: `المدونة | ${companyName}`,
    fallbackDescription: 'اكتشف المقالات والأدلة والنصائح المفيدة من متجرنا.',
    fallbackImage: pickFirstImage(pageSEO?.metaImage, blogImage),
    url: '/blog',
    fallbackTitlePriority: 'high',
    fallbackDescriptionPriority: 'high',
  });
}

export default function BlogPage() {
  return <BlogPageClient />;
}
