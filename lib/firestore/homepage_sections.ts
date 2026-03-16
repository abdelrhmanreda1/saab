export type HomepageSectionId =
  | 'hero'
  | 'trust-badges'
  | 'gold-prices'
  | 'featured'
  | 'flash-sales'
  | 'popular'
  | 'categories'
  | 'latest'
  | 'collections'
  | 'bundles'
  | 'testimonials'
  | 'newsletter'
  | 'blog'
  | 'recently-viewed';

export interface HomepageSection {
  id: HomepageSectionId;
  label: string;
  description: string;
  title?: string | null;
  subtitle?: string | null;
  enabled: boolean;
  order: number;
  itemLimit?: number | null;
}

export const defaultHomepageSections: HomepageSection[] = [
  {
    id: 'hero',
    label: 'Hero Banner',
    description: 'Main hero slider at the top of the homepage.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 1,
    itemLimit: null,
  },
  {
    id: 'trust-badges',
    label: 'Trust Badges',
    description: 'Shipping, payment, authenticity, and returns highlights.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 2,
    itemLimit: null,
  },
  {
    id: 'gold-prices',
    label: 'Gold Prices',
    description: 'Current karat-based gold pricing section.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 3,
    itemLimit: 4,
  },
  {
    id: 'featured',
    label: 'Featured Products',
    description: 'Featured collection shown on the homepage.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 4,
    itemLimit: 8,
  },
  {
    id: 'flash-sales',
    label: 'Flash Sales',
    description: 'Active flash sale products section.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 5,
    itemLimit: 8,
  },
  {
    id: 'popular',
    label: 'Popular Products',
    description: 'Popular products based on views and purchases.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 6,
    itemLimit: 8,
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Homepage category grid.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 7,
    itemLimit: 8,
  },
  {
    id: 'latest',
    label: 'New Arrivals',
    description: 'Latest products section.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 8,
    itemLimit: 8,
  },
  {
    id: 'collections',
    label: 'Collections',
    description: 'Homepage curated collections section.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 9,
    itemLimit: 6,
  },
  {
    id: 'bundles',
    label: 'Bundles',
    description: 'Special offers and product bundles.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 10,
    itemLimit: 6,
  },
  {
    id: 'testimonials',
    label: 'Testimonials',
    description: 'Customer reviews and testimonials carousel.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 11,
    itemLimit: null,
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Newsletter sign-up block.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 12,
    itemLimit: null,
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Latest blog posts block.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 13,
    itemLimit: 3,
  },
  {
    id: 'recently-viewed',
    label: 'Recently Viewed',
    description: 'Recently viewed products section.',
    title: null,
    subtitle: null,
    enabled: true,
    order: 14,
    itemLimit: 8,
  },
];

export const mergeHomepageSectionsWithDefaults = (
  sections: HomepageSection[]
): HomepageSection[] => {
  return defaultHomepageSections.map((defaultSection) => {
    const savedSection = sections.find((section) => section.id === defaultSection.id);
    return savedSection
      ? {
          ...defaultSection,
          ...savedSection,
          title: savedSection.title ?? defaultSection.title ?? null,
          subtitle: savedSection.subtitle ?? defaultSection.subtitle ?? null,
          itemLimit: savedSection.itemLimit ?? defaultSection.itemLimit ?? null,
        }
      : defaultSection;
  });
};
