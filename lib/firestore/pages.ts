// d:\pardah\app\lib\firestore\pages.ts

import { Timestamp } from "firebase/firestore";

export interface PageContentTranslation {
  languageCode: string; // e.g., 'en', 'ur', 'ar'
  title: string;
  content: string; // HTML or Markdown content
  metaTitle?: string;
  metaDescription?: string;
  updatedAt: Timestamp;
}

export interface Page {
  id?: string;
  slug: string; // For SEO-friendly URLs (e.g., "about-us", "contact", "privacy")
  isActive: boolean;
  translations: PageContentTranslation[]; // Multi-language content
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Legacy interface for backward compatibility
export interface PageContent {
  id?: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  updatedAt?: Timestamp;
}

export const PAGE_SLUGS = {
  about: 'About Us',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  shipping: 'Shipping & Returns',
  'size-guide': 'Size Guide',
  'store-locator': 'Store Locator',
  careers: 'Careers',
  faq: 'FAQs',
  contact: 'Contact Us',
};
