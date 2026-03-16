'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOrderReturns, updateOrderReturn } from '@/lib/firestore/order_management_db';
import { OrderReturn } from '@/lib/firestore/order_management';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const ReturnsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderReturn['status'] | 'all'>('all');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    fetchReturns();
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

  const fetchReturns = async () => {
    try {
      const data = await getOrderReturns();
      setReturns(filter === 'all' ? data : data.filter(r => r.status === filter));
    } catch {
      // Failed to fetch returns
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (returnId: string, status: OrderReturn['status']) => {
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const updates: Partial<Pick<OrderReturn, 'status' | 'approvedBy' | 'approvedAt' | 'receivedAt' | 'processedAt'>> = { status };
      
      if (status === 'approved') {
        updates.approvedBy = user.uid;
        updates.approvedAt = Timestamp.now();
      } else if (status === 'received') {
        updates.receivedAt = Timestamp.now();
      } else if (status === 'processed') {
        updates.processedAt = Timestamp.now();
      }

      await updateOrderReturn(returnId, updates);
      fetchReturns();
      setInfoDialogMessage(t('admin.order_returns_update_success') || 'Return status updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
        // Failed to update return
      setInfoDialogMessage(t('admin.order_returns_update_failed') || 'Failed to update return status.');
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
            {t('admin.order_returns_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.order_returns_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_returns_filter_all')}
          </button>
          <button
            onClick={() => setFilter('requested')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'requested' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_returns_filter_requested')}
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'approved' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_returns_filter_approved')}
          </button>
          <button
            onClick={() => setFilter('received')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'received' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_returns_filter_received')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_return_number')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_order_id')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_items')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_reason')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_requested')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_returns_table_actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((returnOrder) => (
                <tr key={returnOrder.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{returnOrder.returnNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Link href={`/admin/orders/${returnOrder.orderId}`} className="text-blue-600 hover:text-blue-900">
                      {returnOrder.orderId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {t('admin.order_returns_items_count', {
                      count: returnOrder.items.length.toString(),
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {returnOrder.items[0]?.returnType ||
                      t('admin.order_returns_type_fallback')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{returnOrder.reason}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                      returnOrder.status === 'refunded' || returnOrder.status === 'exchanged' ? 'bg-green-100 text-green-700' :
                      returnOrder.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                      returnOrder.status === 'received' ? 'bg-purple-100 text-purple-700' :
                      returnOrder.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {returnOrder.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {returnOrder.requestedAt?.toDate
                      ? new Date(returnOrder.requestedAt.toDate()).toLocaleDateString()
                      : t('admin.order_returns_requested_date_na')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {returnOrder.status === 'requested' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleUpdateStatus(returnOrder.id!, 'approved')}
                          className="text-green-600 hover:text-green-900"
                        >
                          {t('admin.order_returns_action_approve')}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(returnOrder.id!, 'rejected')}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('admin.order_returns_action_reject')}
                        </button>
                      </div>
                    )}
                    {returnOrder.status === 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(returnOrder.id!, 'received')}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {t('admin.order_returns_action_mark_received')}
                      </button>
                    )}
                    {returnOrder.status === 'received' && (
                      <button
                        onClick={() => handleUpdateStatus(returnOrder.id!, 'processed')}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        {t('admin.order_returns_action_process')}
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
          {returns.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg font-medium mb-2">{t('admin.common.no_items_found') || 'No items found'}</p>
            </div>
          ) : (
            returns.map((returnOrder) => (
              <div key={returnOrder.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">#{returnOrder.returnNumber}</h3>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>{t('admin.order_returns_table_order_id') || 'Order'}: {returnOrder.orderId.slice(0, 8)}</p>
                      <p>{t('admin.order_returns_table_items') || 'Items'}: {returnOrder.items.length}</p>
                      <p>{t('admin.order_returns_table_type') || 'Type'}: {returnOrder.items[0]?.returnType || t('admin.order_returns_type_fallback')}</p>
                      <p>{t('admin.order_returns_table_reason') || 'Reason'}: {returnOrder.reason}</p>
                      <p>{t('admin.order_returns_table_requested') || 'Requested'}: {returnOrder.requestedAt?.toDate ? new Date(returnOrder.requestedAt.toDate()).toLocaleDateString() : t('admin.order_returns_requested_date_na')}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                    returnOrder.status === 'refunded' || returnOrder.status === 'exchanged' ? 'bg-green-50 text-green-700' :
                    returnOrder.status === 'approved' ? 'bg-blue-50 text-blue-700' :
                    returnOrder.status === 'received' ? 'bg-purple-50 text-purple-700' :
                    returnOrder.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    {returnOrder.status}
                  </span>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  {returnOrder.status === 'requested' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(returnOrder.id!, 'approved')}
                        className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-md text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        {t('admin.order_returns_action_approve')}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(returnOrder.id!, 'rejected')}
                        className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-xs font-medium hover:bg-red-100 transition-colors"
                      >
                        {t('admin.order_returns_action_reject')}
                      </button>
                    </>
                  )}
                  {returnOrder.status === 'approved' && (
                    <button
                      onClick={() => handleUpdateStatus(returnOrder.id!, 'received')}
                      className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.order_returns_action_mark_received')}
                    </button>
                  )}
                  {returnOrder.status === 'received' && (
                    <button
                      onClick={() => handleUpdateStatus(returnOrder.id!, 'processed')}
                      className="w-full px-3 py-2 bg-purple-50 text-purple-600 rounded-md text-xs font-medium hover:bg-purple-100 transition-colors"
                    >
                      {t('admin.order_returns_action_process')}
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

export default ReturnsPage;

