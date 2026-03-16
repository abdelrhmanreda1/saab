import { Timestamp } from 'firebase/firestore';

export interface SalesFunnelStage {
  stage: 'visitors' | 'views' | 'cart' | 'checkout' | 'purchases';
  count: number;
  percentage: number;
  dropoffRate?: number;
}

export interface CustomerBehavior {
  userId: string;
  userName: string;
  userEmail?: string;
  sessions: number;
  pageViews: number;
  productsViewed: string[];
  productsPurchased: string[];
  totalSpent: number;
  averageOrderValue: number;
  lastActivity: Timestamp;
  preferredCategories?: string[];
  preferredBrands?: string[];
  cartAbandonmentRate?: number;
  returnCustomer: boolean;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  views: number;
  clicks: number;
  addToCart: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
  returnRate: number;
  rating?: number;
  reviewCount?: number;
  period: {
    start: Timestamp;
    end: Timestamp;
  };
}

export interface MarketingCampaign {
  id?: string;
  name: string;
  type: 'email' | 'push' | 'banner' | 'coupon' | 'social';
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: Timestamp;
  endDate?: Timestamp;
  budget?: number;
  spent?: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number; // Return on Investment
  ctr: number; // Click-through rate
  conversionRate: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InventoryReport {
  productId: string;
  productName: string;
  category: string;
  brand?: string;
  currentStock: number;
  initialStock: number;
  unitsSold: number;
  unitsReceived: number;
  unitsAdjusted: number;
  stockValue: number;
  salesValue: number;
  turnoverRate: number;
  daysOfStock: number;
  lowStockAlert: boolean;
  period: {
    start: Timestamp;
    end: Timestamp;
  };
}

export interface FinancialReport {
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  revenue: {
    total: number;
    productSales: number;
    shipping: number;
    taxes: number;
  };
  costs: {
    total: number;
    productCost: number;
    shipping: number;
    marketing: number;
    operational: number;
  };
  profit: {
    gross: number;
    net: number;
    margin: number; // percentage
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    refunded: number;
  };
  taxes: {
    collected: number;
    paid: number;
  };
}

export interface CustomReportTemplate {
  id?: string;
  name: string;
  description?: string;
  type: 'sales' | 'products' | 'customers' | 'inventory' | 'financial' | 'marketing' | 'custom';
  filters: {
    dateRange?: {
      start: Timestamp;
      end: Timestamp;
    };
    categories?: string[];
    brands?: string[];
    products?: string[];
    customers?: string[];
    orderStatus?: string[];
    [key: string]: unknown;
  };
  metrics: string[]; // Array of metric names to include
  format: 'table' | 'chart' | 'both';
  chartType?: 'line' | 'bar' | 'pie' | 'area';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface ScheduledReport {
  id?: string;
  templateId: string;
  templateName: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:MM format
    timezone: string;
  };
  recipients: string[]; // Email addresses
  format: 'pdf' | 'excel' | 'csv' | 'html';
  enabled: boolean;
  lastRun?: Timestamp;
  nextRun?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

