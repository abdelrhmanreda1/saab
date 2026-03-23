import { Metadata } from 'next';
import BlogPostClient from './BlogPostClient';
import { getPostBySlug } from '@/lib/firestore/blog_db';
import { getBlogSEO, getSEOSettings } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { generateSEOMetadata } from '@/lib/utils/seo';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);

  const [settings, seoSettings, blogSEO] = await Promise.all([
    getSettings().catch(() => null),
    getSEOSettings().catch(() => null),
    post?.id ? getBlogSEO(post.id).catch(() => null) : Promise.resolve(null),
  ]);

  const globalSEO = seoSettings || settings?.seo;
  const siteLanguage = String(settings?.site?.language || 'ar').trim().toLowerCase();
  const title = post ? (siteLanguage === 'ar' && post.title_ar ? post.title_ar : post.title) : 'Blog Post';
  const description = post
    ? (siteLanguage === 'ar' && post.excerpt_ar ? post.excerpt_ar : post.excerpt || post.content)
    : 'Read this article.';

  return generateSEOMetadata({
    globalSEO,
    blogSEO,
    fallbackTitle: title,
    fallbackDescription: description,
    fallbackImage: post?.coverImage || blogSEO?.metaImage,
    url: `/blog/${slug}`,
    openGraphType: 'article',
    fallbackTitlePriority: 'high',
    fallbackDescriptionPriority: 'high',
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  return <BlogPostClient slug={slug} />;
}
