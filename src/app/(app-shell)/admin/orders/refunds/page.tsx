'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOrderRefunds, updateOrderRefund } from '@/lib/firestore/order_management_db';
import { OrderRefund } from '@/lib/firestore/order_management';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const RefundsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderRefund['status'] | 'all'>('all');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    fetchRefunds();
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

  const fetchRefunds = async () => {
    try {
      const data = await getOrderRefunds();
      setRefunds(filter === 'all' ? data : data.filter(r => r.status === filter));
    } catch {
      // Failed to fetch refunds
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (refundId: string, status: OrderRefund['status']) => {
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const updates: Partial<Pick<OrderRefund, 'status' | 'processedBy' | 'processedAt' | 'completedAt' | 'transactionId'>> = { status };
      
      if (status === 'processing') {
        updates.processedBy = user.uid;
        updates.processedAt = Timestamp.now();
      } else if (status === 'completed') {
        updates.completedAt = Timestamp.now();
      }

      await updateOrderRefund(refundId, updates);
      fetchRefunds();
      setInfoDialogMessage(t('admin.order_refunds_update_success') || 'Refund status updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to update refund
      setInfoDialogMessage(t('admin.order_refunds_update_failed') || 'Failed to update refund status.');
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.order_refunds_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.order_refunds_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_refunds_filter_all')}
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_refunds_filter_pending')}
          </button>
          <button
            onClick={() => setFilter('processing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'processing' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_refunds_filter_processing')}
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_refunds_filter_completed')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_refund_number')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_order_id')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_amount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_method')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_reason')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_created')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_refunds_table_actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {refunds.map((refund) => (
                <tr key={refund.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{refund.refundNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Link href={`/admin/orders/${refund.orderId}`} className="text-blue-600 hover:text-blue-900">
                      {refund.orderId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatPrice(refund.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{refund.method.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{refund.reason}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                      refund.status === 'completed' ? 'bg-green-100 text-green-700' :
                      refund.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      refund.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {refund.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {refund.createdAt?.toDate
                      ? new Date(refund.createdAt.toDate()).toLocaleDateString()
                      : t('admin.order_refunds_created_date_na')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {refund.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(refund.id!, 'processing')}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {t('admin.order_refunds_action_start_processing')}
                      </button>
                    )}
                    {refund.status === 'processing' && (
                      <button
                        onClick={() => handleUpdateStatus(refund.id!, 'completed')}
                        className="text-green-600 hover:text-green-900"
                      >
                        {t('admin.order_refunds_action_complete')}
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
          {refunds.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg font-medium mb-2">{t('admin.common.no_items_found') || 'No items found'}</p>
            </div>
          ) : (
            refunds.map((refund) => (
              <div key={refund.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">#{refund.refundNumber}</h3>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>{t('admin.order_refunds_table_order_id') || 'Order'}: {refund.orderId.slice(0, 8)}</p>
                      <p>{t('admin.order_refunds_table_amount') || 'Amount'}: {formatPrice(refund.amount)}</p>
                      <p>{t('admin.order_refunds_table_method') || 'Method'}: {refund.method.replace('_', ' ')}</p>
                      <p>{t('admin.order_refunds_table_reason') || 'Reason'}: {refund.reason}</p>
                      <p>{t('admin.order_refunds_table_created') || 'Created'}: {refund.createdAt?.toDate ? new Date(refund.createdAt.toDate()).toLocaleDateString() : t('admin.order_refunds_created_date_na')}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                    refund.status === 'completed' ? 'bg-green-50 text-green-700' :
                    refund.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                    refund.status === 'failed' ? 'bg-red-50 text-red-700' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    {refund.status}
                  </span>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  {refund.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(refund.id!, 'processing')}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.order_refunds_action_start_processing')}
                    </button>
                  )}
                  {refund.status === 'processing' && (
                    <button
                      onClick={() => handleUpdateStatus(refund.id!, 'completed')}
                      className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-md text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      {t('admin.order_refunds_action_complete')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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

export default RefundsPage;

