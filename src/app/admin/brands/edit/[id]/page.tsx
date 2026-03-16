'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import BrandForm from '../../../../../components/admin/BrandForm';
import { useLanguage } from '@/context/LanguageContext';

const EditBrandPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { t } = useLanguage();

  const handleSuccess = () => {
    router.push('/admin/brands');
  };

  const handleCancel = () => {
    router.push('/admin/brands');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.brands_back') || 'Back to Brands'}
        </button>
      </div>
      <BrandForm brandId={id} onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
};

export default EditBrandPage;
