import { Timestamp } from 'firebase/firestore';

export interface EmailCampaign {
  id?: string;
  name: string;
  subject: string;
  body: string; // HTML content
  recipientType: 'all' | 'segment' | 'custom';
  segmentId?: string; // If recipientType is 'segment'
  recipientIds?: string[]; // If recipientType is 'custom'
  scheduledAt?: Timestamp;
  sentAt?: Timestamp;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // Admin user ID
}

export interface PushNotificationCampaign {
  id?: string;
  name: string;
  title: string;
  body: string;
  imageUrl?: string;
  linkUrl?: string;
  recipientType: 'all' | 'segment' | 'custom';
  segmentId?: string;
  recipientIds?: string[];
  scheduledAt?: Timestamp;
  sentAt?: Timestamp;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface AbandonedCart {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  items: {
    productId: string;
    productName: string;
    productImage: string;
    price: number;
    quantity: number;
    variant?: {
      id: string;
      name: string;
      value: string;
    };
  }[];
  totalAmount: number;
  lastUpdated: Timestamp;
  recoveryEmailsSent: number;
  recovered: boolean;
  recoveredAt?: Timestamp;
  createdAt: Timestamp;
}

export interface FlashSale {
  id?: string;
  name: string;
  description?: string;
  productIds: string[]; // Products included in flash sale
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startTime: Timestamp;
  endTime: Timestamp;
  isActive: boolean;
  maxQuantity?: number; // Max quantity per customer
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface BuyXGetYPromotion {
  id?: string;
  name: string;
  description?: string;
  buyProductIds: string[]; // Products to buy
  buyQuantity: number; // Buy X items
  getProductIds: string[]; // Products to get free/discounted
  getQuantity: number; // Get Y items
  getDiscountType: 'free' | 'percentage' | 'fixed';
  getDiscountValue?: number; // If not free
  validFrom: Timestamp;
  validUntil: Timestamp;
  isActive: boolean;
  usageLimit?: number; // Total usage limit
  usedCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface FreeShippingRule {
  id?: string;
  name: string;
  description?: string;
  threshold: number; // Minimum order amount
  zoneIds?: string[]; // Specific zones, if empty applies to all
  validFrom?: Timestamp;
  validUntil?: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

