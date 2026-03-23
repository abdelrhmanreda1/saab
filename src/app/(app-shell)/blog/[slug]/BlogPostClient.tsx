'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug, getAllPosts } from '@/lib/firestore/blog_db';
import { BlogPost } from '@/lib/firestore/blog';
import { useLanguage } from '@/context/LanguageContext';

const getBlogTitle = (post: BlogPost, lang: string) => {
  if (lang === 'ar' && post.title_ar) return post.title_ar;
  return post.title;
};

const getBlogContent = (post: BlogPost, lang: string) => {
  if (lang === 'ar' && post.content_ar) return post.content_ar;
  return post.content;
};

export default function BlogPostClient({ slug }: { slug: string }) {
  const { t, currentLanguage } = useLanguage();
  const langCode = String(currentLanguage?.code || 'ar').trim().toLowerCase();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const fetchedPost = await getPostBySlug(slug);
        if (!fetchedPost || !fetchedPost.isPublished) {
          setNotFoundState(true);
          return;
        }

        setPost(fetchedPost);
        const allPosts = await getAllPosts(true);
        setRelatedPosts(allPosts.filter((p) => p.id !== fetchedPost.id).slice(0, 3));
      } catch {
        setNotFoundState(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [slug]);

  if (notFoundState) {
    notFound();
  }

  if (loading || !post) {
    return <div className="bg-white min-h-screen pb-20" />;
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="page-container pt-6 pb-4">
        <Link href="/blog" className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('blog.back_to_blog') || 'Back to Blog'}
        </Link>
      </div>

      <article className="page-container max-w-3xl">
        <header className="mb-6">
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
            <span>{post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString(langCode === 'ar' ? 'ar-SA' : 'en-US') : (t('blog.recent') || 'Recent')}</span>
            <span>•</span>
            <span>{post.author}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 leading-tight mb-4">
            {getBlogTitle(post, langCode)}
          </h1>
          {post.coverImage ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-50 mb-6">
              <Image src={post.coverImage} alt={getBlogTitle(post, langCode)} fill priority sizes="(max-width: 1024px) 100vw, 896px" className="object-cover" />
            </div>
          ) : null}
        </header>

        <div className="prose prose-sm max-w-none">
          <div
            className="quill-content text-xs leading-relaxed text-gray-700 prose-headings:font-heading prose-headings:font-semibold prose-headings:text-gray-900 prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-img:rounded-lg prose-img:my-4 prose-a:text-gray-900 prose-a:underline hover:prose-a:text-gray-600"
            dangerouslySetInnerHTML={{ __html: getBlogContent(post, langCode) || '' }}
          />
        </div>

        {relatedPosts.length > 0 ? (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {t('blog.related_posts') || 'Related Posts'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedPosts.map((relatedPost) => (
                <Link href={`/blog/${relatedPost.slug}`} key={relatedPost.id} className="group block">
                  <article className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all">
                    {relatedPost.coverImage ? (
                      <div className="aspect-[16/9] relative overflow-hidden bg-gray-50">
                        <Image src={relatedPost.coverImage} alt={getBlogTitle(relatedPost, langCode)} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    ) : null}
                    <div className="p-4">
                      <h3 className="text-xs font-semibold text-gray-900 mb-1 group-hover:text-gray-600 transition-colors line-clamp-2">
                        {getBlogTitle(relatedPost, langCode)}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {relatedPost.publishedAt?.toDate ? relatedPost.publishedAt.toDate().toLocaleDateString(langCode === 'ar' ? 'ar-SA' : 'en-US') : (t('blog.recent') || 'Recent')}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
