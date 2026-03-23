import { Metadata } from 'next';
import BlogPageClient from './BlogPageClient';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { BlogPost } from '@/lib/firestore/blog';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { pickFirstImage } from '@/lib/utils/metadata-images';
import { Timestamp } from 'firebase/firestore';

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

interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
}

interface SerializedBlogPost extends Omit<BlogPost, 'createdAt' | 'updatedAt' | 'publishedAt'> {
  createdAt?: SerializedTimestamp | null;
  updatedAt?: SerializedTimestamp | null;
  publishedAt?: SerializedTimestamp | null;
}

const serializeTimestamp = (
  timestamp:
    | Timestamp
    | { seconds: number; nanoseconds: number }
    | { toDate: () => Date }
    | null
    | undefined
): SerializedTimestamp | null => {
  if (!timestamp) return null;

  if (timestamp instanceof Timestamp) {
    return {
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds,
    };
  }

  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000,
    };
  }

  if (typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
    return {
      seconds: Number(timestamp.seconds),
      nanoseconds: Number(timestamp.nanoseconds),
    };
  }

  return null;
};

const serializePosts = (posts: BlogPost[]): SerializedBlogPost[] =>
  posts.map((post) => ({
    ...post,
    createdAt: serializeTimestamp(post.createdAt),
    updatedAt: serializeTimestamp(post.updatedAt),
    publishedAt: serializeTimestamp(post.publishedAt),
  }));

export default async function BlogPage() {
  const posts = await getAllPosts(true).catch(() => []);
  return <BlogPageClient initialPosts={serializePosts(posts)} />;
}
