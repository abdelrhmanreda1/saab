import { unstable_cache } from 'next/cache';
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { getDefaultCurrency } from '@/lib/firestore/internationalization_db';

export const getCachedSettings = unstable_cache(async () => getSettings(), ['site-settings'], {
  revalidate: 300,
});

export const getCachedSEOSettings = unstable_cache(async () => getSEOSettings(), ['site-seo-settings'], {
  revalidate: 300,
});

export const getCachedDefaultCurrency = unstable_cache(
  async () => getDefaultCurrency(),
  ['site-default-currency'],
  {
    revalidate: 300,
  }
);

export const getCachedPageSEO = async (pagePath: string) =>
  unstable_cache(async () => getPageSEO(pagePath), ['page-seo', pagePath], {
    revalidate: 300,
  })();
