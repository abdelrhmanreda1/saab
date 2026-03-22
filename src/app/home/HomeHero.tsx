import { preload } from 'react-dom';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { defaultHomepageSections } from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import { getCachedSettings } from '@/lib/server/site-config';
import { getSafeImageUrl } from '@/lib/utils/image';
import HomeHeroClient from './HomeHeroClient';

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

  const heroImageUrl = getSafeImageUrl(normalizedBanners[0]?.imageUrl);
  if (heroImageUrl) {
    preload(heroImageUrl, { as: 'image', fetchPriority: 'high' });
  }

  return (
    <HomeHeroClient
      banners={normalizedBanners}
      companyName={settings?.company?.name || ''}
      heroConfig={{
        enabled: heroSection?.enabled ?? true,
        order: heroSection?.order ?? 0,
        title: heroSection?.title?.trim() || 'اكتشف أناقتك',
        subtitle: heroSection?.subtitle?.trim() || 'استكشف أحدث مجموعاتنا من المجوهرات الراقية.',
      }}
    />
  );
}
