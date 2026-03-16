import { Timestamp } from "firebase/firestore";

export interface SizeTranslation {
  languageCode: string; // e.g., 'en', 'ur', 'ar'
  name: string;
  updatedAt: Timestamp;
}

export interface Size {
  id?: string;
  name: string; // Default/fallback name
  code: string; // e.g. "S", "M" (same across all languages)
  order: number; // for sorting, e.g. 1, 2, 3
  translations?: SizeTranslation[]; // Multi-language content
}

export interface ColorTranslation {
  languageCode: string; // e.g., 'en', 'ur', 'ar'
  name: string;
  updatedAt: Timestamp;
}

export interface Color {
  id?: string;
  name: string; // Default/fallback name
  hexCode: string; // e.g. "#FF0000" (same across all languages)
  translations?: ColorTranslation[]; // Multi-language content
}

