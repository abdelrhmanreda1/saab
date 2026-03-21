'use client';

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getUserRefunds } from '@/lib/firestore/user_account_db';
import { Refund } from '@/lib/firestore/user_account';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSettings } from '../../../context/SettingsContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { formatDateOnly } from '@/lib/utils/dateTime';
import { LanguageContext } from '../../../context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import AccountMobileNav from '@/components/AccountMobileNav';

const RefundsPage = () => {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);
  const { settings } = useSettings();
  const { demoUser } = useAuth();
  const { formatPrice } = useCurrency();
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const fetchRefunds = useCallback(async (uid: string) => {
    try {
      const fetchedRefunds = await getUserRefunds(uid);
      setRefunds(fetchedRefunds);
    } catch {
      // Error fetching refunds
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      fetchRefunds(demoUser.uid);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await fetchRefunds(currentUser.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [auth, router, fetchRefunds, settings?.demoMode, demoUser]);

  const getStatusColor = (status: Refund['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRefundMethodLabel = (method: Refund['refundMethod']) => {
    switch (method) {
      case 'original':
        return t('account.refunds.method_original');
      case 'wallet':
        return t('account.refunds.method_wallet');
      case 'bank_transfer':
        return t('account.refunds.method_bank_transfer');
      default:
        return method;
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container">
            <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
          </div>
        </div>

        <div className="page-container pb-12">
          <AccountMobileNav />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sidebar Skeleton */}
            <div className="hidden md:block">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>

            {/* Content Skeleton */}
            <div className="md:col-span-2 space-y-6">
              <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6">
                  <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-6 md:py-12 mb-6 md:mb-10">
        <div className="page-container">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-heading font-bold text-gray-900 mb-2 text-center md:text-left">
            {t('account.title') || 'My Account'}
          </h1>
          <p className="text-sm md:text-base text-gray-500 text-center md:text-left">
            {t('account.refunds.subtitle') || 'View and manage your refund requests.'}
          </p>
        </div>
      </div>

      <div className="page-container pb-12">
        <AccountMobileNav />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Sidebar / Navigation */}
          <div className="hidden md:block">
            <div className="bg-gray-50 rounded-xl p-4">
              <nav className="space-y-2">
                <Link
                  href="/account/profile"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {t('account.nav_profile')}
                </Link>
                <Link
                  href="/account/orders"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {t('account.nav_orders')}
                </Link>
                <Link
                  href="/account/addresses"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {t('account.nav_addresses')}
                </Link>
                <Link
                  href="/account/returns"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {t('account.nav_returns')}
                </Link>
                <Link
                  href="/account/refunds"
                  className="block px-4 py-2 bg-black text-white rounded-lg font-medium"
                >
                  {t('account.nav_refunds')}
                </Link>
                <Link
                  href="/account/preferences"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {t('account.nav_preferences')}
                </Link>
                <Link
                  href="/wishlist"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {t('account.nav_wishlist')}
                </Link>
              </nav>
            </div>
          </div>

          {/* Right Column: Refunds Content */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-heading font-bold mb-6 text-gray-900">
              {t('account.refunds.title') || 'Refunds'}
            </h2>

            {refunds.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-16 h-16 text-gray-300 mx-auto mb-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125V18.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                  />
                </svg>
                <p className="text-gray-500 mb-4">
                  {t('account.refunds.empty_message')}
                </p>
                <Link
                  href="/account/orders"
                  className="text-blue-600 hover:underline"
                >
                  {t('account.refunds.view_orders')}
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {refunds.map((refund) => (
                  <div
                    key={refund.id}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          {t('account.refunds.request_title') || 'Refund Request'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('account.refunds.order_label') || 'Order'} #{refund.orderId.slice(0, 8)}... |{' '}
                          {formatDateOnly(refund.createdAt, {
                            dateFormat: settings.site.dateFormat,
                            timezone: settings.site.timezone,
                          })}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          refund.status
                        )}`}
                      >
                        {refund.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-bold text-gray-900">
                        {t('account.refunds.amount') || 'Amount'}: {formatPrice(refund.amount)}
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>{t('account.refunds.reason') || 'Reason'}:</strong> {refund.reason}
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>{t('account.refunds.method') || 'Method'}:</strong>{' '}
                        {getRefundMethodLabel(refund.refundMethod)}
                      </p>
                      {refund.transactionId && (
                        <p className="text-xs text-gray-600">
                          <strong>{t('account.refunds.transaction_id') || 'Transaction ID'}:</strong>{' '}
                          {refund.transactionId}
                        </p>
                      )}
                      {refund.processedAt && (
                        <p className="text-xs text-gray-600">
                          <strong>{t('account.refunds.processed') || 'Processed'}:</strong>{' '}
                          {formatDateOnly(refund.processedAt, {
                            dateFormat: settings.site.dateFormat,
                            timezone: settings.site.timezone,
                          })}
                        </p>
                      )}
                      {refund.adminNotes && (
                        <div className="bg-gray-50 p-3 rounded-lg mt-2">
                          <p className="text-xs text-gray-500 mb-1">
                            {t('account.refunds.admin_notes') || 'Admin Notes'}:
                          </p>
                          <p className="text-xs text-gray-700">
                            {refund.adminNotes}
                          </p>
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/account/orders/${refund.orderId}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      {t('account.refunds.view_order') || 'View Order'} →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundsPage;