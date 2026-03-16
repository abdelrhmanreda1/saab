'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product, ProductTemplate } from '@/lib/firestore/products';
import { getAllProductTemplates, deleteProductTemplate } from '@/lib/firestore/product_templates_db';
import { addProduct } from '@/lib/firestore/products_db';
import { generateSlug } from '@/lib/utils/slug';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const ProductTemplatesPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const fetchedTemplates = await getAllProductTemplates();
        setTemplates(fetchedTemplates);
      } catch {
        // Failed to fetch templates
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
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

  const handleUseTemplate = async (template: ProductTemplate) => {
    setSelectedTemplate(template);
    setNewProductName(`${template.name} - New`);
    setIsModalOpen(true);
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !newProductName.trim()) {
      setInfoDialogMessage(t('admin.product_templates_use_name_required') || 'Product name is required');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const newProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
        name: newProductName,
        slug: generateSlug(newProductName),
        description: selectedTemplate.description,
        images: [],
        price: selectedTemplate.price,
        salePrice: undefined,
        discountType: undefined,
        discountValue: undefined,
        category: selectedTemplate.category,
        brandId: selectedTemplate.brandId,
        variants: selectedTemplate.variants.map(v => ({ ...v })),
        isFeatured: selectedTemplate.isFeatured,
        isActive: false,
        allowPreOrder: false,
        isBundle: false,
        analytics: {
          views: 0,
          clicks: 0,
          addToCartCount: 0,
          purchases: 0,
          conversionRate: 0,
        },
      };

      const productId = await addProduct(newProduct);
      setInfoDialogMessage(t('admin.product_templates_use_success') || 'Product created from template successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        router.push(`/admin/products/edit/${productId}`);
      }, 1500);
    } catch {
      // Failed to create product from template
      setInfoDialogMessage(t('admin.product_templates_use_failed') || 'Failed to create product from template.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.product_templates_delete_confirm') || 'Are you sure you want to delete this template?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteProductTemplate(id);
        setTemplates(templates.filter(t => t.id !== id));
        setInfoDialogMessage(t('admin.product_templates_delete_success') || 'Template deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete template
        setInfoDialogMessage(t('admin.product_templates_delete_failed') || 'Failed to delete template.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSaveAsTemplate = () => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    router.push('/admin/products/templates/save');
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.product_templates_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.product_templates_subtitle')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSaveAsTemplate}
            className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m-3-3h6.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {t('admin.product_templates_save_from_product')}
          </button>
          <button
            onClick={() => router.push('/admin/products')}
            className="text-gray-600 hover:text-gray-900 text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← {t('admin.back_to_products')}
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-400 mx-auto mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {t('admin.product_templates_empty_title')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('admin.product_templates_empty_message')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{template.description}</p>
              
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {t('admin.product_templates_price_label')}:
                  </span>
                  <span className="font-medium">
                    {formatPrice(template.price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {t('admin.product_templates_variants_label')}:
                  </span>
                  <span className="font-medium">{template.variants.length}</span>
                </div>
                {template.isFeatured && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    {t('admin.product_templates_featured_badge')}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  {t('admin.product_templates_use')}
                </button>
                <button
                  onClick={() => handleDelete(template.id!)}
                  className="text-red-600 hover:text-red-900 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for creating product from template */}
      {isModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4">
              {t('admin.product_templates_use_modal_title')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.product_templates_use_modal_name_label')}
                </label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder={t('admin.product_templates_use_modal_name_placeholder')}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('admin.product_templates_use_modal_cancel')}
                </button>
                <button
                  onClick={handleCreateFromTemplate}
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {t('admin.product_templates_use_modal_create')}
                </button>
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

      {/* Confirm Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title={t('common.confirm') || 'Confirm'}
        message={confirmDialogMessage}
        type="confirm"
        onConfirm={() => {
          if (confirmDialogAction) {
            confirmDialogAction();
          }
          setShowConfirmDialog(false);
        }}
        confirmText={t('common.confirm') || 'Confirm'}
        cancelText={t('common.cancel') || 'Cancel'}
      />
    </div>
  );
};

export default ProductTemplatesPage;

