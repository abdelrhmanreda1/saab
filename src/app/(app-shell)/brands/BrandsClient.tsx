'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Brand } from '@/lib/firestore/brands';
import { useLanguage } from '@/context/LanguageContext';
import { getBrandName, getBrandDescription } from '@/lib/utils/translations';
import SkeletonLoader from '@/components/SkeletonLoader';

interface SerializedBrand extends Omit<Brand, 'createdAt' | 'updatedAt' | 'translations'> {
  createdAt: { seconds: number; nanoseconds: number } | null;
  updatedAt: { seconds: number; nanoseconds: number } | null;
  translations?: Array<{
    languageCode: string;
    name: string;
    description?: string;
    updatedAt: { seconds: number; nanoseconds: number } | null;
  }>;
}

interface BrandsClientProps {
  brands: SerializedBrand[];
}

const BrandsClient: React.FC<BrandsClientProps> = ({ brands }) => {
  const { currentLanguage, t } = useLanguage();
  const languageCode = currentLanguage?.code || 'en';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filter brands based on search
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    
    const query = searchQuery.toLowerCase();
    return brands.filter(brand => {
      const name = getBrandName(brand, languageCode).toLowerCase();
      const description = getBrandDescription(brand, languageCode)?.toLowerCase() || '';
      return name.includes(query) || description.includes(query);
    });
  }, [brands, searchQuery, languageCode]);

  // Loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    setTimeout(() => {
      setIsLoading(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [filteredBrands]);

  // Intersection Observer for animations
  useEffect(() => {
    const allSections = document.querySelectorAll('[data-section-id]');
    const allSectionIds = Array.from(allSections).map(section => section.getAttribute('data-section-id')).filter(Boolean) as string[];
    if (allSectionIds.length > 0) {
      setTimeout(() => {
        setVisibleSections(new Set(allSectionIds));
      }, 0);
    }

    const observerOptions = {
      root: null,
      rootMargin: '-50px 0px',
      threshold: 0.1,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setVisibleSections((prev) => {
              if (prev.has(sectionId)) return prev;
              return new Set(prev).add(sectionId);
            });
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    const timeoutId = setTimeout(() => {
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => observer.observe(section));
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => observer.unobserve(section));
    };
  }, [filteredBrands.length]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section 
        data-section-id="hero"
        className={`w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 py-12 md:py-16 border-b border-gray-200 transition-all duration-700 ${
          visibleSections.has('hero') ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 mb-4 leading-tight">
            {t('brands.title')}
          </h1>
          <p className="text-base md:text-lg text-gray-700 max-w-2xl mx-auto leading-relaxed">
            {t('brands.subtitle')}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="page-container pt-4 md:pt-6 pb-8 md:pb-12">
        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-6 md:mb-8" />

        {/* Search & View Toggle */}
        <div 
          data-section-id="controls"
          className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 pb-4 border-b border-gray-200 transition-all duration-700 ${
            visibleSections.has('controls') ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="flex-1 w-full md:max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder={t('brands.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-colors"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">
              {filteredBrands.length} {filteredBrands.length === 1 ? t('brands.brand') : t('brands.brands')}
            </span>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-md p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Grid View"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0112.75 6v2.25A2.25 2.25 0 0110.5 10.5H8.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="List View"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Brands Grid/List */}
        {isLoading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'space-y-4'}>
            <SkeletonLoader type="product" count={8} />
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-200">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="text-2xl font-heading font-bold text-gray-900 mb-3">{t('brands.no_brands_found')}</h3>
            <p className="text-gray-600 mb-2 text-center max-w-md">
              {searchQuery ? t('brands.try_adjusting_search') : t('brands.no_brands_available')}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors mt-4"
              >
                {t('brands.clear_search')}
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div 
            data-section-id="brands-grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {filteredBrands.map((brand, index) => {
              const brandName = getBrandName(brand, languageCode);
              return (
                <Link 
                  key={brand.id} 
                  href={`/shop?brand=${brand.slug}`} 
                  className="group block"
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-gray-300 transition-all duration-300 hover:-translate-y-2 p-6">
                    <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center p-8 mb-4">
                      {brand.logoUrl ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={brand.logoUrl}
                            alt={brandName}
                            fill
                            className="object-contain group-hover:scale-110 transition-transform duration-700"
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <span className="text-2xl md:text-3xl font-heading font-bold">{brandName.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <h2 className="text-lg md:text-xl font-heading font-bold text-gray-900 mb-1 group-hover:text-gray-600 transition-colors leading-tight">
                        {brandName}
                      </h2>
                      {getBrandDescription(brand, languageCode) && (
                        <p className="text-xs md:text-sm text-gray-700 line-clamp-2 leading-relaxed">
                          {getBrandDescription(brand, languageCode)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div 
            data-section-id="brands-list"
            className="space-y-4"
          >
            {filteredBrands.map((brand) => {
              const brandName = getBrandName(brand, languageCode);
              return (
                <Link 
                  key={brand.id} 
                  href={`/shop?brand=${brand.slug}`} 
                  className="group block"
                >
                  <div className="flex gap-6 bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-gray-300 hover:shadow-xl transition-all duration-300">
                    <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-8">
                      {brand.logoUrl ? (
                        <Image
                          src={brand.logoUrl}
                          alt={brandName}
                          fill
                          className="object-contain group-hover:scale-110 transition-transform duration-700"
                          sizes="(max-width: 768px) 128px, 160px"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <span className="text-2xl font-heading font-bold">{brandName.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h2 className="text-xl md:text-2xl font-heading font-bold text-gray-900 mb-2 group-hover:text-gray-600 transition-colors leading-tight">
                        {brandName}
                      </h2>
                      {getBrandDescription(brand, languageCode) && (
                        <p className="text-sm md:text-base text-gray-700 line-clamp-2 leading-relaxed">
                          {getBrandDescription(brand, languageCode)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mt-12 mb-8" />
      </div>
    </div>
  );
};

export default BrandsClient;

