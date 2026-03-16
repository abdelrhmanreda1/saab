'use client';

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getUserReturnExchangeRequests } from '@/lib/firestore/user_account_db';
import { ReturnExchangeRequest } from '@/lib/firestore/user_account';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSettings } from '../../../context/SettingsContext';
import { formatDateOnly } from '@/lib/utils/dateTime';
import { LanguageContext } from '../../../context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import AccountMobileNav from '@/components/AccountMobileNav';

const ReturnsPage = () => {
  const [requests, setRequests] = useState<ReturnExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);
  const { settings } = useSettings();
  const { demoUser } = useAuth();
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const fetchRequests = useCallback(async (uid: string) => {
    try {
      const fetchedRequests = await getUserReturnExchangeRequests(uid);
      setRequests(fetchedRequests);
    } catch {
      // Error fetching return requests
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      fetchRequests(demoUser.uid);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await fetchRequests(currentUser.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [auth, router, fetchRequests, settings?.demoMode, demoUser]);

  const getStatusColor = (status: ReturnExchangeRequest['status']) => {
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
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
            {t('account.returns.subtitle') || 'View and manage your return requests.'}
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
                <Link href="/account/profile" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_profile')}
                </Link>
                <Link href="/account/orders" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_orders')}
                </Link>
                <Link href="/account/addresses" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_addresses')}
                </Link>
                <Link href="/account/returns" className="block px-4 py-2 bg-black text-white rounded-lg font-medium">
                  {t('account.nav_returns')}
                </Link>
                <Link href="/account/refunds" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_refunds')}
                </Link>
                <Link href="/account/preferences" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_preferences')}
                </Link>
                <Link href="/wishlist" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_wishlist')}
                </Link>
              </nav>
            </div>
          </div>

          {/* Right Column: Returns Content */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-heading font-bold mb-6 text-gray-900">
              {t('account.returns.page_title') || 'Returns & Exchanges'}
            </h2>

            {requests.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-300 mx-auto mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h11.25c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p className="text-gray-500 mb-4">
                  {t('account.returns.empty_message')}
                </p>
                <Link href="/account/orders" className="text-blue-600 hover:underline">
                  {t('account.returns.view_orders')}
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          {request.type === 'return'
                            ? t('account.returns.request_title_return') || 'Return Request'
                            : t('account.returns.request_title_exchange') || 'Exchange Request'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('account.returns.order_label') || 'Order'} #{request.orderId.slice(0, 8)}... |{' '}
                          {formatDateOnly(request.createdAt, {
                            dateFormat: settings.site.dateFormat,
                            timezone: settings.site.timezone,
                          })}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-gray-600">
                        <strong>{t('account.returns.reason_label') || 'Reason'}:</strong> {request.reason}
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>{t('account.returns.items_label') || 'Items'}:</strong> {request.items.length} {t('account.returns.item_count') || 'item(s)'}
                      </p>
                      {request.adminNotes && (
                        <div className="bg-gray-50 p-3 rounded-lg mt-2">
                          <p className="text-xs text-gray-500 mb-1">
                            {t('account.returns.admin_notes') || 'Admin Notes'}:
                          </p>
                          <p className="text-xs text-gray-700">{request.adminNotes}</p>
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/account/orders/${request.orderId}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      {t('account.returns.view_order') || 'View Order'} →
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

export default ReturnsPage;

