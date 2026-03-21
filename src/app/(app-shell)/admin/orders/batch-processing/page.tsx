'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAllOrders, updateOrder } from '@/lib/firestore/orders_db';
import { Order, OrderStatus } from '@/lib/firestore/orders';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
const BatchProcessingPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [action, setAction] = useState<'status' | 'carrier' | 'tracking'>('status');
  const [status, setStatus] = useState<OrderStatus>(OrderStatus.Processing);
  const [carrierId, setCarrierId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch {
      // Failed to fetch orders
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(o => o.id!));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleBatchProcess = async () => {
    if (selectedOrders.length === 0) {
      alert(t('admin.batch_orders_select_at_least_one'));
      return;
    }

    setProcessing(true);
    try {
      const updates: Partial<Pick<Order, 'status' | 'carrierId' | 'trackingNumber'>> = {};
      
      if (action === 'status') {
        updates.status = status;
      } else if (action === 'carrier') {
        updates.carrierId = carrierId;
      } else if (action === 'tracking') {
        updates.trackingNumber = trackingNumber;
      }

      await Promise.all(
        selectedOrders.map(orderId => updateOrder(orderId, updates))
      );

      alert(
        t('admin.batch_orders_success', {
          count: selectedOrders.length.toString(),
        })
      );
      setSelectedOrders([]);
      fetchOrders();
    } catch {
        // Failed to batch process orders
      alert(t('admin.batch_orders_failed'));
    } finally {
      setProcessing(false);
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t('admin.batch_orders_title')}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t('admin.batch_orders_subtitle')}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.batch_orders_action_label')}
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'status' | 'carrier' | 'tracking')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="status">
                {t('admin.batch_orders_action_status')}
              </option>
              <option value="carrier">
                {t('admin.batch_orders_action_carrier')}
              </option>
              <option value="tracking">
                {t('admin.batch_orders_action_tracking')}
              </option>
            </select>
          </div>
          {action === 'status' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.batch_orders_new_status_label')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              >
                <option value={OrderStatus.Pending}>{t('admin.pending')}</option>
                <option value={OrderStatus.Processing}>
                  {t('admin.processing')}
                </option>
                <option value={OrderStatus.Shipped}>
                  {t('track_order.status_shipped')}
                </option>
                <option value={OrderStatus.Delivered}>
                  {t('admin.delivered')}
                </option>
                <option value={OrderStatus.Cancelled}>
                  {t('admin.cancelled')}
                </option>
              </select>
            </div>
          )}
          {action === 'carrier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.batch_orders_carrier_id_label')}
              </label>
              <input
                type="text"
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.batch_orders_carrier_id_placeholder')}
              />
            </div>
          )}
          {action === 'tracking' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.batch_orders_tracking_label')}
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.batch_orders_tracking_placeholder')}
              />
            </div>
          )}
          <button
            onClick={handleBatchProcess}
            disabled={processing || selectedOrders.length === 0}
            className="w-full sm:w-auto bg-black text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing
              ? t('admin.batch_orders_processing_button')
              : t('admin.batch_orders_process_button', {
                  count: selectedOrders.length.toString(),
                })}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedOrders.length === orders.length && orders.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-5 h-5 text-black border-gray-300 rounded focus:ring-gray-900"
            />
            <span className="text-sm font-medium text-gray-700">
              {t('admin.batch_orders_select_all', {
                count: selectedOrders.length.toString(),
              })}
            </span>
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12"></th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.batch_orders_table_order_id')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.batch_orders_table_customer')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.batch_orders_table_items')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.batch_orders_table_total')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.batch_orders_table_status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id!)}
                      onChange={(e) => handleSelectOrder(order.id!, e.target.checked)}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id?.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{order.shippingAddress.fullName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {t('admin.order_returns_items_count', {
                      count: order.items.length.toString(),
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatPrice(order.totalAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {orders.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg font-medium mb-2">{t('admin.common.no_items_found') || 'No items found'}</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id!)}
                        onChange={(e) => handleSelectOrder(order.id!, e.target.checked)}
                        className="w-5 h-5 text-black border-gray-300 rounded focus:ring-gray-900"
                      />
                      <h3 className="text-sm font-semibold text-gray-900">{t('admin.batch_orders_table_order_id') || 'Order'} #{order.id?.slice(0, 8)}</h3>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>{t('admin.batch_orders_table_customer') || 'Customer'}: {order.shippingAddress.fullName}</p>
                      <p>{t('admin.batch_orders_table_items') || 'Items'}: {order.items.length}</p>
                      <p>{t('admin.batch_orders_table_total') || 'Total'}: {formatPrice(order.totalAmount)}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                    order.status === 'delivered' ? 'bg-green-50 text-green-700' :
                    order.status === 'shipped' ? 'bg-blue-50 text-blue-700' :
                    order.status === 'processing' ? 'bg-yellow-50 text-yellow-700' :
                    order.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                    'bg-gray-50 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchProcessingPage;

