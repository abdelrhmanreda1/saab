'use client';

import React, { useState, useEffect, use, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getOrder } from '@/lib/firestore/orders_db';
import { getOrderTracking } from '@/lib/firestore/shipping_db';
import { Order } from '@/lib/firestore/orders';
import { OrderTracking } from '@/lib/firestore/shipping';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/context/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';
import { LanguageContext } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';

const OrderDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);
  const { demoUser } = useAuth();
  const { settings } = useSettings();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const fetchOrderFromApi = async (firebaseUser: { getIdToken: () => Promise<string> }, id: string) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(`/api/account/orders/${id}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to fetch order');
    }

    return result.order as Order;
  };

  useEffect(() => {
    if (!orderId) {
      router.push('/account/orders');
      return;
    }

    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      const loadOrder = async () => {
        try {
          const orderData = await getOrder(orderId);
          if (orderData && orderData.userId === demoUser.uid) {
            setOrder(orderData);
            const trackingData = await getOrderTracking(orderId);
            if (trackingData) {
              setTracking(trackingData);
            }
          } else {
            router.push('/account/orders');
          }
        } catch {
          // Error fetching order
          router.push('/account/orders');
        }
        setLoading(false);
      };
      loadOrder();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const orderData = await fetchOrderFromApi(currentUser, orderId);
          if (orderData) {
            setOrder(orderData);
            const trackingData = await getOrderTracking(orderId);
            if (trackingData) {
              setTracking(trackingData);
            }
          }
        } catch {
          // Error fetching order
          router.push('/account/orders');
        }
      } else {
        // Check for demo user before redirecting
        if (settings?.demoMode && demoUser) {
          // Demo user already loaded in first useEffect, load order
          const loadOrder = async () => {
            try {
              const orderData = await getOrder(orderId);
              if (orderData && orderData.userId === demoUser.uid) {
                setOrder(orderData);
                const trackingData = await getOrderTracking(orderId);
                if (trackingData) {
                  setTracking(trackingData);
                }
              } else {
                router.push('/account/orders');
              }
            } catch {
              // Error fetching order
              router.push('/account/orders');
            }
            setLoading(false);
          };
          loadOrder();
          return;
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, orderId, demoUser, settings?.demoMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {t('account.order_details.not_found_title')}
          </h1>
          <Link href="/account/orders" className="text-blue-600 hover:underline">
            {t('account.order_details.back_to_orders')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl py-12">
      <div className="mb-6">
        <Link
          href="/account/orders"
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('account.order_details.back_to_orders')}
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">
                {t('account.order_details.title')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('account.order_details.order_label')} #{order.id}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              order.status === 'delivered' ? 'bg-green-100 text-green-700' : 
              order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
              order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {order.status}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Tracking Information */}
          {(tracking?.trackingNumber || order.trackingNumber) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-2">
                {t('account.order_details.tracking_title')}
              </h3>
              <p className="text-sm text-gray-700">
                <strong>{t('account.order_details.tracking_number')}:</strong> {tracking?.trackingNumber || order.trackingNumber}
              </p>
              {tracking?.carrierName && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>{t('account.order_details.carrier')}:</strong> {tracking.carrierName}
                </p>
              )}
              {(tracking?.trackingNumber || order.trackingNumber) && (
                <p className="text-sm text-gray-500 mt-2">
                  {t('account.order_details.tracking_help')}
                </p>
              )}
            </div>
          )}

          {/* Order Items */}
          <div>
            <h3 className="text-lg font-bold mb-4">
              {t('account.order_details.items_title')}
            </h3>
            <div className="space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start border-b border-gray-100 pb-4">
                  <div className="relative w-20 h-24 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                    {item.productImage ? (
                      <Image src={item.productImage} alt={item.productName} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        {t('account.order_details.no_image')}
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-medium text-lg">{item.productName}</h4>
                    {item.variant && (
                      <p className="text-sm text-gray-500 mt-1">
                        {item.variant.name}: {item.variant.value}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {t('account.order_details.quantity')}: {item.quantity}
                    </p>
                    <p className="font-medium mt-2">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <h3 className="text-lg font-bold mb-4">
              {t('account.order_details.shipping_address')}
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium">{order.shippingAddress?.fullName}</p>
              <p className="text-gray-600">{order.shippingAddress?.address}</p>
              <p className="text-gray-600">
                {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zipCode}
              </p>
              <p className="text-gray-600">{order.shippingAddress?.phone}</p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-bold mb-4">
              {t('account.order_details.summary_title')}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>{t('account.order_details.subtotal')}</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
              {order.shippingCost && (
                <div className="flex justify-between text-gray-600">
                  <span>{t('account.order_details.shipping')}</span>
                  <span>{formatPrice(order.shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                <span>{t('account.order_details.total')}</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;

