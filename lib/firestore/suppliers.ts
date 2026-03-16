import { Timestamp } from 'firebase/firestore';

export interface Supplier {
  id?: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  taxId?: string;
  paymentTerms: string; // e.g., "Net 30", "COD"
  notes?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id?: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  expectedDeliveryDate?: Timestamp;
  receivedDate?: Timestamp;
  notes?: string;
  createdBy: string; // User ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InventoryAlert {
  id?: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  currentStock: number;
  threshold: number;
  alertType: 'low' | 'out_of_stock';
  isResolved: boolean;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
}

