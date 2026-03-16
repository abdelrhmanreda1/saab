import { Timestamp } from 'firebase/firestore';

export interface GiftCard {
  id?: string;
  code: string; // Unique gift card code
  amount: number; // Gift card value
  balance: number; // Remaining balance
  currency: string; 
  issuedTo?: string; // User ID if issued to specific user
  issuedToEmail?: string; // Email if issued to non-registered user
  issuedBy: string; // Admin user ID who created it
  validFrom: Timestamp;
  validUntil: Timestamp;
  isActive: boolean;
  isRedeemed: boolean;
  redeemedAt?: Timestamp;
  redeemedBy?: string; // User ID who redeemed it
  redeemedOrderId?: string; // Order ID where it was used
  usageHistory: {
    orderId: string;
    amount: number;
    usedAt: Timestamp;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GiftCardTemplate {
  id?: string;
  name: string;
  amount: number;
  description?: string;
  validDays: number; // Days from issue date
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

