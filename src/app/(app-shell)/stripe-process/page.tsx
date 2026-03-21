'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function StripeProcessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      if (!sessionId) {
        setError('No session ID provided');
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
        // Note: Firebase Functions redirect, so we need to handle it differently
        // Instead of fetch, we'll redirect directly and let the function handle it
        window.location.href = `${functionsUrl}/stripeProcess?session_id=${sessionId}`;
        
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
  }, [sessionId]);

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

export default function StripeProcessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <StripeProcessContent />
    </Suspense>
  );
}
