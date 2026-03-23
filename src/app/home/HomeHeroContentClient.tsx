'use client';

import Link from 'next/link';
import { useHomeLanguage } from '@/app/(home)/home-context';

type HeroBannerTranslation = {
  languageCode?: string | null;
  title?: string | null;
  subtitle?: string | null;
};

type HeroBanner = {
  title?: string;
  subtitle?: string;
  translations?: HeroBannerTranslation[];
  linkTo?: string;
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function hasArabicText(value?: string | null) {
  return /[\u0600-\u06FF]/.test(String(value || ''));
}

function getBannerText(
  banner: HeroBanner | null,
  languageCode: string,
  fallback: string,
  field: 'title' | 'subtitle'
) {
  if (!banner) return fallback;

  const translation = (banner.translations || []).find(
    (item) => normalize(item.languageCode) === normalize(languageCode)
  );

  const translatedValue = String(translation?.[field] || '').trim();
  if (translatedValue) return translatedValue;

  const baseValue = String(banner[field] || '').trim();
  if (!baseValue) return fallback;

  if (normalize(languageCode) === 'ar') {
    return hasArabicText(baseValue) ? baseValue : fallback;
  }

  return baseValue;
}

export default function HomeHeroContentClient({
  companyName,
  primaryBanner,
  defaultArabicTitle,
  defaultArabicSubtitle,
  defaultEnglishTitle,
  defaultEnglishSubtitle,
}: {
  companyName: string;
  primaryBanner: HeroBanner | null;
  defaultArabicTitle: string;
  defaultArabicSubtitle: string;
  defaultEnglishTitle: string;
  defaultEnglishSubtitle: string;
}) {
  const { currentLanguage } = useHomeLanguage();
  const languageCode = normalize(currentLanguage?.code || 'ar');
  const isArabic = languageCode === 'ar';

  const title = getBannerText(
    primaryBanner,
    languageCode,
    isArabic ? defaultArabicTitle : defaultEnglishTitle,
    'title'
  );

  const subtitle = getBannerText(
    primaryBanner,
    languageCode,
    isArabic ? defaultArabicSubtitle : defaultEnglishSubtitle,
    'subtitle'
  );

  return (
    <div className="home-critical-hero-panel absolute inset-0 z-10 flex items-center">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-2xl">
          <span className={`inline-flex items-center rounded-full border border-[#caa14d] bg-white/95 px-4 py-2 text-[11px] font-semibold text-[#8a6721] shadow-sm ${isArabic ? 'tracking-normal' : 'uppercase tracking-[0.28em]'}`}>
            {isArabic ? 'مجموعة ذهبية مختارة' : 'Curated Gold Collection'}
          </span>

          <h1 className={`mt-5 text-4xl font-heading font-bold text-white md:text-6xl lg:text-7xl ${isArabic ? 'leading-[1.2] tracking-normal' : 'leading-[1.05] tracking-tight'}`}>
            {title || companyName}
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/95 md:text-xl lg:text-2xl">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href={primaryBanner?.linkTo || '/shop'}
              className={`inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-[#36280e] md:px-10 md:py-5 md:text-base ${isArabic ? 'tracking-normal' : 'uppercase tracking-[0.22em]'}`}
            >
              {isArabic ? 'تسوق المجموعة' : 'Shop Collection'}
            </Link>
            <Link
              href="/shop"
              className={`inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#caa14d] bg-white/92 px-8 py-4 text-sm font-bold text-[#8a6721] transition-colors hover:bg-white md:px-10 md:py-5 md:text-base ${isArabic ? 'tracking-normal' : 'uppercase tracking-[0.22em]'}`}
            >
              {isArabic ? 'تسوق الآن' : 'Shop Now'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
