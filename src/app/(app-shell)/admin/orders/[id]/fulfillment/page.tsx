'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrder } from '@/lib/firestore/orders_db';
import { Order, OrderItem } from '@/lib/firestore/orders';
import { createOrderFulfillment, getOrderFulfillments, updateOrderFulfillment, addOrderHistoryLog } from '@/lib/firestore/order_management_db';
import { OrderFulfillment } from '@/lib/firestore/order_management';
import { Timestamp } from 'firebase/firestore';
import { getAllWarehouses } from '@/lib/firestore/warehouses_db';
import { Warehouse } from '@/lib/firestore/warehouses';
import { useAuth } from '../../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const OrderFulfillmentPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [fulfillments, setFulfillments] = useState<OrderFulfillment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ [key: number]: number }>({});
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

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

  const fetchData = async () => {
    try {
      const [orderData, fulfillmentsData, warehousesData] = await Promise.all([
        getOrder(orderId),
        getOrderFulfillments(orderId),
        getAllWarehouses(true),
      ]);
      setOrder(orderData);
      setFulfillments(fulfillmentsData);
      setWarehouses(warehousesData);
    } catch {
      // Failed to fetch fulfillment
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFulfillment = async(e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    const warehouseId = formData.get('warehouseId') as string;

    const items = order.items
      .map((item: OrderItem, idx: number) => ({
        itemId: idx.toString(),
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        fulfilledQuantity: selectedItems[idx] || item.quantity,
      }))
      .filter((_, idx: number) => selectedItems[idx] !== undefined && selectedItems[idx] > 0);

    if (items.length === 0) {
      alert(t('admin.bulk_select_at_least_one'));
      return;
    }

    try {
      const warehouse = warehouses.find(w => w.id === warehouseId);
      await createOrderFulfillment({
        orderId: order.id!,
        items,
        warehouseId,
        warehouseName: warehouse?.name || '',
      });

      await addOrderHistoryLog({
        orderId: order.id!,
        action: 'fulfillment_created',
        description: `Fulfillment created for ${items.length} items`,
        performedBy: user.uid,
        performedByName: user.displayName || user.email || 'Admin',
      });

      setShowForm(false);
      setSelectedItems({});
      fetchData();
      setInfoDialogMessage(t('admin.order_fulfillment_create_success') || 'Fulfillment created successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to create fulfillment
      setInfoDialogMessage(t('admin.order_fulfillment_create_failed') || 'Failed to create fulfillment.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleUpdateStatus = async (fulfillmentId: string, status: OrderFulfillment['status']) => {
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const updates: Partial<Omit<OrderFulfillment, 'id' | 'orderId' | 'fulfillmentNumber' | 'items' | 'createdAt' | 'updatedAt'>> = { status };
      
      if (status === 'picked') {
        updates.pickedBy = user.uid;
        updates.pickedByName = user.displayName || user.email || 'Admin';
        updates.pickedAt = Timestamp.now();
      } else if (status === 'packed') {
        updates.packedBy = user.uid;
        updates.packedByName = user.displayName || user.email || 'Admin';
        updates.packedAt = Timestamp.now();
      } else if (status === 'shipped') {
        updates.shippedBy = user.uid;
        updates.shippedByName = user.displayName || user.email || 'Admin';
        updates.shippedAt = Timestamp.now();
      }

      await updateOrderFulfillment(fulfillmentId, updates);

      await addOrderHistoryLog({
        orderId: order!.id!,
        action: 'fulfillment_status_changed',
        description: `Fulfillment status changed to ${status}`,
        previousValue: fulfillments.find(f => f.id === fulfillmentId)?.status,
        newValue: status,
        performedBy: user.uid,
        performedByName: user.displayName || user.email || 'Admin',
      });

      fetchData();
      setInfoDialogMessage(t('admin.order_fulfillment_update_success') || 'Fulfillment status updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to update fulfillment
      setInfoDialogMessage(t('admin.order_fulfillment_update_failed') || 'Failed to update fulfillment status.');
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

  if (!order) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto text-center py-12">
        {t('admin.order_common_not_found')}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t('admin.order_back_to_orders')}
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              {t('admin.order_fulfillment_title')}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {t('account.order_details.order_label')} #{order.id?.slice(0, 8)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-black text-white px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.order_fulfillment_new_button')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">
            {t('admin.order_fulfillment_create_title')}
          </h2>
          <form onSubmit={handleCreateFulfillment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.order_fulfillment_warehouse_label')}
              </label>
              <select
                name="warehouseId"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              >
                <option value="">
                  {t('admin.order_fulfillment_warehouse_placeholder')}
                </option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.order_fulfillment_items_label')}
              </label>
              <div className="space-y-2">
                {order.items.map((item: OrderItem, idx: number) => {
                  const fulfilledQty = fulfillments.reduce((sum, f) => {
                    const fulfillmentItem = f.items.find((i: { itemId: string; fulfilledQuantity: number }) => i.itemId === idx.toString());
                    return sum + (fulfillmentItem?.fulfilledQuantity || 0);
                  }, 0);
                  const remainingQty = item.quantity - fulfilledQty;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-gray-500">
                          {t('admin.order_fulfillment_items_counts', {
                            ordered: item.quantity.toString(),
                            fulfilled: fulfilledQty.toString(),
                            remaining: remainingQty.toString(),
                          })}
                        </div>
                      </div>
                      {remainingQty > 0 && (
                        <input
                          type="number"
                          min="1"
                          max={remainingQty}
                          value={selectedItems[idx] || ''}
                          onChange={(e) => setSelectedItems({ ...selectedItems, [idx]: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                          placeholder={t('admin.order_fulfillment_qty_placeholder')}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('admin.order_fulfillment_create_button')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSelectedItems({});
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('admin.order_fulfillment_cancel_button')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_fulfillment_table_number')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_fulfillment_table_items')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_fulfillment_table_warehouse')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_fulfillment_table_status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.order_fulfillment_table_actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fulfillments.map((fulfillment) => (
                <tr key={fulfillment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{fulfillment.fulfillmentNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {t('admin.order_returns_items_count', {
                      count: fulfillment.items.length.toString(),
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {fulfillment.warehouseName || t('common.not_available')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded-full ${
                        fulfillment.status === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : fulfillment.status === 'shipped'
                          ? 'bg-blue-100 text-blue-700'
                          : fulfillment.status === 'packed'
                          ? 'bg-purple-100 text-purple-700'
                          : fulfillment.status === 'picked'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {fulfillment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {fulfillment.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(fulfillment.id!, 'processing')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('admin.order_fulfillment_action_start_processing')}
                        </button>
                      )}
                      {fulfillment.status === 'processing' && (
                        <button
                          onClick={() => handleUpdateStatus(fulfillment.id!, 'picked')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          {t('admin.order_fulfillment_action_mark_picked')}
                        </button>
                      )}
                      {fulfillment.status === 'picked' && (
                        <button
                          onClick={() => handleUpdateStatus(fulfillment.id!, 'packed')}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          {t('admin.order_fulfillment_action_mark_packed')}
                        </button>
                      )}
                      {fulfillment.status === 'packed' && (
                        <button
                          onClick={() => handleUpdateStatus(fulfillment.id!, 'shipped')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('admin.order_fulfillment_action_mark_shipped')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {fulfillments.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg font-medium mb-2">{t('admin.order_fulfillment_empty') || 'No fulfillments found'}</p>
            </div>
          ) : (
            fulfillments.map((fulfillment) => (
              <div key={fulfillment.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">#{fulfillment.fulfillmentNumber}</h3>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>{t('admin.order_fulfillment_items') || 'Items'}: {fulfillment.items.length}</p>
                      <p>{t('admin.order_fulfillment_table_warehouse') || 'Warehouse'}: {fulfillment.warehouseName || t('common.not_available')}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                    fulfillment.status === 'delivered' ? 'bg-green-50 text-green-700' :
                    fulfillment.status === 'shipped' ? 'bg-blue-50 text-blue-700' :
                    fulfillment.status === 'packed' ? 'bg-purple-50 text-purple-700' :
                    fulfillment.status === 'picked' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-gray-50 text-gray-700'
                  }`}>
                    {fulfillment.status}
                  </span>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  {fulfillment.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(fulfillment.id!, 'processing')}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.order_fulfillment_action_start_processing')}
                    </button>
                  )}
                  {fulfillment.status === 'processing' && (
                    <button
                      onClick={() => handleUpdateStatus(fulfillment.id!, 'picked')}
                      className="flex-1 px-3 py-2 bg-yellow-50 text-yellow-600 rounded-md text-xs font-medium hover:bg-yellow-100 transition-colors"
                    >
                      {t('admin.order_fulfillment_action_mark_picked')}
                    </button>
                  )}
                  {fulfillment.status === 'picked' && (
                    <button
                      onClick={() => handleUpdateStatus(fulfillment.id!, 'packed')}
                      className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-md text-xs font-medium hover:bg-purple-100 transition-colors"
                    >
                      {t('admin.order_fulfillment_action_mark_packed')}
                    </button>
                  )}
                  {fulfillment.status === 'packed' && (
                    <button
                      onClick={() => handleUpdateStatus(fulfillment.id!, 'shipped')}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.order_fulfillment_action_mark_shipped')}
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

export default OrderFulfillmentPage;

