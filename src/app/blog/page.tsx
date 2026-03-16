import React, { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, pageSEO] = await Promise.all([
      getSettings(),
      getSEOSettings(),
      getPageSEO('/blog'),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || '';

    return generateSEOMetadata({
      globalSEO,
      pageSEO,
      fallbackTitle: `Blog | ${companyName}`,
      fallbackDescription: 'Read our latest news and fashion tips.',
      url: '/blog',
    });
  } catch {
    // Failed to generate blog metadata
    return {
      title: 'Blog',
      description: 'Read our latest news and fashion tips.',
    };
  }
}

export const dynamic = 'force-dynamic';

async function BlogPostsContent() {
  const [posts, settings] = await Promise.all([
    getAllPosts(true),
    getSettings()
  ]);
  
  // Check if blog feature is enabled
  if (!settings?.features?.blog) {
    return (
      <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">Blog Not Available</h1>
          <p className="text-sm text-gray-500">This feature is currently disabled.</p>
        </div>
      </div>
      </div>
    );
  }
  
  const companyName = settings?.company?.name || '';

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">Our Blog</h1>
          <p className="text-sm text-gray-500">Stay updated with the latest trends, styling tips, and news from {companyName || 'us'}.</p>
        </div>
      </div>

      <div className="page-container">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-1">No posts yet</h3>
            <p className="text-xs text-gray-500">Check back soon for our first blog post!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <Link href={`/blog/${post.slug}`} key={post.id} className="group block">
                <article className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all h-full flex flex-col">
                  <div className="aspect-[16/9] relative overflow-hidden bg-gray-50">
                    {post.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={post.coverImage} 
                        alt={post.title} 
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span>{post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString() : 'Recent'}</span>
                      <span>•</span>
                      <span>{post.author}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-2 group-hover:text-gray-600 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-xs text-gray-600 line-clamp-3 mb-3 flex-grow leading-relaxed">
                      {post.excerpt}
                    </p>
                    <div className="mt-auto text-xs font-medium text-gray-900 underline underline-offset-2">
                      Read More →
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function BlogPage() {
  return (
    <Suspense fallback={
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">Our Blog</h1>
            <p className="text-sm text-gray-500">Stay updated with the latest trends, styling tips, and news from us.</p>
          </div>
        </div>
        <div className="page-container py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                  <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <BlogPostsContent />
    </Suspense>
  );
}
