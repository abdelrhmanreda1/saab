import { Timestamp } from 'firebase/firestore';

export interface EmailNotification {
  id?: string;
  userId: string;
  type: 'order_confirmation' | 'order_shipped' | 'order_delivered' | 'order_cancelled' | 'return_approved' | 'refund_processed';
  subject: string;
  body: string;
  orderId?: string;
  sent: boolean;
  sentAt?: Timestamp;
  createdAt: Timestamp;
}

export interface PushNotification {
  id?: string;
  userId: string;
  title: string;
  body: string;
  type: 'order_update' | 'promotion' | 'stock_alert' | 'price_drop';
  data?: { [key: string]: string };
  sent: boolean;
  sentAt?: Timestamp;
  createdAt: Timestamp;
}

export interface ChatMessage {
  id?: string;
  userId: string;
  userName: string;
  message: string;
  isAdmin: boolean;
  adminId?: string;
  adminName?: string;
  read: boolean;
  images?: string[]; // Array of image URLs
  productId?: string; // Product ID if message includes a product
  productName?: string; // Product name for display
  productImage?: string; // Product image URL
  productUrl?: string; // Product URL
  createdAt: Timestamp;
}

export interface ChatSession {
  id?: string;
  userId: string; // For guests, this will be a generated ID
  userName: string;
  userEmail?: string;
  userPhone?: string; // User phone number
  isGuest?: boolean; // Mark if this is a guest session
  status: 'active' | 'closed' | 'waiting';
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  assignedTo?: string; // Admin ID
  messages: ChatMessage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

