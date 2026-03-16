import { Timestamp } from 'firebase/firestore';

export interface ShippingZone {
  id?: string;
  name: string;
  description?: string;
  countries: string[]; // Array of country IDs
  states?: string[]; // Optional: Array of state IDs (if specific states within countries)
  cities?: string[]; // Optional: Array of city IDs (if specific cities)
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ShippingRate {
  id?: string;
  zoneId: string;
  zoneName: string;
  name: string; // e.g., "Standard Shipping", "Express Shipping"
  description?: string;
  carrierId?: string; // Optional: Link to carrier
  carrierName?: string;
  rateType: 'flat' | 'weight_based' | 'price_based' | 'free';
  flatRate?: number; // For flat rate
  weightRanges?: { // For weight-based rates
    minWeight: number; // in kg
    maxWeight: number; // in kg
    rate: number;
  }[];
  priceRanges?: { // For price-based rates
    minPrice: number;
    maxPrice: number;
    rate: number;
  }[];
  freeShippingThreshold?: number; // Minimum order amount for free shipping
  estimatedDays: number; // Estimated delivery days
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ShippingCarrier {
  id?: string;
  name: string; // e.g., "FedEx", "DHL", "TCS", "Leopard Courier"
  code: string; // Unique code: "fedex", "dhl", "tcs", etc.
  website?: string;
  phone?: string;
  email?: string;
  trackingUrl?: string; // Template URL with {tracking_number} placeholder
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderTracking {
  id?: string;
  orderId: string;
  trackingNumber?: string;
  carrierId?: string;
  carrierName?: string;
  carrierCode?: string;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  estimatedDelivery?: Timestamp;
  lastUpdate?: Timestamp;
  trackingHistory?: {
    status: string;
    location?: string;
    timestamp: Timestamp;
    description?: string;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

