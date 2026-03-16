import { Timestamp } from 'firebase/firestore';

export interface RecentlyViewedProduct {
  userId: string;
  productId: string;
  viewedAt: Timestamp;
}

export interface ProductComparison {
  id?: string;
  userId: string;
  productIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductRecommendation {
  productId: string;
  recommendedProductIds: string[]; // Based on category, brand, or similar products
  type: 'category' | 'brand' | 'similar' | 'bought_together';
  score: number; // Relevance score
  updatedAt: Timestamp;
}

export interface ProductTag {
  id?: string;
  name: string;
  slug: string;
  color?: string;
  description?: string;
  createdAt: Timestamp;
}

export interface SavedSearch {
  id?: string;
  userId: string;
  query: string;
  filters?: {
    categories?: string[];
    brands?: string[];
    priceRange?: { min: number; max: number };
    tags?: string[];
    inStock?: boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductNotification {
  id?: string;
  userId: string;
  productId: string;
  type: 'back_in_stock' | 'price_drop' | 'new_variant';
  notified: boolean;
  createdAt: Timestamp;
  notifiedAt?: Timestamp;
}

export interface SizeChart {
  id?: string;
  productId: string;
  category?: string;
  measurements: {
    size: string;
    chest?: number;
    waist?: number;
    hips?: number;
    length?: number;
    sleeve?: number;
    [key: string]: unknown;
  }[];
  unit: 'cm' | 'inches';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GiftRegistry {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  eventDate?: Timestamp;
  eventType?: 'wedding' | 'birthday' | 'baby_shower' | 'anniversary' | 'other';
  isPublic: boolean;
  shareCode: string;
  productIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

