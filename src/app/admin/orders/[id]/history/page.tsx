'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrder } from '@/lib/firestore/orders_db';
import { Order } from '@/lib/firestore/orders';
import { getOrderHistory } from '@/lib/firestore/order_management_db';
import { OrderHistoryLog } from '@/lib/firestore/order_management';
import { useLanguage } from '@/context/LanguageContext';

const OrderHistoryPage = () => {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchData = async () => {
    try {
      const [orderData, historyData] = await Promise.all([
        getOrder(orderId),
        getOrderHistory(orderId),
      ]);
      setOrder(orderData);
      setHistory(historyData);
    } catch {
      // Failed to fetch history
    } finally {
      setLoading(false);
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
            {t('admin.order_history_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.order_history_subtitle', {
              id: order.id?.slice(0, 8) ?? '',
            })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {history.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg font-medium mb-2">{t('admin.order_history_empty')}</p>
            </div>
          ) : (
            history.map((log) => (
              <div key={log.id} className="p-4 sm:p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        log.action.includes('status_change') ? 'bg-blue-100 text-blue-700' :
                        log.action.includes('fulfillment') ? 'bg-purple-100 text-purple-700' :
                        log.action.includes('shipment') ? 'bg-green-100 text-green-700' :
                        log.action.includes('note') ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-500">
                        {log.createdAt?.toDate
                          ? new Date(log.createdAt.toDate()).toLocaleString()
                          : t('common.not_available')}
                      </span>
                    </div>
                    <div className="text-gray-900 font-medium mb-1">{log.description}</div>
                    {log.performedByName && (
                      <div className="text-sm text-gray-500">
                        {t('admin.order_history_by_label', {
                          name: log.performedByName,
                        })}
                      </div>
                    )}
                    {log.previousValue !== undefined && log.newValue !== undefined && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="line-through text-red-600">
                          {String(log.previousValue)}
                        </span>
                        {' '}
                        <span className="text-green-600 font-medium">
                          {String(log.newValue)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderHistoryPage;

