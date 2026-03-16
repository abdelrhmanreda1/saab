import { Timestamp } from 'firebase/firestore';

export interface ReviewPhoto {
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Timestamp;
}

export interface Review {
  id?: string;
  productId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  rating: number; // 1-5 stars
  comment: string;
  photos?: ReviewPhoto[]; // Array of photo URLs
  verifiedPurchase: boolean; // Whether user actually purchased the product
  helpfulCount: number; // Number of users who found this helpful
  helpfulUsers?: string[]; // Array of user IDs who marked as helpful
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductQA {
  id?: string;
  productId: string;
  question: string;
  askedBy: string; // User ID
  askedByName: string;
  answer?: string;
  answeredBy?: string; // Admin/User ID
  answeredByName?: string;
  answeredAt?: Timestamp;
  isPublic: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserGeneratedContent {
  id?: string;
  productId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  type: 'photo' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  isApproved: boolean;
  isFeatured: boolean;
  likes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

