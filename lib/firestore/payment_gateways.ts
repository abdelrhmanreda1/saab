import { Timestamp } from 'firebase/firestore';

export type PaymentGatewayType = 'stripe' | 'paypal' | 'paystack' | 'razorpay' | 'flutterwave';

export interface PaymentGateway {
  id?: string;
  type: PaymentGatewayType;
  name: string; // Display name
  isActive: boolean;
  isTestMode: boolean; // Test/Live mode toggle
  
  // Configuration (varies by gateway)
  config: {
    // Stripe
    publishableKey?: string;
    
    // PayPal
    clientId?: string;
    clientSecret?: string;
    merchantId?: string;
    environment?: 'sandbox' | 'production';
    
    // Paystack
    publicKey?: string;
    
    // Razorpay
    keyId?: string;
    keySecret?: string;
    
    // Flutterwave
    encryptionKey?: string;
    
    // Common secret key (used by Stripe, Paystack, Flutterwave)
    secretKey?: string; // Stored securely, not exposed to client
  };
  
  // Supported regions
  supportedRegions?: string[]; // Country codes
  
  // Amount constraints
  minAmount?: number;
  maxAmount?: number;
  
  // Processing fee
  processingFee?: number;
  processingFeeType?: 'fixed' | 'percentage';
  
  // Display settings
  icon?: string; // Icon URL or emoji
  description?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentGatewayResponse {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

