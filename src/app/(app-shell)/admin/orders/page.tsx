'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Order } from '@/lib/firestore/orders';
import { getAllOrders, updateOrder } from '@/lib/firestore/orders_db';
import { updateTrackingNumber, getOrderTracking } from '@/lib/firestore/shipping_db';
import { getAllShippingCarriers } from '@/lib/firestore/shipping_db';
import { ShippingCarrier } from '@/lib/firestore/shipping';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { playOrderSound } from '@/lib/utils/notifications';
import Dialog from '@/components/ui/Dialog';

const OrderList = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [updatingTracking, setUpdatingTracking] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [newOrder, setNewOrder] = useState<Order | null>(null);
  const lastOrderTimestampRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportOrders = async () => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.import_export_disabled_demo') || 'Import/Export is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      // Convert orders to CSV
      const csvHeaders = ['Order ID', 'Customer Name', 'Email', 'Phone', 'Date', 'Items', 'Total', 'Status', 'Payment Method', 'Tracking Number'];
      const csvRows = orders.map(order => [
        order.id?.slice(0, 8) || '',
        order.shippingAddress?.fullName || '',
        order.shippingAddress?.email || '',
        order.shippingAddress?.phone || '',
        order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString() : '',
        order.items.map(i => `${i.productName} x${i.quantity}`).join('; '),
        order.totalAmount.toString(),
        order.status,
        order.paymentMethod,
        order.trackingNumber || '',
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Failed to export orders
      alert(t('admin.orders_export_failed') || 'Failed to export orders');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedOrders, fetchedCarriers] = await Promise.all([
          getAllOrders(),
          getAllShippingCarriers(true),
        ]);
        setOrders(fetchedOrders);
        setCarriers(fetchedCarriers);
        
        // Set initial timestamp from the latest order
        if (fetchedOrders.length > 0 && fetchedOrders[0].createdAt) {
          lastOrderTimestampRef.current = fetchedOrders[0].createdAt.toMillis();
        }
        // Mark initial load as complete after a short delay to allow snapshot listener to initialize
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 2000);
      } catch {
        setError(t('admin.orders_fetch_failed'));
        // Failed to fetch orders
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  // Real-time listener for new orders
  useEffect(() => {
    const ordersCollectionRef = collection(db, 'orders');
    const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newOrders: Order[] = [];
        
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const orderData = { id: change.doc.id, ...change.doc.data() } as Order;
            
            // Skip if this is the initial load
            if (isInitialLoadRef.current) {
              if (orderData.createdAt) {
                const orderTimestamp = orderData.createdAt.toMillis();
                // Update timestamp but don't show popup
                if (orderTimestamp > lastOrderTimestampRef.current) {
                  lastOrderTimestampRef.current = orderTimestamp;
                }
              }
              return;
            }
            
            // Check if this is a new order (not from initial load)
            if (orderData.createdAt && lastOrderTimestampRef.current > 0) {
              const orderTimestamp = orderData.createdAt.toMillis();
              
              // Only show notification if order is newer than last known order
              if (orderTimestamp > lastOrderTimestampRef.current) {
                lastOrderTimestampRef.current = orderTimestamp;
                newOrders.push(orderData);
              }
            }
          }
        });

        // Show notification for new orders
        if (newOrders.length > 0) {
          const latestOrder = newOrders[0];
          setNewOrder(latestOrder);
          setShowNewOrderDialog(true);
          playOrderSound();
          
          // Update orders list
          setOrders(prev => {
            const existingIds = new Set(prev.map(o => o.id));
            const toAdd = newOrders.filter(o => !existingIds.has(o.id));
            return [...toAdd, ...prev].sort((a, b) => {
              const aTime = a.createdAt?.toMillis() || 0;
              const bTime = b.createdAt?.toMillis() || 0;
              return bTime - aTime;
            });
          });
        }
      },
      (error) => {
        console.error('Error listening to orders:', error);
      }
    );

    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    const loadTrackingInfo = async () => {
      if (selectedOrder?.id) {
        try {
          const tracking = await getOrderTracking(selectedOrder.id);
          if (tracking) {
            setTrackingNumber(tracking.trackingNumber || '');
            setSelectedCarrierId(tracking.carrierId || '');
          } else {
            setTrackingNumber(selectedOrder.trackingNumber || '');
            setSelectedCarrierId(selectedOrder.carrierId || '');
          }
        } catch {
          // Failed to load tracking info
          setTrackingNumber(selectedOrder.trackingNumber || '');
          setSelectedCarrierId(selectedOrder.carrierId || '');
        }
      }
    };
    loadTrackingInfo();
  }, [selectedOrder]);

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await updateOrder(orderId, { status: newStatus });
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      setInfoDialogMessage(t('admin.orders_update_status_success') || 'Order status updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      setError(t('admin.orders_update_status_failed'));
      setInfoDialogMessage(t('admin.orders_update_status_failed') || 'Failed to update order status.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
    setTrackingNumber('');
    setSelectedCarrierId('');
  };

  const handleUpdateTracking = async () => {
    if (!selectedOrder?.id) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    
    if (!trackingNumber.trim()) {
      setInfoDialogMessage(t('admin.orders_tracking_number_required') || 'Tracking number is required.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    setUpdatingTracking(true);
    try {
      const carrier = carriers.find(c => c.id === selectedCarrierId);
      await updateTrackingNumber(
        selectedOrder.id,
        trackingNumber.trim(),
        carrier?.id,
        carrier?.name,
        carrier?.code
      );
      
      // Update order with tracking info
      await updateOrder(selectedOrder.id, {
        trackingNumber: trackingNumber.trim(),
        carrierId: carrier?.id,
        carrierName: carrier?.name,
        status: 'shipped' as Order['status'],
      });
      
      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === selectedOrder.id
            ? {
                ...order,
                trackingNumber: trackingNumber.trim(),
                carrierId: carrier?.id,
                carrierName: carrier?.name,
                status: 'shipped' as Order['status'],
              }
            : order
        )
      );
      
      if (selectedOrder) {
        setSelectedOrder({
          ...selectedOrder,
          trackingNumber: trackingNumber.trim(),
          carrierId: carrier?.id,
          carrierName: carrier?.name,
          status: 'shipped' as Order['status'],
        });
      }
      setInfoDialogMessage(t('admin.orders_tracking_update_success') || 'Tracking number updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
        // Failed to update tracking
      setInfoDialogMessage(t('admin.orders_tracking_update_failed') || 'Failed to update tracking number.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setUpdatingTracking(false);
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

  // Pagination logic
  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.orders_page_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.orders_subtitle')}
          </p>
        </div>
        {orders.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700 font-medium whitespace-nowrap">{t('admin.common.items_per_page') || 'Items per page'}:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 border border-red-100 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <p>{t('admin.orders_empty_admin')}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_order_id')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_customer')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_date')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_total')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_payment')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_status')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.orders_table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        #{order.id?.slice(0, 8)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.shippingAddress?.fullName || t('admin.guest_user')}
                        <div className="text-xs text-gray-500 font-normal">{order.shippingAddress?.phone}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {order.createdAt.toDate().toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatPrice(order.totalAmount)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                            order.paymentMethod === 'stripe'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.paymentMethod === 'cod'
                            ? t('admin.orders_payment_cod')
                            : order.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id!, e.target.value as Order['status'])}
                          className={`block w-full py-1.5 px-3 border-0 rounded-lg text-xs font-semibold uppercase tracking-wide cursor-pointer focus:ring-2 focus:ring-gray-900/10 transition-all outline-none
                            ${order.status === 'delivered'
                              ? 'bg-green-50 text-green-700'
                              : order.status === 'pending'
                              ? 'bg-yellow-50 text-yellow-700'
                              : order.status === 'processing'
                              ? 'bg-blue-50 text-blue-700'
                              : order.status === 'shipped'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-red-50 text-red-700'}
                          `}
                        >
                          <option value="pending">{t('admin.pending')}</option>
                          <option value="processing">{t('admin.processing')}</option>
                          <option value="shipped">{t('track_order.status_shipped')}</option>
                          <option value="delivered">{t('admin.delivered')}</option>
                          <option value="cancelled">{t('admin.cancelled')}</option>
                        </select>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/orders/${order.id}/fulfillment`}
                            className="text-blue-600 hover:text-blue-800"
                            title={t('admin.orders_action_fulfillment')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/admin/orders/${order.id}/notes`}
                            className="text-yellow-600 hover:text-yellow-800"
                            title={t('admin.order_notes_title')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </Link>
                          <Link
                            href={`/admin/orders/${order.id}/history`}
                            className="text-purple-600 hover:text-purple-800"
                            title={t('admin.order_history_title')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/admin/orders/${order.id}/split`}
                            className="text-indigo-600 hover:text-indigo-800"
                            title={t('admin.order_split_title')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                          </Link>
                          <button 
                            onClick={() => handleViewDetails(order)}
                            className="text-gray-400 hover:text-gray-900 transition-colors"
                            title={t('account.orders.view_details')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
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
              {paginatedOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">#{order.id?.slice(0, 8)}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                            order.paymentMethod === 'stripe'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.paymentMethod === 'cod'
                            ? t('admin.orders_payment_cod')
                            : order.paymentMethod}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>
                          <span className="font-medium">
                            {t('admin.orders_table_customer') || 'Customer'}:
                          </span>{' '}
                          {order.shippingAddress?.fullName || t('admin.guest_user')}
                        </p>
                        <p>
                          <span className="font-medium">
                            {t('admin.orders_table_phone') || 'Phone'}:
                          </span>{' '}
                          {order.shippingAddress?.phone || '-'}
                        </p>
                        <p>
                          <span className="font-medium">
                            {t('admin.orders_table_date') || 'Date'}:
                          </span>{' '}
                          {order.createdAt.toDate().toLocaleDateString()}
                        </p>
                        <p>
                          <span className="font-medium">
                            {t('admin.orders_table_total') || 'Total'}:
                          </span>{' '}
                          {formatPrice(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id!, e.target.value as Order['status'])}
                      className={`block w-full py-2 px-3 border-0 rounded-lg text-xs font-semibold uppercase tracking-wide cursor-pointer focus:ring-2 focus:ring-gray-900/10 transition-all outline-none
                        ${order.status === 'delivered'
                          ? 'bg-green-50 text-green-700'
                          : order.status === 'pending'
                          ? 'bg-yellow-50 text-yellow-700'
                          : order.status === 'processing'
                          ? 'bg-blue-50 text-blue-700'
                          : order.status === 'shipped'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-red-50 text-red-700'}
                      `}
                    >
                      <option value="pending">{t('admin.pending')}</option>
                      <option value="processing">{t('admin.processing')}</option>
                      <option value="shipped">{t('track_order.status_shipped')}</option>
                      <option value="delivered">{t('admin.delivered')}</option>
                      <option value="cancelled">{t('admin.cancelled')}</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Link
                      href={`/admin/orders/${order.id}/fulfillment`}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors text-center"
                      title={t('admin.orders_action_fulfillment')}
                    >
                      {t('admin.orders_action_fulfillment') || 'Fulfill'}
                    </Link>
                    <Link
                      href={`/admin/orders/${order.id}/notes`}
                      className="flex-1 px-3 py-2 bg-yellow-50 text-yellow-600 rounded-md text-sm font-medium hover:bg-yellow-100 transition-colors text-center"
                      title={t('admin.order_notes_title')}
                    >
                      {t('admin.order_notes_title') || 'Notes'}
                    </Link>
                    <button 
                      onClick={() => handleViewDetails(order)}
                      className="flex-1 px-3 py-2 bg-gray-50 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                      title={t('account.orders.view_details')}
                    >
                      {t('admin.orders_view_details') || 'View'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-700">
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, orders.length)} {t('admin.common.of') || 'of'} {orders.length} {t('admin.common.results') || 'results'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.previous') || 'Previous'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.next') || 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Details Modal */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {t('admin.orders_modal_title')}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 font-mono mt-1">#{selectedOrder.id}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
              {/* Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50 p-4 rounded-xl">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">
                    {t('admin.orders_modal_current_status')}
                  </p>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusChange(selectedOrder.id!, e.target.value as Order['status'])}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 block w-full p-2.5 outline-none"
                  >
                    <option value="pending">{t('admin.pending')}</option>
                    <option value="processing">{t('admin.processing')}</option>
                    <option value="shipped">{t('track_order.status_shipped')}</option>
                    <option value="delivered">{t('admin.delivered')}</option>
                    <option value="cancelled">{t('admin.cancelled')}</option>
                  </select>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">
                    {t('track_order.order_date')}
                  </p>
                  <p className="text-sm font-medium text-gray-900">{selectedOrder.createdAt.toDate().toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Customer Info */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                    {t('account.order_details.title')}
                  </h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-900 w-24 inline-block">
                        {t('account.addresses.full_name')}:
                      </span>{' '}
                      {selectedOrder.shippingAddress?.fullName}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900 w-24 inline-block">
                        {t('admin.orders_modal_email') || 'Email'}:
                      </span>{' '}
                      {selectedOrder.shippingAddress?.email}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900 w-24 inline-block">
                        {t('account.addresses.phone')}:
                      </span>{' '}
                      {selectedOrder.shippingAddress?.phone}
                    </p>
                  </div>
                </div>

                {/* Shipping Info */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                    {t('account.order_details.shipping_address')}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>{selectedOrder.shippingAddress?.address}</p>
                    <p>{selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} {selectedOrder.shippingAddress?.zipCode}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                  {t('account.order_details.items_title')}
                </h3>
                <div className="space-y-4">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 bg-white border border-gray-100 p-3 rounded-lg">
                      <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden relative flex-shrink-0">
                        {item.productImage ? (
                           <Image src={item.productImage} alt={item.productName} fill className="object-cover" unoptimized />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                             {t('account.order_details.no_image')}
                           </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900">{item.productName}</h4>
                        {item.variant && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="capitalize">{item.variant.name}</span>: {item.variant.value}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{formatPrice(item.price)}</p>
                        <p className="text-xs text-gray-500">
                          {t('account.order_details.quantity')}: {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tracking Information */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                  {t('account.order_details.tracking_title')}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                        {t('track_order.tracking_number')}
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={t('admin.orders_modal_tracking_placeholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                        {t('track_order.carrier')}
                      </label>
                      <select
                        value={selectedCarrierId}
                        onChange={(e) => setSelectedCarrierId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
                      >
                        <option value="">
                          {t('admin.orders_modal_carrier_placeholder')}
                        </option>
                        {carriers.map(carrier => (
                          <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {selectedOrder.trackingNumber && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium mb-1">
                        {t('admin.orders_modal_current_tracking_label')}
                      </p>
                      <p className="text-sm font-mono text-blue-900">{selectedOrder.trackingNumber}</p>
                      {selectedOrder.carrierName && (
                        <p className="text-xs text-blue-600 mt-1">
                          {t('track_order.carrier')}: {selectedOrder.carrierName}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleUpdateTracking}
                    disabled={updatingTracking || !trackingNumber.trim()}
                    className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                  >
                    {updatingTracking
                      ? t('admin.orders_modal_updating_tracking_button')
                      : t('admin.orders_modal_update_tracking_button')}
                  </button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 p-6 rounded-xl space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{t('account.order_details.subtotal')}</span>
                  <span>
                    {formatPrice(
                      selectedOrder.items
                        .reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0
                        )
                    )}
                  </span>
                </div>
                {selectedOrder.shippingCost && selectedOrder.shippingCost > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('account.order_details.shipping')}</span>
                    <span>{formatPrice(selectedOrder.shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
                  <span>{t('track_order.total_amount')}</span>
                  <span>{formatPrice(selectedOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* New Order Alert Dialog */}
      <Dialog
        isOpen={showNewOrderDialog}
        onClose={() => {
          setShowNewOrderDialog(false);
          setNewOrder(null);
        }}
        title={t('admin.new_order_alert_title') || 'New Order Received!'}
        message={
          newOrder
            ? `${t('admin.new_order_alert_message') || 'A new order has been received'}\n\n${t('admin.orders_order_id') || 'Order ID'}: ${newOrder.id?.slice(0, 8) || ''}\n${t('admin.orders_customer') || 'Customer'}: ${newOrder.shippingAddress?.fullName || 'N/A'}\n${t('admin.orders_total') || 'Total'}: ${formatPrice(newOrder.totalAmount)}`
            : ''
        }
        type="success"
        showCancel={false}
        confirmText={t('admin.view_order') || 'View Order'}
        onConfirm={() => {
          if (newOrder?.id) {
            window.location.href = `/admin/orders/${newOrder.id}`;
          }
          setShowNewOrderDialog(false);
          setNewOrder(null);
        }}
      />
    </div>
  );
};

export default OrderList;
