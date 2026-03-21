'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { Order } from '@/lib/firestore/orders';
import { getOrder } from '@/lib/firestore/orders_db';
import { updateTrackingNumber, getOrderTracking, getAllShippingCarriers } from '@/lib/firestore/shipping_db';
import { ShippingCarrier } from '@/lib/firestore/shipping';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import Dialog from '@/components/ui/Dialog';

const AdminOrderDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const orderId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [updatingTracking, setUpdatingTracking] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId) {
        setError('Order ID is missing.');
        setLoading(false);
        return;
      }

      try {
        const [fetchedOrder, fetchedCarriers] = await Promise.all([
          getOrder(orderId),
          getAllShippingCarriers(true),
        ]);

        if (!fetchedOrder) {
          setError(t('admin.orders_not_found') || 'Order not found.');
        } else {
          setOrder(fetchedOrder);
          setTrackingNumber(fetchedOrder.trackingNumber || '');
          setSelectedCarrierId(fetchedOrder.carrierId || '');

          // Try to load latest tracking data
          try {
            const tracking = await getOrderTracking(orderId);
            if (tracking?.trackingNumber) {
              setTrackingNumber(tracking.trackingNumber);
              setSelectedCarrierId(tracking.carrierId || fetchedOrder.carrierId || '');
            }
          } catch {
            // ignore tracking errors
          }
        }

        setCarriers(fetchedCarriers);
      } catch {
        setError(t('admin.orders_fetch_failed') || 'Failed to fetch order details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId, t]);

  const handleUpdateTracking = async () => {
    if (!order?.id || !trackingNumber.trim()) return;

    try {
      setUpdatingTracking(true);
      await updateTrackingNumber(order.id, trackingNumber.trim(), selectedCarrierId || undefined);

      setInfoDialogMessage(t('admin.orders_modal_tracking_updated') || 'Tracking information updated successfully.');
      setInfoDialogType('success');
      setShowInfoDialog(true);

      setOrder(prev =>
        prev
          ? {
              ...prev,
              trackingNumber: trackingNumber.trim(),
              carrierId: selectedCarrierId || undefined,
              carrierName: carriers.find(c => c.id === selectedCarrierId)?.name || prev.carrierName,
            }
          : prev
      );
    } catch {
      setInfoDialogMessage(t('admin.orders_modal_tracking_update_failed') || 'Failed to update tracking information.');
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
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
            {t('admin.common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
        <button
          onClick={() => router.push('/admin/orders')}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 underline"
        >
          {t('admin.orders_back_to_list') || 'Back to Orders'}
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            {t('admin.orders_not_found') || 'Order not found'}
          </h1>
          <p className="text-sm text-gray-500">
            {error || t('admin.orders_not_found_message') || 'The order you are looking for could not be found.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.orders_modal_title') || 'Order Details'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-mono mt-1">#{order.id}</p>
        </div>
        <button
          onClick={() => router.push('/admin/orders')}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          {t('admin.orders_back_to_list') || 'Back to Orders'}
        </button>
      </div>

      {/* Status & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50 p-4 rounded-xl">
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">
            {t('admin.orders_modal_current_status') || 'Current Status'}
          </p>
          <p className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white">
            {order.status}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">
            {t('track_order.order_date') || 'Order Date'}
          </p>
          {order.createdAt && (
            <p className="text-sm font-medium text-gray-900">
              {order.createdAt.toDate().toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Customer Info */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
            {t('account.order_details.title') || 'Customer Details'}
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-900 w-24 inline-block">
                {t('account.addresses.full_name') || 'Full Name'}:
              </span>{' '}
              {order.shippingAddress?.fullName}
            </p>
            <p>
              <span className="font-medium text-gray-900 w-24 inline-block">
                {t('admin.orders_modal_email') || 'Email'}:
              </span>{' '}
              {order.shippingAddress?.email}
            </p>
            <p>
              <span className="font-medium text-gray-900 w-24 inline-block">
                {t('account.addresses.phone') || 'Phone'}:
              </span>{' '}
              {order.shippingAddress?.phone}
            </p>
          </div>
        </div>

        {/* Shipping Info */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
            {t('account.order_details.shipping_address') || 'Shipping Address'}
          </h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>{order.shippingAddress?.address}</p>
            <p>
              {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
              {order.shippingAddress?.zipCode}
            </p>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
          {t('account.order_details.items_title') || 'Order Items'}
        </h3>
        <div className="space-y-4">
          {order.items.map((item, index) => (
            <div key={index} className="flex items-center gap-4 bg-white border border-gray-100 p-3 rounded-lg">
              <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden relative flex-shrink-0">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    {t('account.order_details.no_image') || 'No image'}
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
                  {t('account.order_details.quantity') || 'Quantity'}: {item.quantity}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tracking Information */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
          {t('account.order_details.tracking_title') || 'Tracking Information'}
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                {t('track_order.tracking_number') || 'Tracking Number'}
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder={t('admin.orders_modal_tracking_placeholder') || 'Enter tracking number'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                {t('track_order.carrier') || 'Carrier'}
              </label>
              <select
                value={selectedCarrierId}
                onChange={(e) => setSelectedCarrierId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
              >
                <option value="">
                  {t('admin.orders_modal_carrier_placeholder') || 'Select carrier'}
                </option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {order.trackingNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">
                {t('admin.orders_modal_current_tracking_label') || 'Current tracking'}
              </p>
              <p className="text-sm font-mono text-blue-900">{order.trackingNumber}</p>
              {order.carrierName && (
                <p className="text-xs text-blue-600 mt-1">
                  {t('track_order.carrier') || 'Carrier'}: {order.carrierName}
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
              ? t('admin.orders_modal_updating_tracking_button') || 'Updating...'
              : t('admin.orders_modal_update_tracking_button') || 'Update Tracking'}
          </button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 p-6 rounded-xl space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t('account.order_details.subtotal') || 'Subtotal'}</span>
          <span>
            {formatPrice(
              order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
            )}
          </span>
        </div>
        {order.shippingCost && order.shippingCost > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>{t('account.order_details.shipping') || 'Shipping'}</span>
            <span>{formatPrice(order.shippingCost)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
          <span>{t('track_order.total_amount') || 'Total Amount'}</span>
          <span>{formatPrice(order.totalAmount)}</span>
        </div>
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={
          infoDialogType === 'success'
            ? t('common.success') || 'Success'
            : t('common.error') || 'Error'
        }
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default AdminOrderDetailsPage;


