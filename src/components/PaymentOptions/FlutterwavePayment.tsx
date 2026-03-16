'use client';

import React, { useState } from 'react';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { PaymentGateway } from '@/lib/firestore/payment_gateways';

interface FlutterwavePaymentProps {
  onSuccess: (transactionId: string) => void;
  onError: (error: string) => void;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
}

const FlutterwavePayment: React.FC<FlutterwavePaymentProps> = ({
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
  const publicKey = gateway.config.publicKey;
  const config = publicKey
    ? {
        public_key: publicKey as string,
        // Use a stable, deterministic reference based on props instead of Date.now()
        tx_ref: `FLW_${customerEmail}_${amount}`,
        amount,
        currency: currency.toUpperCase(),
        payment_options: 'card,mobilemoney,ussd',
        customer: {
          email: customerEmail,
          name: customerName || 'Customer',
          phone_number: customerPhone || '',
        },
        customizations: {
          title: 'Pardah Store',
          description: 'Order Payment',
          logo: '/favicon.ico',
        },
      }
    : ({} as never);

  const handleFlutterPayment = useFlutterwave(config);

  if (!publicKey) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Flutterwave is not configured. Please set up Flutterwave public key in payment gateway settings.</p>
      </div>
    );
  }

  const handlePayment = () => {
    setLoading(true);
    handleFlutterPayment({
      callback: (response: { status: string; transaction_id: number }) => {
        setLoading(false);
        if (response.status === 'successful') {
          onSuccess(String(response.transaction_id));
        } else {
          onError('Payment was not successful');
        }
        closePaymentModal();
      },
      onClose: () => {
        setLoading(false);
        onError('Payment was cancelled');
      },
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Pay with Flutterwave</h3>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Amount:</p>
          <p className="text-2xl font-bold">{currency.toUpperCase()} {amount.toFixed(2)}</p>
        </div>
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : `Pay ${currency.toUpperCase()} ${amount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

export default FlutterwavePayment;

