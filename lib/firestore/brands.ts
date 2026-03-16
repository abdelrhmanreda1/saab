import { Timestamp } from "firebase/firestore";

export interface BrandTranslation {
  languageCode: string;
  name: string;
  description?: string;
  updatedAt: Timestamp;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  translations?: BrandTranslation[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
