import Image from 'next/image';
import Link from 'next/link';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { defaultHomepageSections } from '@/lib/firestore/homepage_sections';
import { getHomepageSections } from '@/lib/firestore/homepage_sections_db';
import { getCachedSettings } from '@/lib/server/site-config';
import { getSafeImageUrl } from '@/lib/utils/image';

type HeroBanner = {
  id: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  titleColor?: string;
  subtitleColor?: string;
  linkTo?: string;
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
      .filter((banner) => banner.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((banner) => ({
        id: banner.id || banner.imageUrl || `banner-${banner.order || 0}`,
        imageUrl: banner.imageUrl,
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        titleColor: banner.titleColor || '',
        subtitleColor: banner.subtitleColor || '',
        linkTo: banner.linkTo || '/shop',
        order: banner.order || 0,
      }))[0] || null;

  const companyName = settings?.company?.name || '';
  const title = primaryBanner?.title?.trim() || heroSection?.title?.trim() || 'Discover Your Elegance';
  const subtitle =
    primaryBanner?.subtitle?.trim() ||
    heroSection?.subtitle?.trim() ||
    'Explore our latest collection of premium jewelry.';
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
                alt={title || companyName}
                fill
                priority
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={36}
                className="object-cover"
              />
            ) : null}

            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,247,238,0.92)_0%,rgba(251,247,238,0.76)_42%,rgba(251,247,238,0.12)_100%)]" />

            <div className="absolute inset-0 flex items-center">
              <div className="w-full px-6 md:px-12">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center rounded-full border border-[#caa14d] bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9f7424]">
                    Curated Gold Collection
                  </span>
                  <h1
                    className="mt-5 text-4xl font-heading font-bold leading-[1.05] tracking-tight text-[#1a1307] md:text-6xl lg:text-7xl"
                    style={{ color: primaryBanner?.titleColor || '#1a1307' }}
                  >
                    {title}
                  </h1>
                  <p
                    className="mt-5 max-w-xl text-lg leading-relaxed text-[#4b3a1a] md:text-xl lg:text-2xl"
                    style={{ color: primaryBanner?.subtitleColor || '#4b3a1a' }}
                  >
                    {subtitle}
                  </p>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Link
                      href={primaryBanner?.linkTo || '/shop'}
                      className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#1a1307] px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#36280e] md:px-10 md:py-5 md:text-base"
                    >
                      Shop Collection
                    </Link>
                    <Link
                      href="/shop"
                      className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#caa14d] bg-white/88 px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#8a6721] transition-colors hover:bg-white md:px-10 md:py-5 md:text-base"
                    >
                      Shop Now
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
