// d:\pardah\app\lib\firestore\banners.ts

import { Timestamp } from "firebase/firestore";

export interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  titleColor?: string; // Hex color for title text
  subtitleColor?: string; // Hex color for subtitle text
  linkTo?: string; // URL or product/category ID
  deviceType: 'desktop' | 'mobile' | 'both'; // Device type for banner display
  isActive: boolean;
  order: number; // For display order
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
