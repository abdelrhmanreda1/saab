// d:\pardah\app\lib\firestore\collections.ts

import { Timestamp } from "firebase/firestore";

export interface CollectionTranslation {
  languageCode: string; // e.g., 'en', 'ur', 'ar'
  name: string;
  description?: string;
  updatedAt: Timestamp;
}

export interface Collection {
  id: string;
  name: string; // Default/fallback name
  slug: string; // For SEO-friendly URLs (same across all languages)
  description?: string; // Default/fallback description
  translations?: CollectionTranslation[]; // Multi-language content
  imageUrl?: string;
  parentCollection?: string; // For nested collections (sub-collections)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

