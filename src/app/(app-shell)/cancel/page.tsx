'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { motion } from 'framer-motion';

function CancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const error = searchParams.get('error');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer for redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Separate effect to handle redirect when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      router.push('/checkout');
    }
  }, [countdown, router]);

  const getErrorMessage = () => {
    if (!error) return null;
    const errorMessages: Record<string, string> = {
      payment_failed: t('checkout.cancel.error_payment_failed') || 'Payment failed. Please try again.',
      order_not_found: t('checkout.cancel.error_order_not_found') || 'Order not found. Please contact support.',
      stripe_not_configured: t('checkout.cancel.error_gateway_not_configured') || 'Payment gateway not configured.',
      no_session_id: t('checkout.cancel.error_invalid_session') || 'Invalid payment session.',
    };
    return errorMessages[error] || error;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Cancel Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-8 py-12 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
              className="w-12 h-12 text-orange-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-heading font-bold text-white mb-3"
          >
            {t('checkout.cancel.title') || 'Payment Cancelled'}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-orange-50 text-lg"
          >
            {t('checkout.cancel.message') || 'Your payment was not completed. No charges were made.'}
          </motion.p>
        </div>

        {/* Error Details */}
        <div className="p-8 space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-red-50 rounded-xl p-6 border border-red-200"
            >
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-900 mb-1">
                    {t('checkout.cancel.error_title') || 'What happened?'}
                  </p>
                  <p className="text-sm text-red-700">
                    {getErrorMessage()}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Help Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-blue-50 rounded-xl p-6 border border-blue-100"
          >
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  {t('checkout.cancel.need_help') || 'Need Help?'}
                </p>
                <p className="text-sm text-blue-700 mb-3">
                  {t('checkout.cancel.help_message') || 'If you continue to experience issues, please contact our support team.'}
                </p>
                <Link
                  href="/contact"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                >
                  {t('checkout.cancel.contact_support') || 'Contact Support'}
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-3 pt-4"
          >
            <Link
              href="/checkout"
              className="block w-full bg-black text-white px-6 py-4 rounded-xl font-semibold hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl text-center"
            >
              {t('checkout.cancel.try_again') || 'Try Again'}
            </Link>
            
            <Link
              href="/shop"
              className="block w-full bg-white text-gray-900 px-6 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-all border-2 border-gray-200 text-center"
            >
              {t('checkout.cancel.continue_shopping') || 'Continue Shopping'}
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-gray-500 pt-4"
          >
            {t('checkout.cancel.redirecting', { seconds: countdown }) || `Redirecting to checkout in ${countdown} seconds...`}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CancelContent />
    </Suspense>
  );
}

