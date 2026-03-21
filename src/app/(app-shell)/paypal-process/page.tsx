'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PayPalProcessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const transactionId = searchParams.get('id');
  const amount = searchParams.get('amount');
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      if (!orderId || !transactionId) {
        setError('Missing payment information');
        setProcessing(false);
        setTimeout(() => {
          window.location.href = '/cancel';
        }, 3000);
        return;
      }

      try {
        // Get Firebase Functions URL
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const functionsUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 
          `https://us-central1-${projectId}.cloudfunctions.net`;
        
        // Build the redirect URL with query parameters
        const params = new URLSearchParams();
        params.append('order_id', orderId);
        params.append('id', transactionId);
        if (amount) params.append('amount', amount);
        
        // Redirect directly to Firebase Function - it will handle the final redirect
        const redirectUrl = `${functionsUrl}/paypalProcess?${params.toString()}`;
        window.location.href = redirectUrl;
        
        // The function will redirect to success/cancel page after processing
        // If redirect doesn't happen within 10 seconds, show error
        setTimeout(() => {
          if (processing) {
            setError('Payment processing is taking longer than expected. Please check your order status.');
            setProcessing(false);
          }
        }, 10000);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to process payment');
        setProcessing(false);
        setTimeout(() => {
          window.location.href = '/cancel';
        }, 3000);
      }
    };

    processPayment();
  }, [orderId, transactionId, amount, processing]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">Processing your payment...</p>
      </div>
    </div>
  );
}

export default function PayPalProcessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PayPalProcessContent />
    </Suspense>
  );
}

