'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { motion } from 'framer-motion';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const transactionId = searchParams.get('transaction_id');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Clear cart when payment is successful
    clearCart();
  }, [clearCart]);

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
      router.push('/account/orders');
    }
  }, [countdown, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
              className="w-12 h-12 text-green-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-heading font-bold text-white mb-3"
          >
            {t('checkout.success.title') || 'Payment Successful!'}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-green-50 text-lg"
          >
            {t('checkout.success.message') || 'Thank you for your order. We\'ve received your payment.'}
          </motion.p>
        </div>

        {/* Order Details */}
        <div className="p-8 space-y-6">
          {amount && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200"
            >
              <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">
                {t('checkout.success.payment_amount') || 'Payment Amount'}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatPrice(parseFloat(amount))}
              </p>
            </motion.div>
          )}

          {orderId && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-50 rounded-xl p-6 border border-gray-200"
            >
              <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">
                {t('checkout.success.order_id') || 'Order ID'}
              </p>
              <p className="text-lg font-mono font-bold text-gray-900 tracking-wider">
                {orderId}
              </p>
            </motion.div>
          )}

          {transactionId && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gray-50 rounded-xl p-6 border border-gray-200"
            >
              <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">
                {t('checkout.success.transaction_id') || 'Transaction ID'}
              </p>
              <p className="text-sm font-mono text-gray-700 break-all">
                {transactionId}
              </p>
            </motion.div>
          )}

          {/* Next Steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-blue-50 rounded-xl p-6 border border-blue-100"
          >
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  {t('checkout.success.next_steps') || 'What\'s Next?'}
                </p>
                <p className="text-sm text-blue-700">
                  {t('checkout.success.next_steps_message') || 'You\'ll receive an order confirmation email shortly with all the details.'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="space-y-3 pt-4"
          >
            <Link
              href="/account/orders"
              className="block w-full bg-black text-white px-6 py-4 rounded-xl font-semibold hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl text-center"
            >
              {t('checkout.success.view_orders') || 'View Orders'}
            </Link>
            
            <Link
              href="/shop"
              className="block w-full bg-white text-gray-900 px-6 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-all border-2 border-gray-200 text-center"
            >
              {t('checkout.success.continue_shopping') || 'Continue Shopping'}
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-sm text-gray-500 pt-4"
          >
            {(t('checkout.success.redirecting') || 'Redirecting to orders page in {seconds} seconds...')
              .replace('{seconds}', String(countdown))}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

