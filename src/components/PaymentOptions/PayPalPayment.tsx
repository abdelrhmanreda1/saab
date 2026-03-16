'use client';

import React from 'react';
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { PaymentGateway } from '@/lib/firestore/payment_gateways';

interface PayPalPaymentProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  customerEmail?: string;
  customerName?: string;
}

const PayPalButtonWrapper: React.FC<{
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  customerEmail?: string;
  customerName?: string;
}> = ({ amount, currency, onSuccess, onError, customerEmail, customerName }) => {
  const [{ isResolved }] = usePayPalScriptReducer();

  const createOrder = async () => {
    try {
      const response = await fetch('/api/payments/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount.toFixed(2),
          currency: currency.toUpperCase(),
          customerEmail,
          customerName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create PayPal order');
      }

      return data.orderId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
      onError(errorMessage);
      throw error;
    }
  };

  const onApprove = async (data: { orderID: string }) => {
    try {
      const response = await fetch('/api/payments/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: data.orderID,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to capture payment');
      }

      if (result.status === 'COMPLETED') {
        onSuccess(data.orderID);
      } else {
        onError('Payment was not completed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment capture failed';
      onError(errorMessage);
    }
  };

  if (!isResolved) {
    return <div className="text-center py-4">Loading PayPal...</div>;
  }

  return (
    <PayPalButtons
      createOrder={createOrder}
      onApprove={onApprove}
      onError={(err) => {
        const errorMessage = (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') 
          ? err.message 
          : 'PayPal payment error';
        onError(errorMessage);
      }}
      style={{
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal',
      }}
    />
  );
};

const PayPalPayment: React.FC<PayPalPaymentProps> = ({
  onSuccess,
  onError,
  amount,
  currency,
  gateway,
  customerEmail,
  customerName,
}) => {
  const clientId = gateway.config.clientId;

  if (!clientId) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">PayPal is not configured. Please set up PayPal client ID in payment gateway settings.</p>
      </div>
    );
  }

  const paypalOptions = {
    clientId: clientId,
    currency: currency.toUpperCase(),
    intent: 'capture' as const,
  };

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Pay with PayPal</h3>
        <PayPalButtonWrapper
          amount={amount}
          currency={currency}
          onSuccess={onSuccess}
          onError={onError}
          customerEmail={customerEmail}
          customerName={customerName}
        />
      </div>
    </PayPalScriptProvider>
  );
};

export default PayPalPayment;

