import { Timestamp } from 'firebase/firestore';

export interface Warehouse {
  id?: string;
  name: string;
  code: string; // Unique warehouse code (e.g., "WH-001")
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode?: string;
  };
  contact: {
    phone?: string;
    email?: string;
    managerName?: string;
  };
  isActive: boolean;
  isDefault: boolean; // Default warehouse for new products
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StockTransfer {
  id?: string;
  transferNumber: string; // Unique transfer number
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  items: {
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
  }[];
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
  requestedBy: string; // User ID
  requestedByName?: string;
  approvedBy?: string; // Admin user ID
  approvedAt?: Timestamp;
  completedBy?: string; // User ID who completed the transfer
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StockAdjustment {
  id?: string;
  adjustmentNumber: string; // Unique adjustment number
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  reason: string; // e.g., "Damaged", "Found", "Theft", "Expired", "Returned"
  notes?: string;
  adjustedBy: string; // User ID
  adjustedByName?: string;
  createdAt: Timestamp;
}

export interface StockHistory {
  id?: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  movementType: 'transfer_in' | 'transfer_out' | 'adjustment' | 'sale' | 'return' | 'purchase';
  quantity: number; // Positive for increase, negative for decrease
  previousStock: number;
  newStock: number;
  referenceId?: string; // Order ID, Transfer ID, Adjustment ID, etc.
  referenceNumber?: string; // Order number, Transfer number, etc.
  notes?: string;
  createdBy?: string; // User ID
  createdAt: Timestamp;
}

