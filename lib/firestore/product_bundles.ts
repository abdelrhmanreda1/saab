import { Timestamp } from 'firebase/firestore';

export interface ProductBundle {
  id?: string;
  name: string;
  description?: string;
  image?: string;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    discount?: number; // Percentage discount for this bundle item
    isRequired: boolean; // If false, item is optional in bundle
  }[];
  bundlePrice?: number; // Special bundle price (if set, overrides individual prices)
  discountType: 'percentage' | 'fixed' | 'bundle_price';
  discountValue?: number; // If discountType is percentage or fixed
  validFrom?: Timestamp;
  validUntil?: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

