import { Timestamp } from 'firebase/firestore';

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

export interface OrderItem {
  productId: string;
  productName: string; // Changed from 'name'
  productImage: string; // Added
  quantity: number;
  price: number;
  variant?: { // Updated variant structure
    id: string;
    name: string;
    value: string;
  };
}

export interface Order {
  id?: string; // Optional for new orders before they are saved to Firestore
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  taxBreakdown?: Array<{
    taxRateId: string;
    taxRateName: string;
    amount: number;
  }>;
  status: OrderStatus; // Using enum
  shippingAddress: { // Updated shipping address structure
    fullName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string; // Country name
    phone: string;
    email: string;
  };
  paymentMethod: 'cod' | 'stripe' | string; // Payment method (cod, stripe, or local payment method code)
  localPaymentMethodId?: string; // ID of local payment method if used
  paymentGatewayId?: string; // ID of payment gateway if used
  paymentIntentId?: string | null; // Stripe payment intent ID
  couponCode?: string | null; // Applied coupon code
  walletAmountUsed?: number; // Amount paid from wallet
  loyaltyPointsEarned?: number; // Loyalty points earned from this order
  shippingZoneId?: string;
  shippingRateId?: string;
  shippingCost?: number;
  carrierId?: string;
  carrierName?: string;
  trackingNumber?: string;
  cancellationReason?: string;
  cancelledAt?: Timestamp;
  giftMessage?: {
    recipientName?: string;
    message?: string;
    occasion?: string;
  };
  orderNote?: string;
  shippingMethod?: string;
  splitPayment?: {
    methods: {
      method: 'cod' | 'stripe' | 'wallet' | 'loyalty_points';
      amount: number;
    }[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
