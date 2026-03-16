import { Timestamp } from 'firebase/firestore';

export interface OrderNote {
  id?: string;
  orderId: string;
  note: string;
  isInternal: boolean; // true for internal notes, false for customer-visible notes
  createdBy: string; // User ID
  createdByName?: string;
  createdAt: Timestamp;
}

export interface OrderHistoryLog {
  id?: string;
  orderId: string;
  action: string; // 'status_change', 'note_added', 'fulfillment_started', 'shipment_created', etc.
  description: string;
  previousValue?: unknown;
  newValue?: unknown;
  performedBy: string; // User ID
  performedByName?: string;
  createdAt: Timestamp;
}

export interface OrderFulfillment {
  id?: string;
  orderId: string;
  fulfillmentNumber: string;
  status: 'pending' | 'processing' | 'picked' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  items: {
    itemId: string; // Reference to order item
    productId: string;
    productName: string;
    quantity: number;
    fulfilledQuantity: number;
  }[];
  warehouseId?: string;
  warehouseName?: string;
  pickedBy?: string;
  pickedByName?: string;
  pickedAt?: Timestamp;
  packedBy?: string;
  packedByName?: string;
  packedAt?: Timestamp;
  shippedBy?: string;
  shippedByName?: string;
  shippedAt?: Timestamp;
  trackingNumber?: string;
  carrierId?: string;
  carrierName?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderShipment {
  id?: string;
  orderId: string;
  fulfillmentId?: string;
  shipmentNumber: string;
  items: {
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
  }[];
  trackingNumber?: string;
  carrierId?: string;
  carrierName?: string;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
  shippingLabel?: {
    url: string;
    format: 'pdf' | 'png' | 'html';
    generatedAt: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderReturn {
  id?: string;
  orderId: string;
  returnNumber: string;
  items: {
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
    returnReason: string;
    returnType: 'return' | 'exchange';
    exchangeProductId?: string;
    exchangeProductName?: string;
  }[];
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'received' | 'processed' | 'refunded' | 'exchanged' | 'cancelled';
  requestedBy: string; // User ID
  requestedAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  receivedAt?: Timestamp;
  processedAt?: Timestamp;
  refundId?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderRefund {
  id?: string;
  orderId: string;
  returnId?: string;
  refundNumber: string;
  amount: number;
  reason: string;
  method: 'original' | 'store_credit' | 'wallet' | 'bank_transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processedBy?: string;
  processedAt?: Timestamp;
  completedAt?: Timestamp;
  transactionId?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

