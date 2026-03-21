'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useHomeLanguage } from '@/app/(home)/home-context';
import Image from 'next/image';
import Link from 'next/link';
import { getSafeImageUrl } from '@/lib/utils/image';

const CountdownTimer = dynamic(() => import('../../components/CountdownTimer'), { ssr: false });

type HeroBanner = {
  id: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  titleColor?: string;
  subtitleColor?: string;
  linkTo?: string;
  deviceType?: 'both' | 'mobile' | 'desktop';
  isActive?: boolean;
  order?: number;
  translations?: Array<{
    languageCode?: string | null;
    title?: string | null;
    subtitle?: string | null;
  }>;
};

type HeroFlashSale = {
  id: string;
  endTimeIso: string;
};

type HeroConfig = {
  enabled: boolean;
  order: number;
  title?: string;
  subtitle?: string;
};

export default function HomeHeroClient({
  banners,
  flashSales,
  companyName,
  heroConfig,
}: {
  banners: HeroBanner[];
  flashSales: HeroFlashSale[];
  companyName: string;
  heroConfig: HeroConfig;
}) {
  const { t, currentLanguage } = useHomeLanguage();
  const [isMobile, setIsMobile] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const languageCode = String(currentLanguage?.code || 'en').trim().toLowerCase();
  const isArabic = languageCode === 'ar';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const visibleBanners = useMemo(
    () =>
      banners
        .filter((banner) => {
          if (banner.deviceType === 'both' || !banner.deviceType) return true;
          if (isMobile && banner.deviceType === 'mobile') return true;
          if (!isMobile && banner.deviceType === 'desktop') return true;
          return false;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [banners, isMobile]
  );

  useEffect(() => {
    if (visibleBanners.length <= 1) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setCurrentBannerIndex((prev) => (prev === visibleBanners.length - 1 ? 0 : prev + 1));
      }, 5000);
    }, 12000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [visibleBanners.length]);

  useEffect(() => {
    if (currentBannerIndex >= visibleBanners.length) {
      setCurrentBannerIndex(0);
    }
  }, [currentBannerIndex, visibleBanners.length]);

  const getBannerText = useCallback(
    (banner: HeroBanner | undefined, field: 'title' | 'subtitle') => {
      if (!banner) return '';
      const normalize = (code?: string | null) => String(code || '').trim().toLowerCase();
      const translation = (banner.translations || []).find(
        (item) => normalize(item.languageCode) === normalize(languageCode)
      );
      const candidate = String((translation && translation[field]) || '');
      if (candidate.trim()) return candidate;
      return String(banner[field] || '');
    },
    [languageCode]
  );

  const currentBanner = visibleBanners[currentBannerIndex];
  const currentFlashSale = flashSales[0];

  if (!heroConfig.enabled) {
    return null;
  }

  return (
    <section
      data-section-id="hero"
      className="relative w-full overflow-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e4_100%)] min-h-[520px] md:min-h-[760px]"
      style={{ order: heroConfig.order ?? 0 }}
    >
      {visibleBanners.length > 0 && currentBanner ? (
        <div className="page-container py-4 md:py-6">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-[#ead8ab] bg-[#f8f3e8] shadow-[0_30px_80px_rgba(115,84,28,0.12)]">
            <div className="relative h-[520px] md:h-[680px]">
              <div className="relative h-full w-full">
                {visibleBanners.map((banner, index) => (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                  >
                    <Image
                      src={getSafeImageUrl(banner.imageUrl)}
                      alt={getBannerText(banner, 'title') || companyName || ''}
                      fill
                      sizes="(max-width: 768px) 100vw, 1216px"
                      priority={index === 0}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : undefined}
                      quality={42}
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
                      style={{ color: currentBanner.titleColor || '#fff' }}
                    >
                      {getBannerText(currentBanner, 'title') ||
                        heroConfig.title?.trim() ||
                        t('home.banner_title') || 'Discover Your Elegance'}
                    </h1>
                    <p
                      className="text-lg md:text-xl lg:text-2xl mb-8 md:mb-10 leading-relaxed max-w-xl"
                      style={{ color: currentBanner.subtitleColor || '#fff' }}
                    >
                      {getBannerText(currentBanner, 'subtitle') ||
                        heroConfig.subtitle?.trim() ||
                        t('home.banner_subtitle') ||
                        'Explore our latest collection of premium modest fashion designed for the modern woman.'}
                    </p>

                    {currentFlashSale?.endTimeIso && (
                      <div className="mb-8 md:mb-10">
                        <p className="mb-3 text-sm md:text-base font-medium text-[#4f3d18]">
                          {t('home.limited_time_offer') || 'Limited Time Offer'}
                        </p>
                        <CountdownTimer endTime={new Date(currentFlashSale.endTimeIso)} />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                      <Link
                        href={currentBanner.linkTo || '/shop'}
                        className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white transition-all hover:scale-[1.02] hover:bg-[#36280e] md:px-10 md:py-5 md:text-base"
                      >
                        {t('home.shop_collection') || 'Shop Collection'}
                      </Link>
                      {currentFlashSale && (
                        <Link
                          href="/flash"
                          className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#caa14d] bg-white/70 px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#8a6721] backdrop-blur transition-all hover:scale-[1.02] hover:bg-white md:px-10 md:py-5 md:text-base"
                        >
                          {t('home.shop_flash_sale') || 'Shop Flash Sale'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {visibleBanners.length > 1 && (
                <div className="absolute bottom-8 right-8 z-30 flex gap-2">
                  {visibleBanners.map((_, index) => (
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
                {heroConfig.title?.trim() ||
                  t('home.welcome')?.replace('{company}', companyName || '') ||
                  `Welcome to ${companyName || ''}`}
              </h1>
              <p className="text-xl text-gray-300 mb-8" />
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
  );
}
