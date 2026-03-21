'use client';

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getOrder } from '@/lib/firestore/orders_db';
import { addReturnExchangeRequest } from '@/lib/firestore/user_account_db';
import { Order } from '@/lib/firestore/orders';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { LanguageContext } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';

const ReturnExchangePage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<'return' | 'exchange'>('return');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [reasons, setReasons] = useState<{ [key: number]: string }>({});
  const router = useRouter();
  const params = useParams();
  const orderId = (params?.id as string) || '';
  const auth = getAuth(app);
  const { demoUser } = useAuth();
  const { settings } = useSettings();
  const { showError, showSuccess } = useToast();
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
      setUser(null); // No Firebase Auth user in demo mode
      const loadOrder = async () => {
        try {
          const orderData = await getOrder(orderId);
          if (orderData && orderData.userId === demoUser.uid) {
            setOrder(orderData);
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
        setUser(currentUser);
        try {
          const orderData = await fetchOrderFromApi(currentUser, orderId);
          if (orderData) {
            setOrder(orderData);
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
  }, [auth, router, orderId, settings?.demoMode, demoUser]);

  const handleItemToggle = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
      const newReasons = { ...reasons };
      delete newReasons[index];
      setReasons(newReasons);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId || !order || selectedItems.size === 0) {
      showError(t('account.returns.items_label') || 'Please select at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const items = Array.from(selectedItems).map(index => ({
        orderItemId: `item-${index}`,
        productId: order.items[index].productId,
        productName: order.items[index].productName,
        variantId: order.items[index].variant?.id,
        quantity: order.items[index].quantity,
        reason: reasons[index] || 'Not specified',
      }));

      await addReturnExchangeRequest({
        orderId: order.id!,
        userId: userId,
        type: requestType,
        items,
        reason: Object.values(reasons).join(', '),
        status: 'pending',
      });

      showSuccess(t('account.returns.submit_success') || 'Return/Exchange request submitted successfully!');
      router.push('/account/orders');
    } catch {
      // Error submitting request
      showError(t('account.returns.submit_failed') || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

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
          href={`/account/orders/${orderId}`}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('account.order_details.back_to_orders')}
        </Link>
      </div>

      <h1 className="text-4xl font-heading font-bold mb-8">
        {t('account.returns.page_title')}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('account.returns.request_title_return')} / {t('account.returns.request_title_exchange')} *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requestType"
                value="return"
                checked={requestType === 'return'}
                onChange={(e) => setRequestType(e.target.value as 'return' | 'exchange')}
                className="w-4 h-4"
              />
              <span>{t('account.returns.request_title_return')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requestType"
                value="exchange"
                checked={requestType === 'exchange'}
                onChange={(e) => setRequestType(e.target.value as 'return' | 'exchange')}
                className="w-4 h-4"
              />
              <span>{t('account.returns.request_title_exchange')}</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            {t('account.returns.items_label')} *
          </label>
          <div className="space-y-4">
            {order.items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(index)}
                    onChange={() => handleItemToggle(index)}
                    className="mt-1 w-5 h-5"
                  />
                  <div className="flex-grow">
                    <h4 className="font-medium">{item.productName}</h4>
                    {item.variant && (
                      <p className="text-sm text-gray-500">{item.variant.name}: {item.variant.value}</p>
                    )}
                    <p className="text-sm text-gray-500">{(t('account.orders.quantity_label') || 'Quantity:')} {item.quantity}</p>
                    {selectedItems.has(index) && (
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          {t('account.returns.reason_label')} *
                        </label>
                        <select
                          value={reasons[index] || ''}
                          onChange={(e) => setReasons({ ...reasons, [index]: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
                        >
                          <option value="">{t('account.returns.reason_label')}</option>
                          <option value="defective">{t('account.returns.defective') || 'Defective/Damaged'}</option>
                          <option value="wrong_item">{t('account.returns.wrong_item') || 'Wrong Item'}</option>
                          <option value="size_issue">{t('account.returns.size_issue') || 'Size Issue'}</option>
                          <option value="quality_issue">{t('account.returns.quality_issue') || 'Quality Issue'}</option>
                          <option value="not_as_described">{t('account.returns.not_as_described') || 'Not as Described'}</option>
                          <option value="other">{t('account.returns.other') || 'Other'}</option>
                        </select>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.push(`/account/orders/${orderId}`)}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            {t('account.addresses.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || selectedItems.size === 0}
            className="flex-1 px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting && (
              <svg
                className="animate-spin h-4 w-4"
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
            {submitting ? (t('account.returns.submitting') || 'Submitting...') : (t('account.returns.submit_request') || 'Submit Request')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReturnExchangePage;

