'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAllPosts } from '@/lib/firestore/blog_db';
import { BlogPost } from '@/lib/firestore/blog';
import { useLanguage } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';

const getBlogTitle = (post: BlogPost, lang: string) => {
  if (lang === 'ar' && post.title_ar) return post.title_ar;
  return post.title;
};

const getBlogExcerpt = (post: BlogPost, lang: string) => {
  if (lang === 'ar' && post.excerpt_ar) return post.excerpt_ar;
  return post.excerpt;
};

function BlogPostsContent() {
  const { t, currentLanguage } = useLanguage();
  const { settings } = useSettings();
  const langCode = String(currentLanguage?.code || 'ar').trim().toLowerCase();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const fetched = await getAllPosts(true);
        setPosts(fetched);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
              {t('blog.title') || 'Our Blog'}
            </h1>
            <p className="text-sm text-gray-500">
              {t('blog.subtitle') || 'Stay updated with the latest trends, styling tips, and news.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings?.features?.blog) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
              {t('blog.not_available') || 'Blog Not Available'}
            </h1>
            <p className="text-sm text-gray-500">
              {t('blog.feature_disabled') || 'This feature is currently disabled.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {t('blog.title') || 'Our Blog'}
          </h1>
          <p className="text-sm text-gray-500">
            {t('blog.subtitle') || 'Stay updated with the latest trends, styling tips, and news.'}
          </p>
        </div>
      </div>

      <div className="page-container">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {t('blog.no_posts') || 'No posts yet'}
            </h3>
            <p className="text-xs text-gray-500">
              {t('blog.check_back') || 'Check back soon for our first blog post!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <Link href={`/blog/${post.slug}`} key={post.id} className="group block">
                <article className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all h-full flex flex-col">
                  <div className="aspect-[16/9] relative overflow-hidden bg-gray-50">
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt={getBlogTitle(post, langCode)}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        {t('common.no_image') || 'No Image'}
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span>{post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString(langCode === 'ar' ? 'ar-SA' : 'en-US') : (t('blog.recent') || 'Recent')}</span>
                      <span>•</span>
                      <span>{post.author}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-2 group-hover:text-gray-600 transition-colors line-clamp-2">
                      {getBlogTitle(post, langCode)}
                    </h2>
                    <p className="text-xs text-gray-600 line-clamp-3 mb-3 flex-grow leading-relaxed">
                      {getBlogExcerpt(post, langCode)}
                    </p>
                    <div className="mt-auto text-xs font-medium text-gray-900 underline underline-offset-2">
                      {t('blog.read_more') || 'Read More'} →
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
}

export default function BlogPageClient() {
  return (
    <Suspense fallback={<div className="bg-white min-h-screen pb-20" />}>
      <BlogPostsContent />
    </Suspense>
  );
}
