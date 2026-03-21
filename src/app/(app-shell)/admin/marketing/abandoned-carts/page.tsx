'use client';

import React, { useState, useEffect } from 'react';
import { getAllAbandonedCarts, updateAbandonedCart } from '@/lib/firestore/campaigns_db';
import { AbandonedCart } from '@/lib/firestore/campaigns';
import { addEmailNotification } from '@/lib/firestore/notifications_db';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const AbandonedCartsPage = () => {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'recovered' | 'unrecovered'>('unrecovered');
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    fetchCarts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const data = await getSettings();
        if (data) {
          setSettings({ ...defaultSettings, ...data });
        }
      } catch {
        // Failed to fetch settings
      }
    };
    fetchSettingsData();
  }, []);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const recoveredFilter = filter === 'recovered' ? true : filter === 'unrecovered' ? false : undefined;
      // Fetching abandoned carts with filter
      const data = await getAllAbandonedCarts(recoveredFilter);
      // Fetched abandoned carts
      setCarts(data || []);
    } catch (error: unknown) {
      // Failed to fetch abandoned carts
      const errorObj = error as { message?: string; code?: string };
      if (errorObj?.message?.includes('index') || errorObj?.code === 'failed-precondition') {
        // Index error details
        alert(t('admin.abandoned_carts_index_error'));
      } else {
        alert(
          t('admin.abandoned_carts_load_failed', {
            message: errorObj?.message || 'Unknown error',
          })
        );
      }
      setCarts([]);
    } finally {
      setLoading(false);
    }
  };

  const sendRecoveryEmail = async (cart: AbandonedCart) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    if (!cart.userId || !cart.userEmail) {
      setInfoDialogMessage(t('admin.abandoned_carts_email_missing') || 'User email is missing.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    try {
      const subject = t('admin.abandoned_carts_email_subject');
      const body = t('admin.abandoned_carts_email_body_html', {
        items: cart.items
          .map(
            item =>
              `<li>${item.productName} x ${item.quantity} - ${formatPrice(item.price)}</li>`
          )
          .join(''),
        total: formatPrice(cart.totalAmount),
      });

      await addEmailNotification({
        userId: cart.userId,
        type: 'order_confirmation',
        subject,
        body,
        sent: false,
      });

      await updateAbandonedCart(cart.id!, {
        recoveryEmailsSent: (cart.recoveryEmailsSent || 0) + 1,
      });

      setInfoDialogMessage(t('admin.abandoned_carts_email_sent') || 'Recovery email sent successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
      fetchCarts();
    } catch {
        // Failed to send recovery email
      setInfoDialogMessage(t('admin.abandoned_carts_email_failed') || 'Failed to send recovery email.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {t('admin.common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.abandoned_carts_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.abandoned_carts_subtitle')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.abandoned_carts_filter_all')}
          </button>
          <button
            onClick={() => setFilter('unrecovered')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'unrecovered'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.abandoned_carts_filter_unrecovered')}
          </button>
          <button
            onClick={() => setFilter('recovered')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'recovered'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.abandoned_carts_filter_recovered')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {carts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-base sm:text-lg font-medium text-gray-900 mb-1">
              {t('admin.abandoned_carts_empty_title')}
            </p>
            <p className="text-sm text-gray-400">
              {t('admin.abandoned_carts_empty_message', {
                context:
                  filter === 'recovered'
                    ? 'recovered'
                    : filter === 'unrecovered'
                    ? 'pending'
                    : 'all',
              })}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_customer')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_items')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_total')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_last_updated')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_emails_sent')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_status')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.abandoned_carts_table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {carts.map((cart) => (
                    <tr key={cart.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {cart.userName || t('admin.guest_user')}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {cart.userEmail || t('admin.abandoned_carts_customer_no_email')}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex gap-2">
                          {cart.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-gray-100">
                              <Image src={item.productImage} alt={item.productName} fill className="object-cover" unoptimized />
                            </div>
                          ))}
                          {cart.items.length > 3 && (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                              +{cart.items.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatPrice(cart.totalAmount)}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cart.lastUpdated?.toDate
                          ? new Date(cart.lastUpdated.toDate()).toLocaleDateString()
                          : t('common.not_available')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cart.recoveryEmailsSent || 0}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          cart.recovered ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {cart.recovered
                            ? t('admin.abandoned_carts_status_recovered')
                            : t('admin.abandoned_carts_status_pending')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {!cart.recovered && (
                          <button
                            onClick={() => sendRecoveryEmail(cart)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('admin.abandoned_carts_send_email_button')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {carts.map((cart) => (
                <div key={cart.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {cart.userName || t('admin.guest_user')}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2">{cart.userEmail || t('admin.abandoned_carts_customer_no_email')}</p>
                      <div className="flex gap-2 mb-2">
                        {cart.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                            <Image src={item.productImage} alt={item.productName} fill className="object-cover" unoptimized />
                          </div>
                        ))}
                        {cart.items.length > 3 && (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                            +{cart.items.length - 3}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-medium">Total:</span> {formatPrice(cart.totalAmount)}</p>
                        <p><span className="font-medium">Last Updated:</span> {cart.lastUpdated?.toDate ? new Date(cart.lastUpdated.toDate()).toLocaleDateString() : t('common.not_available')}</p>
                        <p><span className="font-medium">Emails Sent:</span> {cart.recoveryEmailsSent || 0}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                      cart.recovered ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {cart.recovered
                        ? t('admin.abandoned_carts_status_recovered')
                        : t('admin.abandoned_carts_status_pending')}
                    </span>
                  </div>
                  {!cart.recovered && (
                    <div className="pt-3 border-t border-gray-100">
                      <button
                        onClick={() => sendRecoveryEmail(cart)}
                        className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        {t('admin.abandoned_carts_send_email_button')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default AbandonedCartsPage;

