'use client';

import React, { useState, useEffect } from 'react';
import { PaymentGateway } from '@/lib/firestore/payment_gateways';

interface RazorpayPaymentProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
}

declare global {
  interface Window {
    Razorpay: new (options: unknown) => { open: () => void } | undefined;
  }
}

const RazorpayPayment: React.FC<RazorpayPaymentProps> = ({
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
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const keyId = gateway.config.keyId;

  useEffect(() => {
    // Load Razorpay script
    if (!window.Razorpay && keyId) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      script.onerror = () => onError('Failed to load Razorpay script');
      document.body.appendChild(script);

      return () => {
        // Cleanup
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existingScript) {
          document.body.removeChild(existingScript);
        }
      };
    } else if (window.Razorpay) {
      setRazorpayLoaded(true);
    }
  }, [keyId, onError]);

  if (!keyId) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Razorpay is not configured. Please set up Razorpay key ID in payment gateway settings.</p>
      </div>
    );
  }

  const handlePayment = async () => {
    if (!razorpayLoaded || !window.Razorpay) {
      onError('Razorpay is not loaded. Please try again.');
      return;
    }

    setLoading(true);

    try {
      // Create order on backend
      const response = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
          currency: currency.toUpperCase(),
          customerEmail,
          customerName,
          customerPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Razorpay order');
      }

      const options = {
        key: keyId,
        amount: Math.round(amount * 100), // Amount in paise
        currency: currency.toUpperCase(),
        name: 'Pardah Store',
        description: 'Order Payment',
        order_id: data.orderId,
        handler: function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
          // Verify payment on backend
          verifyPayment(response);
        },
        prefill: {
          name: customerName || '',
          email: customerEmail,
          contact: customerPhone || '',
        },
        theme: {
          color: '#000000',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            onError('Payment was cancelled');
          },
        },
      };

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }
      const razorpay = new window.Razorpay(options);
      if (!razorpay) {
        throw new Error('Failed to initialize Razorpay');
      }
      razorpay.open();
    } catch (error) {
      setLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      onError(errorMessage);
    }
  };

  const verifyPayment = async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
    try {
      const verifyResponse = await fetch('/api/payments/razorpay/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });

      const data = await verifyResponse.json();

      if (!verifyResponse.ok || !data.verified) {
        throw new Error(data.error || 'Payment verification failed');
      }

      setLoading(false);
      onSuccess(response.razorpay_payment_id);
    } catch (error) {
      setLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Payment verification failed';
      onError(errorMessage);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Pay with Razorpay</h3>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Amount:</p>
          <p className="text-2xl font-bold">{currency.toUpperCase()} {amount.toFixed(2)}</p>
        </div>
        <button
          onClick={handlePayment}
          disabled={loading || !razorpayLoaded}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : !razorpayLoaded ? 'Loading...' : `Pay ${currency.toUpperCase()} ${amount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

export default RazorpayPayment;

