import { Timestamp } from 'firebase/firestore';

export enum CustomerSegment {
  VIP = 'vip',
  Regular = 'regular',
  New = 'new',
  Inactive = 'inactive',
  HighValue = 'high_value',
  Frequent = 'frequent',
  OneTime = 'one_time',
}

export interface CustomerSegmentRule {
  id?: string;
  name: string;
  segment: CustomerSegment;
  conditions: {
    minOrders?: number;
    minSpent?: number;
    maxDaysSinceLastOrder?: number;
    minAverageOrderValue?: number;
    tags?: string[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomerTag {
  id?: string;
  name: string;
  color?: string; // Hex color code
  description?: string;
  createdAt: Timestamp;
}

export interface CustomerNote {
  id?: string;
  userId: string;
  note: string;
  createdBy: string; // Admin UID
  createdByName: string;
  isPrivate: boolean; // Private notes only visible to creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomerCommunication {
  id?: string;
  userId: string;
  type: 'email' | 'push' | 'chat' | 'call' | 'note';
  subject?: string;
  message: string;
  direction: 'inbound' | 'outbound';
  sentBy?: string; // Admin UID or system
  sentByName?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface CustomerLifetimeValue {
  userId: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  firstOrderDate: Timestamp;
  lastOrderDate: Timestamp;
  customerAge: number; // Days since first order
  predictedCLV: number; // Predicted lifetime value
  calculatedAt: Timestamp;
}

export interface CustomerExtended {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  segment?: CustomerSegment;
  tags?: string[]; // Array of tag IDs
  lifetimeValue?: CustomerLifetimeValue;
  totalSpent: number;
  totalOrders: number;
  lastOrderDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

