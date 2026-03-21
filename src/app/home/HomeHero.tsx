import Image from 'next/image';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { defaultHomepageSections } from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import { getCachedSettings } from '@/lib/server/site-config';
import { getSafeImageUrl } from '@/lib/utils/image';
import HomeHeroContentClient from './HomeHeroContentClient';

type HeroBanner = {
  id: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  translations?: Array<{
    languageCode?: string | null;
    title?: string | null;
    subtitle?: string | null;
  }>;
  titleColor?: string;
  subtitleColor?: string;
  linkTo?: string;
  deviceType?: 'desktop' | 'mobile' | 'both';
  isActive?: boolean;
  order?: number;
};

export default async function HomeHero() {
  const [banners, homepageSections, settings] = await Promise.all([
    getAllBanners().catch(() => []),
    getHomepageSections().catch(() => defaultHomepageSections),
    getCachedSettings().catch(() => null),
  ]);

  const heroSection =
    homepageSections.find((section) => section.id === 'hero') ||
    defaultHomepageSections.find((section) => section.id === 'hero');

  if (!(heroSection?.enabled ?? true)) {
    return null;
  }

  const primaryBanner: HeroBanner | null =
    banners
      .filter(
        (banner) =>
          banner.isActive &&
          (banner.deviceType === 'both' || banner.deviceType === 'desktop' || !banner.deviceType)
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((banner) => ({
        id: banner.id || banner.imageUrl || `banner-${banner.order || 0}`,
        imageUrl: banner.imageUrl,
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        translations: Array.isArray(banner.translations) ? banner.translations : [],
        titleColor: banner.titleColor || '',
        subtitleColor: banner.subtitleColor || '',
        linkTo: banner.linkTo || '/shop',
        deviceType: banner.deviceType || 'both',
        isActive: banner.isActive,
        order: banner.order || 0,
      }))[0] || null;

  const companyName = settings?.company?.name || '';
  const imageUrl = getSafeImageUrl(primaryBanner?.imageUrl);

  return (
    <section
      data-section-id="hero"
      className="relative w-full overflow-hidden bg-[#fffdf8]"
      style={{ order: heroSection?.order ?? 0 }}
    >
      <div className="page-container py-3 md:py-5">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#ead8ab] bg-[#f8f3e8]">
          <div className="relative min-h-[480px] md:min-h-[680px]">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={companyName || 'Hero banner'}
                fill
                priority
                loading="eager"
                fetchPriority="high"
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={36}
                className="object-cover"
              />
            ) : null}

            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,247,238,0.92)_0%,rgba(251,247,238,0.76)_42%,rgba(251,247,238,0.12)_100%)]" />

            <HomeHeroContentClient
              companyName={companyName}
              primaryBanner={primaryBanner}
              defaultArabicTitle={heroSection?.title?.trim() || 'اكتشف أناقتك'}
              defaultArabicSubtitle={
                heroSection?.subtitle?.trim() || 'استكشف أحدث مجموعاتنا من المجوهرات الراقية.'
              }
              defaultEnglishTitle="Discover Your Elegance"
              defaultEnglishSubtitle="Explore our latest collection of premium jewelry."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
