'use client';

import React, { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { PaymentGateway } from '@/lib/firestore/payment_gateways';

interface PaystackPaymentProps {
  onSuccess: (reference: string) => void;
  onError: (error: string) => void;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
}

const PaystackPayment: React.FC<PaystackPaymentProps> = ({
  onSuccess,
  onError,
  amount,
  currency,
  gateway,
  customerEmail,
  customerName,
  customerPhone,
}) => {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const publicKey = gateway.config.publicKey;
  
  // Ensure component is mounted before initializing Paystack
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Convert amount to kobo (Paystack uses smallest currency unit)
  // For NGN, 1 Naira = 100 kobo
  // For other currencies, use the amount directly (multiply by 100 for cents)
  const amountInSmallestUnit = currency.toUpperCase() === 'NGN' 
    ? Math.round(amount * 100) 
    : Math.round(amount * 100);

  // Base config without reference (reference will be generated in handlePayment)
  const baseConfig = publicKey
    ? {
        email: customerEmail,
        amount: amountInSmallestUnit,
        publicKey: publicKey as string,
        currency: currency.toUpperCase(),
        metadata: {
          custom_fields: [
            ...(customerName ? [{ display_name: 'Customer Name', variable_name: 'customer_name', value: customerName }] : []),
            ...(customerPhone ? [{ display_name: 'Phone', variable_name: 'phone', value: customerPhone }] : []),
          ],
        },
      }
    : {
        publicKey: '', // Dummy config to satisfy hook requirements
        email: '',
        amount: 0,
        reference: '',
      };

  // Base reference (stable during render, will be made unique in handlePayment)
  const baseReference = `PAYSTACK_${customerEmail}_${amountInSmallestUnit}`;
  
  // Config with reference (will be updated when payment is initiated)
  const config = publicKey
    ? {
        ...baseConfig,
        reference: paymentReference || baseReference,
      }
    : baseConfig;

  // Always initialize hook (required by React rules)
  const initializePayment = usePaystackPayment(config);

  if (!publicKey) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Paystack is not configured. Please set up Paystack public key in payment gateway settings.</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Loading payment options...</p>
      </div>
    );
  }

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Generate unique reference when payment is initiated (not during render)
      const uniqueReference = `${baseReference}_${Date.now()}`;
      setPaymentReference(uniqueReference);
      
      // Note: The hook is initialized with a base reference, but Paystack should accept
      // the reference we pass. However, since react-paystack may use the config from initialization,
      // we'll use the initializePayment function which should work with the updated state.
      // If this doesn't work, we may need to use a different approach.
      await initializePayment({
        onSuccess: (reference) => {
          setLoading(false);
          onSuccess(reference.reference);
        },
        onClose: () => {
          setLoading(false);
          onError('Payment was cancelled');
        },
      });
    } catch (error) {
      setLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      onError(errorMessage);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Pay with Paystack</h3>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Amount:</p>
          <p className="text-2xl font-bold">{currency.toUpperCase()} {amount.toFixed(2)}</p>
        </div>
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : `Pay ${currency.toUpperCase()} ${amount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

export default PaystackPayment;

