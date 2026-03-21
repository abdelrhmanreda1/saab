'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Product } from '@/lib/firestore/products';
import { getProduct } from '@/lib/firestore/products_db';
import { addProductTemplate } from '@/lib/firestore/product_templates_db';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const SaveTemplatePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('product');
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (productId) {
        try {
          const fetchedProduct = await getProduct(productId);
          if (fetchedProduct) {
            setProduct(fetchedProduct);
            setTemplateName(`${fetchedProduct.name} Template`);
          }
        } catch {
          // Failed to fetch product
        }
      }
      setLoading(false);
    };
    fetchProduct();
  }, [productId]);

  const handleSaveTemplate = async () => {
    if (!product || !templateName.trim()) {
      alert(t('admin.save_template_name_required'));
      return;
    }

    setSaving(true);
    try {
      const template = {
        name: templateName,
        description: product.description,
        category: product.category,
        brandId: product.brandId,
        price: product.price,
        variants: product.variants.map(v => ({ ...v })),
        isFeatured: product.isFeatured,
      };

      await addProductTemplate(template);
      alert(t('admin.save_template_success'));
      router.push('/admin/products/templates');
    } catch {
      // Failed to save template
      alert(t('admin.save_template_failed'));
    } finally {
      setSaving(false);
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

  if (!product) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {t('admin.save_template_not_found')}
        </div>
        <button
          onClick={() => router.push('/admin/products')}
          className="mt-4 text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          ← {t('admin.back_to_products')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => router.push('/admin/products/templates')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.save_template_back_to_templates')}
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.save_template_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.save_template_subtitle')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.save_template_name_label')}
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.save_template_name_placeholder')}
              />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-gray-900">
              {t('admin.save_template_preview_title')}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t('admin.save_template_preview_product')}:
                </span>
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t('admin.save_template_preview_price')}:
                </span>
                <span className="font-medium">
                  {formatPrice(product.price)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t('admin.save_template_preview_category')}:
                </span>
                <span className="font-medium">{product.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t('admin.save_template_preview_variants')}:
                </span>
                <span className="font-medium">{product.variants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t('admin.save_template_preview_featured')}:
                </span>
                <span className="font-medium">
                  {product.isFeatured ? (t('admin.common.yes') || 'Yes') : (t('admin.common.no') || 'No')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => router.push('/admin/products/templates')}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('admin.save_template_cancel')}
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={saving || !templateName.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? t('admin.save_template_saving')
                : t('admin.save_template_save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveTemplatePage;

