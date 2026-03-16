// d:\pardah\app\lib\firestore\categories.ts

import { Timestamp } from "firebase/firestore";

export interface CategoryTranslation {
  languageCode: string;
  name: string;
  description?: string;
  updatedAt: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  slug: string; // For SEO-friendly URLs
  description?: string;
  imageUrl?: string;
  parentCategory?: string; // For nested categories
  translations?: CategoryTranslation[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
