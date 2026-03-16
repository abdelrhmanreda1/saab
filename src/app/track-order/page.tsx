'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getOrder } from '@/lib/firestore/orders_db';
import { getOrderTracking } from '@/lib/firestore/shipping_db';
import { Order } from '@/lib/firestore/orders';
import { OrderTracking } from '@/lib/firestore/shipping';
import { validateRequired } from '@/lib/utils/validation';

const TrackOrder = () => {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderIdError, setOrderIdError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate order ID
    const validation = validateRequired(orderId.trim(), 'Order ID');
    if (!validation.isValid) {
      setOrderIdError(validation.error || 'Order ID is required');
      setTouched(true);
      return;
    }
    
    setOrderIdError(null);

    setLoading(true);
    setSearched(false);
    setOrder(null);
    setTracking(null);
    setError(null);

    try {
      // Fetch order by ID
      const fetchedOrder = await getOrder(orderId.trim());
      
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setSearched(true);
        
        // Fetch tracking information if available
        if (fetchedOrder.id) {
          try {
            const trackingData = await getOrderTracking(fetchedOrder.id);
            if (trackingData) {
              setTracking(trackingData);
            }
          } catch {
            // Tracking not found is okay, continue without it
            // No tracking information found
          }
        }
      } else {
        setSearched(true);
        setError(
          t('track_order.not_found_message') ||
            'Order not found. Please check your Order ID and try again.'
        );
      }
    } catch (err: unknown) {
      // Failed to track order
      setSearched(true);
      const fallback = t('track_order.error_generic') || 'Failed to track order. Please try again.';
      const errorMessage = err instanceof Error ? err.message || fallback : fallback;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'bg-green-500';
      case 'shipped':
      case 'in_transit':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return '100%';
      case 'shipped':
      case 'in_transit':
        return '66%';
      case 'processing':
        return '33%';
      default:
        return '0%';
    }
  };

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {t('track_order.title') || 'Track Your Order'}
          </h1>
          <p className="text-gray-500">
            {t('track_order.subtitle') || "Stay updated on your parcel's journey."}
          </p>
        </div>
      </div>

      <div className="page-container max-w-lg">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <form onSubmit={handleTrack} className="space-y-6">
                <div>
                    <label
                      htmlFor="orderId"
                      className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500"
                    >
                      {t('track_order.order_id_label') || 'Order ID'}
                    </label>
                    <input
                        type="text"
                        id="orderId"
                        placeholder={t('track_order.order_id_placeholder') || 'e.g., 123456'}
                        className={`w-full bg-gray-50 border rounded-lg p-4 focus:ring-1 focus:ring-black outline-none transition-all text-lg font-medium ${
                          touched && orderIdError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-black'
                        }`}
                        value={orderId}
                        onChange={(e) => {
                          setOrderId(e.target.value);
                          if (orderIdError) setOrderIdError(null);
                        }}
                        onBlur={() => {
                          setTouched(true);
                          const validation = validateRequired(orderId.trim(), 'Order ID');
                          if (!validation.isValid) {
                            setOrderIdError(validation.error || 'Order ID is required');
                          }
                        }}
                    />
                    {touched && orderIdError && (
                      <p className="mt-1 text-xs text-red-600">{orderIdError}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {t('track_order.order_id_hint') ||
                        'Found in your order confirmation email.'}
                    </p>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-white py-4 rounded-lg font-heading font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                    {loading && (
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {loading
                      ? t('track_order.button_loading') || 'Tracking...'
                      : t('track_order.button') || 'Track Order'}
                </button>
            </form>

            {loading && !searched && (
                <div className="mt-8 p-6 rounded-xl border bg-white border-gray-200 animate-pulse">
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3" />
                            <div className="h-6 bg-gray-200 rounded w-32 mx-auto mb-1" />
                            <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2" />
                        <div className="space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-full" />
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                            <div className="h-20 bg-gray-200 rounded-lg" />
                        </div>
                    </div>
                </div>
            )}

            {searched && (
                <div className={`mt-8 p-6 rounded-xl border ${error ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                    {order ? (
                        <div className="space-y-6">
                            {/* Order Status Header */}
                            <div className="text-center">
                                <div className={`w-16 h-16 ${getStatusColor(order.status)} rounded-full flex items-center justify-center mx-auto mb-3`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 text-xl mb-1 capitalize">
                                  {order.status.replace('_', ' ')}
                                </h3>
                                <p className="text-gray-600 text-sm">
                                  {t('track_order.order_id_label') || 'Order ID'}:{' '}
                                  <strong className="font-mono">{order.id}</strong>
                                </p>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className={`${getStatusColor(order.status)} h-2 rounded-full transition-all duration-500`}
                                    style={{ width: getStatusProgress(order.status) }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600 mt-1 font-medium uppercase tracking-wider">
                                <span
                                  className={
                                    order.status === 'pending' || order.status === 'processing'
                                      ? 'text-black font-bold'
                                      : ''
                                  }
                                >
                                  {t('track_order.status_pending') || 'Pending'}
                                </span>
                                <span
                                  className={
                                    order.status === 'processing' || order.status === 'shipped'
                                      ? 'text-black font-bold'
                                      : ''
                                  }
                                >
                                  {t('track_order.status_processing') || 'Processing'}
                                </span>
                                <span
                                  className={
                                    order.status === 'shipped' || order.status === 'delivered'
                                      ? 'text-black font-bold'
                                      : ''
                                  }
                                >
                                  {t('track_order.status_shipped') || 'Shipped'}
                                </span>
                                <span
                                  className={
                                    order.status === 'delivered' ? 'text-black font-bold' : ''
                                  }
                                >
                                  {t('track_order.status_delivered') || 'Delivered'}
                                </span>
                            </div>

                            {/* Order Details */}
                            <div className="border-t border-gray-200 pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500 mb-1">
                                          {t('track_order.order_date') || 'Order Date'}
                                        </p>
                                        <p className="font-semibold text-gray-900">
                                            {order.createdAt ? (() => {
                                                const date = order.createdAt.toDate();
                                                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                                            })() : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 mb-1">
                                          {t('track_order.total_amount') || 'Total Amount'}
                                        </p>
                                        <p className="font-semibold text-gray-900">
                                          {formatPrice(order.totalAmount)}
                                        </p>
                                    </div>
                                </div>

                                {/* Tracking Number */}
                                {(tracking?.trackingNumber || order.trackingNumber) && (
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <p className="text-gray-500 text-sm mb-1">
                                          {t('track_order.tracking_number') || 'Tracking Number'}
                                        </p>
                                        <p className="font-mono font-bold text-gray-900">{tracking?.trackingNumber || order.trackingNumber}</p>
                                        {tracking?.carrierName && (
                                            <p className="text-gray-600 text-sm mt-1">
                                              {t('track_order.carrier', {
                                                carrier: tracking.carrierName,
                                              }) || `Carrier: ${tracking.carrierName}`}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Shipping Address */}
                                <div>
                                    <p className="text-gray-500 text-sm mb-2">
                                      {t('track_order.shipping_address') || 'Shipping Address'}
                                    </p>
                                    <p className="text-gray-900 text-sm">
                                        {order.shippingAddress.fullName}<br />
                                        {order.shippingAddress.address}<br />
                                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}<br />
                                        {order.shippingAddress.country || 'Pakistan'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-red-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-red-800 text-lg mb-1">
                              {t('track_order.not_found_title') || 'Order Not Found'}
                            </h3>
                            <p className="text-red-700 text-sm">
                              {error ||
                                t('track_order.not_found_message') ||
                                'Please check your Order ID and try again.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
        
        <div className="mt-8 text-center">
             <p className="text-gray-500 text-sm">
              {t('track_order.help_text') || 'Having trouble?'}{' '}
              <Link href="/contact" className="text-gray-900 font-medium underline hover:text-gray-600">
                {t('track_order.contact_support') || 'Contact Support'}
              </Link>
             </p>
        </div>
      </div>
    </div>
  );
};

export default TrackOrder;
