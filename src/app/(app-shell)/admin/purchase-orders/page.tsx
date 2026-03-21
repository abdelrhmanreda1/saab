'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PurchaseOrder } from '@/lib/firestore/suppliers';
import { getAllPurchaseOrders, deletePurchaseOrder } from '@/lib/firestore/purchase_orders_db';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const PurchaseOrdersPage = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PurchaseOrder['status'] | 'all'>('all');
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  const fetchOrders = useCallback(async () => {
    try {
      const fetchedOrders = await getAllPurchaseOrders(filter === 'all' ? undefined : filter);
      setOrders(fetchedOrders);
    } catch {
      // Error fetching purchase orders
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.purchase_orders_delete_confirm') || 'Are you sure you want to delete this purchase order?');
    setConfirmDialogAction(() => async () => {
      try {
        await deletePurchaseOrder(id);
        setOrders((prev) => prev.filter((o) => o.id !== id));
        setInfoDialogMessage(t('admin.purchase_orders_delete_success') || 'Purchase order deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Error deleting purchase order
        setInfoDialogMessage(t('admin.purchase_orders_delete_failed') || 'Failed to delete purchase order.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'ordered':
        return 'bg-purple-100 text-purple-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
            {t('admin.purchase_orders_title') || 'Purchase Orders'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.purchase_orders_subtitle') || 'Manage purchase orders from suppliers'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as PurchaseOrder['status'] | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
          >
            <option value="all">{t('admin.purchase_orders_filter_all') || 'All Orders'}</option>
            <option value="draft">{t('admin.purchase_orders_status_draft') || 'Draft'}</option>
            <option value="pending">{t('admin.purchase_orders_status_pending') || 'Pending'}</option>
            <option value="approved">{t('admin.purchase_orders_status_approved') || 'Approved'}</option>
            <option value="ordered">{t('admin.purchase_orders_status_ordered') || 'Ordered'}</option>
            <option value="received">{t('admin.purchase_orders_status_received') || 'Received'}</option>
            <option value="cancelled">{t('admin.purchase_orders_status_cancelled') || 'Cancelled'}</option>
          </select>
          <button
            onClick={() => {
              if (settings.demoMode) {
                setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                setInfoDialogType('error');
                setShowInfoDialog(true);
              } else {
                router.push('/admin/purchase-orders/new');
              }
            }}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('admin.purchase_orders_new_button') || 'New Purchase Order'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h11.25c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
            <p className="text-base sm:text-lg font-medium">
              {t('admin.purchase_orders_empty_title') || 'No purchase orders found'}
            </p>
            <p className="text-sm mt-2 text-gray-400">
              {t('admin.purchase_orders_empty_subtitle') || 'Create your first purchase order to get started'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_order_number') || 'Order Number'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_supplier') || 'Supplier'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_items') || 'Items'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_total') || 'Total'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_status') || 'Status'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_expected_delivery') || 'Expected Delivery'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.purchase_orders_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.supplierName}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {t('admin.purchase_orders_items_count', { count: order.items.length }) ||
                            `${order.items.length} item(s)`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.items.slice(0, 2).map((item) => item.productName).join(', ')}
                          {order.items.length > 2 &&
                            (t('admin.purchase_orders_items_more', {
                              count: order.items.length - 2,
                            }) ||
                              ` +${order.items.length - 2} more`)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatPrice(order.total)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${getStatusColor(
                            order.status,
                          )}`}
                        >
                          {t(`admin.purchase_orders_status_${order.status}`) ||
                            order.status.charAt(0).toUpperCase() +
                              order.status.slice(1).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {order.expectedDeliveryDate
                          ? new Date(order.expectedDeliveryDate.seconds * 1000).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/admin/purchase-orders/${order.id}`)}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            {t('common.view') || 'View'}
                          </button>
                          <button
                            onClick={() => handleDelete(order.id!)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            {t('common.delete') || 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {orders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{order.orderNumber}</h3>
                      <p className="text-xs text-gray-500 mb-2">
                        {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                      </p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-medium">{t('admin.purchase_orders_table_supplier') || 'Supplier'}:</span> {order.supplierName}</p>
                        <p>
                          <span className="font-medium">{t('admin.purchase_orders_table_items') || 'Items'}:</span> {order.items.length} item(s)
                        </p>
                        <p className="text-gray-500">
                          {order.items.slice(0, 2).map((item) => item.productName).join(', ')}
                          {order.items.length > 2 &&
                            (t('admin.purchase_orders_items_more', {
                              count: order.items.length - 2,
                            }) ||
                              ` +${order.items.length - 2} more`)}
                        </p>
                        <p>
                          <span className="font-medium">{t('admin.purchase_orders_table_total') || 'Total'}:</span> <span className="font-semibold text-gray-900">{formatPrice(order.total)}</span>
                        </p>
                        {order.expectedDeliveryDate && (
                          <p>
                            <span className="font-medium">{t('admin.purchase_orders_table_expected_delivery') || 'Expected Delivery'}:</span> {new Date(order.expectedDeliveryDate.seconds * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ml-3 ${getStatusColor(
                        order.status,
                      )}`}
                    >
                      {t(`admin.purchase_orders_status_${order.status}`) ||
                        order.status.charAt(0).toUpperCase() +
                          order.status.slice(1).replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => router.push(`/admin/purchase-orders/${order.id}`)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('common.view') || 'View'}
                    </button>
                    <button
                      onClick={() => handleDelete(order.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('common.delete') || 'Delete'}
                    </button>
                  </div>
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

      {/* Confirm Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title={t('common.confirm') || 'Confirm'}
        message={confirmDialogMessage}
        type="confirm"
        onConfirm={() => {
          if (confirmDialogAction) {
            confirmDialogAction();
          }
          setShowConfirmDialog(false);
        }}
        confirmText={t('common.confirm') || 'Confirm'}
        cancelText={t('common.cancel') || 'Cancel'}
      />
    </div>
  );
};

export default PurchaseOrdersPage;

