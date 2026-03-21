'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useHomeLanguage } from '@/app/(home)/home-context';
import { getSafeImageUrl } from '@/lib/utils/image';

type HeroBanner = {
  id: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  linkTo?: string;
  deviceType?: 'both' | 'mobile' | 'desktop';
  translations?: Array<{
    languageCode?: string | null;
    title?: string | null;
    subtitle?: string | null;
  }>;
};

type HeroConfig = {
  enabled: boolean;
  order: number;
  title?: string;
  subtitle?: string;
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function hasArabicText(value?: string | null) {
  return /[\u0600-\u06FF]/.test(String(value || ''));
}

export default function HomeHeroClient({
  banners,
  companyName,
  heroConfig,
}: {
  banners: HeroBanner[];
  companyName: string;
  heroConfig: HeroConfig;
}) {
  const { t, currentLanguage } = useHomeLanguage();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const languageCode = normalize(currentLanguage?.code || 'ar');
  const isArabic = languageCode === 'ar';

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  const visibleBanners = useMemo(
    () =>
      banners
        .filter((banner) => {
          if (banner.deviceType === 'both' || !banner.deviceType) return true;
          if (isMobile === true && banner.deviceType === 'mobile') return true;
          if (isMobile === false && banner.deviceType === 'desktop') return true;
          return false;
        })
        .filter((banner) => !!getSafeImageUrl(banner.imageUrl)),
    [banners, isMobile]
  );

  useEffect(() => {
    if (visibleBanners.length <= 1) return;
    const intervalId = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % visibleBanners.length);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [visibleBanners.length]);

  useEffect(() => {
    if (currentBannerIndex >= visibleBanners.length) {
      setCurrentBannerIndex(0);
    }
  }, [currentBannerIndex, visibleBanners.length]);

  const getBannerText = useCallback(
    (banner: HeroBanner | undefined, field: 'title' | 'subtitle') => {
      if (!banner) return '';

      const translation = (banner.translations || []).find(
        (item) => normalize(item.languageCode) === languageCode
      );

      const translatedValue = String(translation?.[field] || '').trim();
      if (translatedValue) return translatedValue;

      const baseValue = String(banner[field] || '').trim();
      if (!baseValue) return '';

      if (isArabic) {
        return hasArabicText(baseValue) ? baseValue : '';
      }

      return baseValue;
    },
    [isArabic, languageCode]
  );

  const currentBanner = visibleBanners[currentBannerIndex];

  if (!heroConfig.enabled) {
    return null;
  }

  return (
    <section
      data-section-id="hero"
      className="relative w-full overflow-hidden bg-[#fffdf8]"
      style={{ order: heroConfig.order ?? 0 }}
    >
      <div className="page-container py-3 md:py-5">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#ead8ab] bg-[#f8f3e8] shadow-[0_30px_80px_rgba(115,84,28,0.12)]">
          <div className="relative min-h-[480px] md:min-h-[680px]">
            {visibleBanners.length > 0 && currentBanner ? (
              <>
                {visibleBanners.map((banner, index) => {
                  const imageUrl = getSafeImageUrl(banner.imageUrl);
                  if (!imageUrl) return null;

                  return (
                    <div
                      key={banner.id}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        index === currentBannerIndex ? 'z-10 opacity-100' : 'z-0 opacity-0'
                      }`}
                    >
                      <Image
                        src={imageUrl}
                        alt={getBannerText(banner, 'title') || companyName || 'Hero banner'}
                        fill
                        priority={index === 0}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : undefined}
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 50vw"
                        quality={index === 0 ? 36 : 32}
                        className="object-cover"
                      />
                    </div>
                  );
                })}
              </>
            ) : null}

            <div className="absolute inset-0 z-20 bg-[linear-gradient(90deg,rgba(24,18,9,0.42)_0%,rgba(24,18,9,0.28)_36%,rgba(24,18,9,0.72)_100%)]" />

            <div className="absolute inset-0 z-30 flex items-center">
              <div className="w-full px-6 md:px-12">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center rounded-full border border-[#caa14d] bg-white/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8a6721] shadow-sm">
                    {isArabic ? 'مجموعة ذهبية مختارة' : 'Curated Gold Collection'}
                  </span>

                  <h1 className="mt-5 text-4xl font-heading font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)] md:text-6xl lg:text-7xl">
                    {getBannerText(currentBanner, 'title') ||
                      heroConfig.title?.trim() ||
                      (isArabic ? 'اكتشف أناقتك' : t('home.banner_title') || 'Discover Your Elegance') ||
                      companyName}
                  </h1>

                  <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] md:text-xl lg:text-2xl">
                    {getBannerText(currentBanner, 'subtitle') ||
                      heroConfig.subtitle?.trim() ||
                      (isArabic
                        ? 'استكشف أحدث مجموعاتنا من المجوهرات الراقية.'
                        : t('home.banner_subtitle') || 'Explore our latest collection of premium jewelry.')}
                  </p>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Link
                      href={currentBanner?.linkTo || '/shop'}
                      className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#36280e] md:px-10 md:py-5 md:text-base"
                    >
                      {isArabic ? 'تسوق المجموعة' : 'Shop Collection'}
                    </Link>
                    <Link
                      href="/shop"
                      className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#caa14d] bg-white/92 px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#8a6721] transition-colors hover:bg-white md:px-10 md:py-5 md:text-base"
                    >
                      {isArabic ? 'تسوق الآن' : 'Shop Now'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {visibleBanners.length > 1 && (
              <div className="absolute bottom-8 right-8 z-40 flex gap-2">
                {visibleBanners.map((banner, index) => (
                  <button
                    key={banner.id}
                    onClick={() => setCurrentBannerIndex(index)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                    aria-label={`Go to banner ${index + 1}`}
                  >
                    <span
                      className={`block rounded-full transition-all ${
                        index === currentBannerIndex
                          ? 'h-2.5 w-8 bg-white'
                          : 'h-2.5 w-2.5 bg-white/55 hover:bg-white/80'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
