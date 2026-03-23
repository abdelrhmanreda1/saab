import Image from 'next/image';
import { preload } from 'react-dom';
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

  const normalizedBanners: HeroBanner[] = banners
    .filter((banner) => banner.isActive)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((banner) => ({
      id: banner.id || banner.imageUrl || `banner-${banner.order || 0}`,
      imageUrl: banner.imageUrl,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      translations: Array.isArray(banner.translations)
        ? banner.translations.map((translation) => ({
            languageCode: translation?.languageCode ?? null,
            title: translation?.title ?? null,
            subtitle: translation?.subtitle ?? null,
          }))
        : [],
      linkTo: banner.linkTo || '/shop',
      deviceType: banner.deviceType || 'both',
      isActive: banner.isActive,
      order: banner.order || 0,
    }));

  const primaryBanner = normalizedBanners[0] || null;
  const heroImageUrl = getSafeImageUrl(primaryBanner?.imageUrl);

  if (heroImageUrl) {
    preload(heroImageUrl, { as: 'image', fetchPriority: 'high' });
  }

  return (
    <section
      data-section-id="hero"
      className="home-critical-hero relative w-full overflow-hidden bg-[#fffdf8]"
      style={{ order: heroSection?.order ?? 0 }}
    >
      <div className="page-container py-3 md:py-5">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#ead8ab] bg-[#f8f3e8]">
          <div className="home-critical-hero-media relative min-h-[480px] md:min-h-[680px]">
            {heroImageUrl ? (
              <Image
                src={heroImageUrl}
                alt={primaryBanner?.title || settings?.company?.name || 'Hero banner'}
                fill
                priority
                fetchPriority="high"
                loading="eager"
                quality={50}
                sizes="(max-width: 768px) 100vw, 1280px"
                className="object-cover"
              />
            ) : null}

            <HomeHeroContentClient
              companyName={settings?.company?.name || ''}
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
