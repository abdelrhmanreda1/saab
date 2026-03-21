'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function FlutterwaveProcessContent() {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get('transaction_id');
  const [, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      if (!transactionId) {
        setError('No transaction ID provided');
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
        
        // Call Firebase Function to process the payment
        window.location.href = `${functionsUrl}/flutterwaveProcess?transaction_id=${transactionId}`;
        
        // The function will redirect to success/cancel page after processing
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to process payment');
        setProcessing(false);
        setTimeout(() => {
          window.location.href = '/cancel';
        }, 3000);
      }
    };

    processPayment();
  }, [transactionId]);

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

export default function FlutterwaveProcessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <FlutterwaveProcessContent />
    </Suspense>
  );
}

