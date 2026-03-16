// d:\pardah\app\lib\firestore\products.ts

import { Timestamp } from "firebase/firestore";

export interface ProductTranslation {
  languageCode: string; // e.g., 'en', 'ur', 'ar'
  name: string;
  description: string;
  updatedAt: Timestamp;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g., "Size", "Color"
  value: string; // e.g., "Small", "Red"
  extraPrice?: number; // Extra price added to base price (e.g., +200 for Medium size)
  stock: number;
  imageUrl?: string;
  // Legacy fields (deprecated, kept for backward compatibility)
  price?: number;
  priceAdjustment?: number;
  salePrice?: number;
}

export interface ProductAnalytics {
  views: number;
  clicks: number;
  addToCartCount: number;
  purchases: number;
  conversionRate: number; // purchases / views
  lastViewed?: Timestamp;
}

export interface Product {
  id: string;
  name: string; // Default/fallback name
  slug: string; // SEO-friendly URL slug (same across all languages)
  description: string; // Default/fallback description
  translations?: ProductTranslation[]; // Multi-language content
  images: string[]; // URLs to product images
  price: number;
  pricingMode?: 'fixed' | 'gold';
  salePrice?: number; // Discounted price (if set, shows as sale price)
  discountType?: 'percentage' | 'fixed'; // Type of discount if salePrice is calculated
  discountValue?: number; // Discount amount (percentage or fixed amount)
  goldKarat?: '24K' | '22K' | '21K' | '18K';
  goldWeight?: number; // Product weight in grams
  makingChargeType?: 'fixed' | 'percentage';
  makingChargeValue?: number;
  manualPriceAdjustment?: number; // Extra fixed adjustment after gold calculation
  goldPricingSnapshot?: {
    baseGoldPricePerGram: number;
    calculatedAt: Timestamp;
    currency: string;
  };
  category: string; // Reference to category ID
  collectionId?: string; // Reference to collection ID
  brandId?: string; // Reference to brand ID
  variants: ProductVariant[];
  isFeatured: boolean;
  isActive: boolean;
  analytics?: ProductAnalytics;
  // Pre-order/Backorder
  allowPreOrder: boolean;
  preOrderExpectedDate?: Timestamp;
  preOrderMessage?: string;
  // Product Bundle
  isBundle: boolean;
  bundleProducts?: {
    productId: string;
    productName: string;
    quantity: number;
    discount?: number; // Percentage discount for this bundle item
  }[];
  bundlePrice?: number; // Special bundle price (if set, overrides individual prices)
  loyaltyPoints?: number; // Loyalty points earned when purchasing this product
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  brandId?: string;
  price: number;
  variants: ProductVariant[];
  isFeatured: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
