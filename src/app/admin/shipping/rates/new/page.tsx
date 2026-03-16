'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ShippingRateForm from '../../../../../components/admin/ShippingRateForm';
import { useLanguage } from '@/context/LanguageContext';

const NewShippingRatePage = () => {
  const router = useRouter();
  const { t } = useLanguage();

  const handleSuccess = () => {
    router.push('/admin/shipping/rates');
  };

  const handleCancel = () => {
    router.push('/admin/shipping/rates');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={handleCancel}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.shipping_rates_back') || 'Back to Shipping Rates'}
        </button>
      </div>
      <ShippingRateForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
};

export default NewShippingRatePage;

