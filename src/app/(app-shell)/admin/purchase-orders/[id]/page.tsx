'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PurchaseOrder } from '@/lib/firestore/suppliers';
import { getPurchaseOrder } from '@/lib/firestore/purchase_orders_db';
import PurchaseOrderForm from '../../../../components/admin/PurchaseOrderForm';
import { useLanguage } from '@/context/LanguageContext';

const PurchaseOrderDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const fetchedOrder = await getPurchaseOrder(id);
        setOrder(fetchedOrder);
      } catch {
        // Error fetching purchase order
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const handleSuccess = () => {
    router.push('/admin/purchase-orders');
  };

  const handleCancel = () => {
    router.push('/admin/purchase-orders');
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
        {t('admin.purchase_orders_not_found') || 'Purchase order not found'}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={handleCancel}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.purchase_orders_back_to_list') || 'Back to Purchase Orders'}
        </button>
      </div>
      <PurchaseOrderForm orderId={id} onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
};

export default PurchaseOrderDetailPage;


