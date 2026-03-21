'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { Banner } from '@/lib/firestore/banners';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FlashSale } from '@/lib/firestore/campaigns';
import {
  defaultHomepageSections,
  HomepageSectionId,
} from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import { getSafeImageUrl } from '@/lib/utils/image';

const CountdownTimer = dynamic(() => import('../components/CountdownTimer'), { ssr: false });
const HomeDeferredSections = dynamic(() => import('./HomeDeferredSections'), {
  ssr: false,
});

export default function Home() {
  const { t, currentLanguage } = useLanguage();
  const { settings } = useSettings();
  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();
  const isArabic = languageCode === 'ar';
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [homepageSections, setHomepageSections] = useState(defaultHomepageSections);
  const [loading, setLoading] = useState(true);
  const [shouldLoadDeferred, setShouldLoadDeferred] = useState(false);
  const deferredRef = useRef<HTMLDivElement | null>(null);

  const getHomepageSection = (id: HomepageSectionId) =>
    homepageSections.find((section) => section.id === id) ||
    defaultHomepageSections.find((section) => section.id === id);

  const isHomepageSectionEnabled = (id: HomepageSectionId) =>
    getHomepageSection(id)?.enabled ?? true;

  const getHomepageSectionOrder = (id: HomepageSectionId) =>
    getHomepageSection(id)?.order ?? 999;

  const getHomepageSectionTitle = (id: HomepageSectionId, fallbackTitle: string) =>
    getHomepageSection(id)?.title?.trim() || fallbackTitle;

  const getHomepageSectionSubtitle = (id: HomepageSectionId, fallbackSubtitle: string) =>
    getHomepageSection(id)?.subtitle?.trim() || fallbackSubtitle;

  const getBannerText = React.useCallback(
    (banner: Banner | undefined, field: 'title' | 'subtitle') => {
      if (!banner) return '';
      const normalize = (code?: string | null) => String(code || '').trim().toLowerCase();
      const tr = (banner.translations || []).find(
        (tl) => normalize(tl.languageCode) === normalize(languageCode)
      );
      const candidate = String((tr && tr[field]) || '');
      if (candidate.trim()) return candidate;
      return String(banner[field] || '');
    },
    [languageCode]
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;

    const intervalId = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
    }, 7000);

    return () => clearInterval(intervalId);
  }, [banners.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedBanners, flashSales, fetchedHomepageSections] = await Promise.all([
          getAllBanners(),
          getAllFlashSales(true),
          getHomepageSections().catch(() => defaultHomepageSections),
        ]);

        setHomepageSections(fetchedHomepageSections);

        const sortedBanners = fetchedBanners
          .filter((banner) => {
            if (!banner.isActive) return false;
            if (banner.deviceType === 'both') return true;
            if (isMobile && banner.deviceType === 'mobile') return true;
            if (!isMobile && banner.deviceType === 'desktop') return true;
            return false;
          })
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        setBanners(sortedBanners);

        const now = new Date();
        const validFlashSales = flashSales.filter((sale) => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        });

        setActiveFlashSales(validFlashSales);
      } catch {
        // Homepage should still render with static content if Firestore fails.
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isMobile]);

  useEffect(() => {
    if (shouldLoadDeferred) return;

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let observer: IntersectionObserver | null = null;

    const activate = () => setShouldLoadDeferred(true);

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (
        window as Window & {
          requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        }
      ).requestIdleCallback(() => activate(), { timeout: 1800 });
    } else {
      timeoutId = setTimeout(activate, 1200);
    }

    if (typeof window !== 'undefined' && deferredRef.current && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            activate();
            observer?.disconnect();
          }
        },
        { rootMargin: '400px 0px' }
      );
      observer.observe(deferredRef.current);
    }

    return () => {
      if (
        idleId !== null &&
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window
      ) {
        (
          window as Window & {
            cancelIdleCallback: (handle: number) => void;
          }
        ).cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [shouldLoadDeferred]);

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <div className={`relative w-full bg-gray-200 animate-pulse ${isMobile ? 'h-[520px]' : 'h-[760px]'}`} />
        <section className="bg-white border-b border-gray-100 py-6 md:py-8">
          <div className="page-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col md:flex-row items-center gap-3">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-200 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 flex flex-col">
      {isHomepageSectionEnabled('hero') && (
        <section
          data-section-id="hero"
          className={`relative w-full overflow-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e4_100%)] ${isMobile ? 'min-h-[520px]' : 'min-h-[760px]'}`}
          style={{ order: getHomepageSectionOrder('hero') }}
        >
          {banners.length > 0 ? (
            <div className="page-container py-4 md:py-6">
              <div className="relative overflow-hidden rounded-[2.25rem] border border-[#ead8ab] bg-[#f8f3e8] shadow-[0_30px_80px_rgba(115,84,28,0.12)]">
                <div className={`relative ${isMobile ? 'h-[520px]' : 'h-[680px]'}`}>
                  <div className="relative h-full w-full">
                    {banners.map((banner, index) => (
                      <div
                        key={banner.id}
                        className={`absolute inset-0 transition-opacity duration-500 ${
                          index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                      >
                        <Image
                          src={getSafeImageUrl(banner.imageUrl)}
                          alt={getBannerText(banner, 'title') || settings?.company?.name || ''}
                          fill
                          sizes="(max-width: 768px) 100vw, 92vw"
                          priority={index === 0}
                          loading={index === 0 ? 'eager' : 'lazy'}
                          fetchPriority={index === 0 ? 'high' : undefined}
                          quality={52}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-0 z-20 bg-[linear-gradient(90deg,rgba(249,244,231,0.92)_0%,rgba(249,244,231,0.72)_38%,rgba(34,24,8,0.08)_100%)]" />
                  <div className="absolute inset-0 z-20 bg-[radial-gradient(circle_at_top_left,rgba(234,198,111,0.30),transparent_28%)]" />

                  <div className="absolute inset-0 z-30 flex items-center">
                    <div className="w-full px-6 md:px-14">
                      <div className="max-w-2xl">
                        <span className="inline-flex items-center rounded-full border border-[#caa14d] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#9f7424] shadow-sm backdrop-blur">
                          {isArabic ? 'مجموعة ذهبية مختارة' : 'Curated Gold Collection'}
                        </span>
                        <h1
                          className="mt-5 text-4xl md:text-6xl lg:text-7xl font-heading font-bold mb-5 md:mb-8 leading-[1.05] tracking-tight"
                          style={{ color: banners[currentBannerIndex].titleColor || '#fff' }}
                        >
                          {getBannerText(banners[currentBannerIndex], 'title') ||
                            getHomepageSectionTitle(
                              'hero',
                              t('home.banner_title') || 'Discover Your Elegance'
                            )}
                        </h1>
                        <p
                          className="text-lg md:text-xl lg:text-2xl mb-8 md:mb-10 leading-relaxed max-w-xl"
                          style={{ color: banners[currentBannerIndex].subtitleColor || '#fff' }}
                        >
                          {getBannerText(banners[currentBannerIndex], 'subtitle') ||
                            getHomepageSectionSubtitle(
                              'hero',
                              t('home.banner_subtitle') ||
                                'Explore our latest collection of premium modest fashion designed for the modern woman.'
                            )}
                        </p>

                        {activeFlashSales.length > 0 && activeFlashSales[0].endTime && (
                          <div className="mb-8 md:mb-10">
                            <p className="mb-3 text-sm md:text-base font-medium text-[#4f3d18]">
                              {t('home.limited_time_offer') || 'Limited Time Offer'}
                            </p>
                            <CountdownTimer endTime={activeFlashSales[0].endTime.toDate()} />
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                          <Link
                            href={banners[currentBannerIndex].linkTo || '/shop'}
                            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#36280e] md:px-10 md:py-5 md:text-base"
                          >
                            {t('home.shop_collection') || 'Shop Collection'}
                          </Link>
                          {activeFlashSales.length > 0 && (
                            <Link
                              href="/flash"
                              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#caa14d] bg-white/70 px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#8a6721] backdrop-blur transition-colors hover:bg-white md:px-10 md:py-5 md:text-base"
                            >
                              {t('home.shop_flash_sale') || 'Shop Flash Sale'}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {banners.length > 1 && (
                    <div className="absolute bottom-8 right-8 z-30 flex gap-2">
                      {banners.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentBannerIndex(index)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                          aria-label={`Go to banner ${index + 1}`}
                        >
                          <span
                            className={`block rounded-full transition-all ${
                              index === currentBannerIndex
                                ? 'h-2.5 w-8 bg-[#1a1307]'
                                : 'h-2.5 w-2.5 bg-[#d2bb85] hover:bg-[#b99343]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="page-container py-6">
              <div className="flex min-h-[560px] items-center justify-center rounded-[2.25rem] border border-[#ead8ab] bg-[linear-gradient(135deg,#f7f1e4_0%,#fffdf8_100%)] text-center shadow-[0_30px_80px_rgba(115,84,28,0.12)]">
                <div className="text-center px-6">
                  <h1 className="mb-4 text-5xl font-heading font-bold text-[#24180a] md:text-6xl">
                    {getHomepageSectionTitle(
                      'hero',
                      t('home.welcome')?.replace('{company}', settings?.company?.name || '') ||
                        `Welcome to ${settings?.company?.name || ''}`
                    )}
                  </h1>
                  <Link
                    href="/shop"
                    className="inline-block rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#36280e]"
                  >
                    {t('home.shop_now') || 'Shop Now'}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {isHomepageSectionEnabled('trust-badges') && (
        <section
          data-section-id="trust-badges"
          className="w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 border-b border-gray-200 py-16 md:py-20"
          style={{ order: getHomepageSectionOrder('trust-badges') }}
        >
          <div className="page-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                {
                  title: t('home.trust_free_shipping') || 'Free Shipping',
                  description: t('home.trust_free_shipping_desc') || 'On orders over $100',
                  circle: 'bg-blue-100',
                  icon: 'text-orange-700',
                  path: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m16.5 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
                },
                {
                  title: t('home.trust_secure_payment') || 'Secure Payment',
                  description: t('home.trust_secure_payment_desc') || '100% secure checkout',
                  circle: 'bg-green-100',
                  icon: 'text-green-700',
                  path: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
                },
                {
                  title: t('home.trust_authentic') || 'Authentic Products',
                  description: t('home.trust_authentic_desc') || '100% genuine items',
                  circle: 'bg-purple-100',
                  icon: 'text-purple-700',
                  path: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
                },
                {
                  title: t('home.trust_easy_returns') || 'Easy Returns',
                  description: t('home.trust_easy_returns_desc') || '30-day return policy',
                  circle: 'bg-orange-100',
                  icon: 'text-gray-700',
                  path: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.228a46.865 46.865 0 00-12.12 0m12.12 0a46.866 46.866 0 01-12.12 0',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col md:flex-row items-center gap-3 text-center md:text-left bg-white p-4 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className={`w-12 h-12 md:w-14 md:h-14 ${item.circle} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className={`w-6 h-6 md:w-7 md:h-7 ${item.icon}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">{item.title}</p>
                    <p className="text-xs md:text-sm text-gray-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div ref={deferredRef}>
        {shouldLoadDeferred ? (
          <HomeDeferredSections />
        ) : (
          <div className="page-container py-14 md:py-20 space-y-10">
            <div className="space-y-4">
              <div className="h-10 w-56 rounded bg-gray-200 animate-pulse" />
              <div className="h-5 w-80 max-w-full rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
                    <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
