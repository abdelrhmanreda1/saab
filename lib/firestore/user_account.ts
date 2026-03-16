import { Timestamp } from 'firebase/firestore';

export interface UserAddress {
  id?: string;
  userId: string;
  label: string; // e.g., "Home", "Work", "Office"
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReturnExchangeRequest {
  id?: string;
  orderId: string;
  userId: string;
  type: 'return' | 'exchange';
  items: {
    orderItemId: string;
    productId: string;
    productName: string;
    variantId?: string;
    quantity: number;
    reason: string;
    exchangeProductId?: string; // For exchanges
    exchangeVariantId?: string; // For exchanges
  }[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Refund {
  id?: string;
  orderId: string;
  returnRequestId?: string;
  userId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  refundMethod: 'original' | 'wallet' | 'bank_transfer';
  transactionId?: string;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  processedAt?: Timestamp;
}

export interface UserPreferences {
  id?: string;
  userId: string;
  emailPreferences: {
    orderUpdates: boolean;
    promotions: boolean;
    newsletters: boolean;
    productRecommendations: boolean;
  };
  notificationPreferences: {
    orderStatus: boolean;
    promotions: boolean;
    stockAlerts: boolean;
    priceDrops: boolean;
  };
  privacySettings: {
    profileVisibility: 'public' | 'private';
    showEmail: boolean;
    showPhone: boolean;
  };
  updatedAt: Timestamp;
}

