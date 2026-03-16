import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug, getAllPosts } from '@/lib/firestore/blog_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getBlogSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { getBaseUrl } from '@/lib/utils/url';

export const dynamic = 'force-dynamic';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || !post.isPublished) {
    return {
      title: 'Post Not Found',
      description: 'The blog post you are looking for does not exist.',
    };
  }

  const baseUrl = getBaseUrl();
  const postTitle = post.title || '';
  const postExcerpt = post.excerpt || '';
  const postCoverImage = post.coverImage;

  try {
    const [settings, seoSettings, blogSEO] = await Promise.all([
      getSettings(),
      getSEOSettings(),
      getBlogSEO(post.id),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      blogSEO,
      fallbackTitle: `${postTitle} | ${companyName}`,
      fallbackDescription: postExcerpt,
      fallbackImage: postCoverImage,
      url: `${baseUrl}/blog/${slug}`,
    });
  } catch {
    // Failed to generate blog post metadata
    const settings = await getSettings();
    const companyName = settings?.company?.name || '';
    return {
      title: `${postTitle} | ${companyName}`,
      description: postExcerpt,
      openGraph: {
        title: `${postTitle} | ${companyName}`,
        description: postExcerpt,
        url: `${baseUrl}/blog/${slug}`,
        ...(postCoverImage && {
          images: [
            {
              url: postCoverImage.startsWith('http') ? postCoverImage : `${baseUrl}${postCoverImage}`,
              width: 1200,
              height: 630,
              alt: postTitle,
            },
          ],
        }),
      },
    };
  }
}

const BlogPostPage = async ({ params }: BlogPostPageProps) => {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || !post.isPublished) {
    notFound();
  }

  // Get related posts (exclude current post)
  const allPosts = await getAllPosts(true);
  const relatedPosts = allPosts
    .filter(p => p.id !== post.id)
    .slice(0, 3);

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Back Button */}
      <div className="page-container pt-6 pb-4">
        <Link 
          href="/blog"
          className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Blog
        </Link>
      </div>

      <article className="page-container max-w-3xl">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
            <span>{post.publishedAt ? post.publishedAt.toDate().toLocaleDateString() : 'Recent'}</span>
            <span>•</span>
            <span>{post.author}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 leading-tight mb-4">
            {post.title}
          </h1>
          {post.coverImage && (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-50 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={post.coverImage} 
                alt={post.title} 
                className="object-cover w-full h-full"
              />
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose prose-sm max-w-none">
          <div 
            className="quill-content text-xs leading-relaxed text-gray-700 prose-headings:font-heading prose-headings:font-semibold prose-headings:text-gray-900 prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-img:rounded-lg prose-img:my-4 prose-a:text-gray-900 prose-a:underline hover:prose-a:text-gray-600"
            dangerouslySetInnerHTML={{ __html: post.content || '' }}
          />
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Related Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedPosts.map((relatedPost) => (
                <Link 
                  href={`/blog/${relatedPost.slug}`} 
                  key={relatedPost.id}
                  className="group block"
                >
                  <article className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all">
                    {relatedPost.coverImage && (
                      <div className="aspect-[16/9] relative overflow-hidden bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={relatedPost.coverImage} 
                          alt={relatedPost.title} 
                          className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="text-xs font-semibold text-gray-900 mb-1 group-hover:text-gray-600 transition-colors line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {relatedPost.publishedAt?.toDate ? relatedPost.publishedAt.toDate().toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

export default BlogPostPage;
