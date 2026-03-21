'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrder } from '@/lib/firestore/orders_db';
import { Order } from '@/lib/firestore/orders';
import { createOrderShipment, addOrderHistoryLog } from '@/lib/firestore/order_management_db';
import { useAuth } from '../../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const OrderSplitPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<{ [key: number]: { quantity: number; items: number[] } }>({});

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const orderData = await getOrder(orderId);
      setOrder(orderData);
      
      // Initialize shipments - each item can be split
      const initialShipments: { [key: number]: { quantity: number; items: number[] } } = {};
      if (orderData) {
        orderData.items.forEach((_, idx) => {
          initialShipments[idx] = { quantity: orderData.items[idx].quantity, items: [idx] };
        });
      }
      setShipments(initialShipments);
    } catch {
      // Failed to fetch order
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipments = async () => {
    if (!order || !user) return;

    try {
      const shipmentGroups: { [key: string]: { items: Array<{ itemId: string; productId: string; productName: string; quantity: number }> } } = {};
      
      // Group items by shipment
      Object.entries(shipments).forEach(([itemIdx, shipment]) => {
        const shipmentKey = shipment.items.join(',');
        if (!shipmentGroups[shipmentKey]) {
          shipmentGroups[shipmentKey] = { items: [] };
        }
        shipmentGroups[shipmentKey].items.push({
          itemId: itemIdx,
          productId: order.items[parseInt(itemIdx)].productId,
          productName: order.items[parseInt(itemIdx)].productName,
          quantity: shipment.quantity,
        });
      });

      // Create shipments
      for (const [, group] of Object.entries(shipmentGroups)) {
        if (group.items.length > 0) {
          await createOrderShipment({
            orderId: order.id!,
            items: group.items,
          });
        }
      }

      await addOrderHistoryLog({
        orderId: order.id!,
        action: 'order_split',
        description: `Order split into ${Object.keys(shipmentGroups).length} shipments`,
        performedBy: user.uid,
        performedByName: user.displayName || user.email || 'Admin',
      });

      alert(
        t('admin.order_split_success', {
          count: Object.keys(shipmentGroups).length.toString(),
        })
      );
      router.push(`/admin/orders/${orderId}`);
    } catch {
        // Failed to split order
      alert(t('admin.order_split_failed'));
    }
  };

  const handleItemShipmentChange = (itemIdx: number, shipmentKey: string) => {
    const newShipments = { ...shipments };
    const currentShipment = newShipments[itemIdx];
    
    // Remove from current shipment
    currentShipment.items.forEach(idx => {
      if (newShipments[idx]) {
        newShipments[idx] = {
          ...newShipments[idx],
          items: newShipments[idx].items.filter(i => i !== itemIdx),
        };
      }
    });

    // Add to new shipment
    const targetShipmentItems = shipmentKey.split(',').map(i => parseInt(i));
    targetShipmentItems.forEach(idx => {
      if (!newShipments[idx].items.includes(itemIdx)) {
        newShipments[idx].items.push(itemIdx);
      }
    });

    newShipments[itemIdx] = {
      ...currentShipment,
      items: targetShipmentItems,
    };

    setShipments(newShipments);
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

  // Get unique shipment groups
  const shipmentGroups = Array.from(new Set(
    Object.values(shipments).map(s => s.items.sort().join(','))
  ));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
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
            {t('admin.order_split_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.order_split_subtitle', {
              id: order.id?.slice(0, 8) ?? '',
            })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="space-y-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.productName}</div>
                  <div className="text-sm text-gray-500">
                    {t('products.quantity')}: {item.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.order_split_group_label')}
                  </label>
                  <select
                    value={shipments[idx]?.items.sort().join(',') || ''}
                    onChange={(e) => handleItemShipmentChange(idx, e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
                  >
                    {shipmentGroups.map((group, gIdx) => (
                      <option key={gIdx} value={group}>
                        {t('admin.order_split_group_option', {
                          index: (gIdx + 1).toString(),
                          items: group
                            .split(',')
                            .map(i => t('admin.order_split_item_label', { number: (parseInt(i) + 1).toString() }))
                            .join(', '),
                        })}
                      </option>
                    ))}
                    <option value={idx.toString()}>
                      {t('admin.order_split_group_new')}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleCreateShipments}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
          >
            {t('admin.order_split_create_button', {
              count: shipmentGroups.length.toString(),
            })}
          </button>
          <button
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('admin.order_split_cancel_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSplitPage;

