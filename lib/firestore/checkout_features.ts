import { Timestamp } from 'firebase/firestore';

export interface ShippingMethod {
  id?: string;
  name: string;
  code: string; // 'standard', 'express', 'overnight', etc.
  description?: string;
  estimatedDays: number;
  cost: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GiftMessage {
  recipientName?: string;
  message?: string;
  occasion?: string;
}

export interface OrderNote {
  note: string;
  isPrivate: boolean; // Private notes only visible to admin
}

export interface SplitPayment {
  methods: {
    method: 'cod' | 'stripe' | 'wallet' | 'loyalty_points';
    amount: number;
  }[];
}

