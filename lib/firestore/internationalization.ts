import { Timestamp } from 'firebase/firestore';

export interface Language {
  id?: string;
  code: string; // e.g., 'en', 'ur', 'ar'
  name: string; // e.g., 'English', 'Urdu', 'Arabic'
  nativeName: string; // e.g., 'English', 'اردو', 'العربية'
  isRTL: boolean; // Right-to-left
  isActive: boolean;
  flag?: string; // Flag emoji or URL
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Currency {
  id?: string;
  code: string;
  name: string; 
  symbol: string;
  symbolPosition: 'left' | 'right';
  decimalPlaces: number;
  isActive: boolean;
  isDefault: boolean; // Default currency for the store
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CurrencyConversion {
  id?: string;
  fromCurrency: string; // Currency code
  toCurrency: string; // Currency code
  rate: number;
  source: 'manual' | 'api'; // Manual or from API
  apiProvider?: string; // e.g., 'openexchangerates', 'fixer'
  lastUpdated: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaxRate {
  id?: string;
  name: string; // e.g., 'GST', 'VAT', 'Sales Tax'
  rate: number; // Percentage (e.g., 18 for 18%)
  type: 'percentage' | 'fixed';
  region: string; // Country code or region identifier (kept for backward compatibility)
  countries?: string[]; // Array of country IDs or names
  states?: string[]; // Optional: Array of state IDs or names (if specific states within countries)
  cities?: string[]; // Optional: Array of city IDs or names (if specific cities)
  applicableTo: 'all' | 'products' | 'shipping' | 'both';
  productCategories?: string[]; // If applicableTo is 'products', specific categories
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LocalPaymentMethod {
  id?: string;
  name: string; // e.g., 'JazzCash', 'EasyPaisa', 'Bank Transfer'
  code: string; // e.g., 'jazzcash', 'easypaisa', 'bank_transfer'
  type: 'wallet' | 'bank' | 'card' | 'manual';
  icon?: string; // Icon URL or emoji
  isActive: boolean;
  // Configuration based on type
  config?: {
    accountNumber?: string;
    accountTitle?: string;
    bankName?: string;
    iban?: string;
    swiftCode?: string;
    instructions?: string; // For manual methods
    apiKey?: string; // For API-based methods
    merchantId?: string;
    apiUrl?: string;
  };
  supportedRegions?: string[]; // Country codes where this method is available
  minAmount?: number;
  maxAmount?: number;
  processingFee?: number; // Fixed or percentage
  processingFeeType?: 'fixed' | 'percentage';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

