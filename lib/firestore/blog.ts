import { Timestamp } from 'firebase/firestore';

export interface BlogPost {
  id: string;
  title: string;
  title_ar?: string;
  slug: string;
  excerpt: string;
  excerpt_ar?: string;
  content: string;
  content_ar?: string;
  coverImage?: string;
  author: string;
  isPublished: boolean;
  tags?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp;
}

