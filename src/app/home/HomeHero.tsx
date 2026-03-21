import { getAllBanners } from '@/lib/firestore/banners_db';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { defaultHomepageSections } from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import HomeHeroClient from './HomeHeroClient';

export default async function HomeHero() {
  const [banners, flashSales, homepageSections] = await Promise.all([
    getAllBanners().catch(() => []),
    getAllFlashSales(true).catch(() => []),
    getHomepageSections().catch(() => defaultHomepageSections),
  ]);

  const activeBanners = banners
    .filter((banner) => banner.isActive)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((banner) => ({
      id: banner.id || banner.imageUrl || `banner-${banner.order || 0}`,
      imageUrl: banner.imageUrl,
      title: banner.title,
      subtitle: banner.subtitle,
      titleColor: banner.titleColor,
      subtitleColor: banner.subtitleColor,
      linkTo: banner.linkTo,
      deviceType: banner.deviceType,
      isActive: banner.isActive,
      order: banner.order,
      translations: (banner.translations || []).map((translation) => ({
        languageCode: translation.languageCode || '',
        title: translation.title || '',
        subtitle: translation.subtitle || '',
      })),
    }));

  const now = new Date();
  const activeFlashSales = flashSales
    .filter((sale) => {
      if (!sale.isActive) return false;
      const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
      const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
      return now >= startTime && now <= endTime;
    })
    .map((sale) => ({
      id: sale.id || sale.name || 'flash-sale',
      endTimeIso: sale.endTime?.toDate ? sale.endTime.toDate().toISOString() : '',
    }))
    .filter((sale) => sale.endTimeIso);

  const serializedHomepageSections = homepageSections.map((section) => ({
    id: section.id,
    enabled: section.enabled,
    order: section.order,
    title: section.title || '',
    subtitle: section.subtitle || '',
    itemLimit: section.itemLimit,
  }));

  return (
    <HomeHeroClient
      banners={activeBanners}
      flashSales={activeFlashSales}
      homepageSections={serializedHomepageSections}
    />
  );
}
