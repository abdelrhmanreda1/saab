'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <h1 className="text-9xl md:text-[12rem] font-heading font-bold text-gray-200 mb-4">
            404
          </h1>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-4">
            {t('404.title') || 'Page Not Found'}
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            {t('404.message') || "The page you are looking for doesn't exist or has been moved."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/"
            className="px-6 py-3 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors"
          >
            {t('404.go_home') || 'Go to Homepage'}
          </Link>
          <Link
            href="/shop"
            className="px-6 py-3 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('404.continue_shopping') || 'Continue Shopping'}
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-md mx-auto">
          <Link href="/shop" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t('common.shop') || 'Shop'}
          </Link>
          <Link href="/categories" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t('common.categories') || 'Categories'}
          </Link>
          <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t('common.blog') || 'Blog'}
          </Link>
          <Link href="/contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t('common.contact') || 'Contact'}
          </Link>
        </div>
      </div>
    </div>
  );
}

