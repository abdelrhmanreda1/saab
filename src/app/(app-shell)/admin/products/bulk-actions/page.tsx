'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/lib/firestore/products';
import { getAllProducts, bulkUpdateProducts } from '@/lib/firestore/products_db';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const BulkActionsPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [actionType, setActionType] = useState<'price' | 'stock' | 'status' | 'featured'>('price');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  
  // Update values
  const [priceUpdate, setPriceUpdate] = useState({ type: 'set' as 'set' | 'increase' | 'decrease', value: 0 });
  const [statusUpdate, setStatusUpdate] = useState<'active' | 'inactive'>('active');
  const [featuredUpdate, setFeaturedUpdate] = useState<boolean>(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const fetchedProducts = await getAllProducts();
        setProducts(fetchedProducts);
      } catch {
        // Failed to fetch products
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [t]);

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(products.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId]);
    } else {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedProducts.length === 0) {
      setInfoDialogMessage(t('admin.bulk_select_at_least_one') || 'Please select at least one product');
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
    setUpdating(true);
    try {
      const updates: Partial<Product> = {};

      switch (actionType) {
        case 'price':
          if (priceUpdate.type === 'set') {
            updates.price = priceUpdate.value;
          } else if (priceUpdate.type === 'increase') {
            // We'll need to get current prices and update
            const productsToUpdate = products.filter(p => selectedProducts.includes(p.id));
            await Promise.all(
              productsToUpdate.map(async (product) => {
                const newPrice = product.price + priceUpdate.value;
                await bulkUpdateProducts([product.id], { price: newPrice });
              })
            );
            setUpdating(false);
            setInfoDialogMessage(
              t('admin.bulk_update_success', {
                count: productsToUpdate.length.toString(),
              }) || `${productsToUpdate.length} products updated successfully!`
            );
            setInfoDialogType('success');
            setShowInfoDialog(true);
            setTimeout(() => {
              router.push('/admin/products');
            }, 1500);
            return;
          } else {
            const productsToUpdate = products.filter(p => selectedProducts.includes(p.id));
            await Promise.all(
              productsToUpdate.map(async (product) => {
                const newPrice = Math.max(0, product.price - priceUpdate.value);
                await bulkUpdateProducts([product.id], { price: newPrice });
              })
            );
            setUpdating(false);
            setInfoDialogMessage(
              t('admin.bulk_update_success', {
                count: productsToUpdate.length.toString(),
              }) || `${productsToUpdate.length} products updated successfully!`
            );
            setInfoDialogType('success');
            setShowInfoDialog(true);
            setTimeout(() => {
              router.push('/admin/products');
            }, 1500);
            return;
          }
          break;

        case 'stock':
          // Stock updates need to be done per variant
          setInfoDialogMessage(t('admin.bulk_stock_message') || 'Stock updates need to be done per variant');
          setInfoDialogType('error');
          setShowInfoDialog(true);
          setUpdating(false);
          return;

        case 'status':
          updates.isActive = statusUpdate === 'active';
          break;

        case 'featured':
          updates.isFeatured = featuredUpdate;
          break;
      }

      await bulkUpdateProducts(selectedProducts, updates);
      setInfoDialogMessage(
        t('admin.bulk_update_success', {
          count: selectedProducts.length.toString(),
        }) || `${selectedProducts.length} products updated successfully!`
      );
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        router.push('/admin/products');
      }, 1500);
    } catch {
      // Failed to update products
      setInfoDialogMessage(t('admin.bulk_update_failed') || 'Failed to update products.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setUpdating(false);
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => router.push('/admin/products')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.back_to_products')}
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.bulk_actions_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.bulk_actions_subtitle')}
          </p>
        </div>
      </div>

      {/* Action Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {t('admin.bulk_select_action')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => setActionType('price')}
            className={`p-4 rounded-lg border-2 transition-all ${
              actionType === 'price' ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {t('admin.bulk_update_price')}
          </button>
          <button
            onClick={() => setActionType('stock')}
            className={`p-4 rounded-lg border-2 transition-all ${
              actionType === 'stock' ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {t('admin.bulk_update_stock')}
          </button>
          <button
            onClick={() => setActionType('status')}
            className={`p-4 rounded-lg border-2 transition-all ${
              actionType === 'status' ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {t('admin.bulk_update_status')}
          </button>
          <button
            onClick={() => setActionType('featured')}
            className={`p-4 rounded-lg border-2 transition-all ${
              actionType === 'featured' ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {t('admin.bulk_update_featured')}
          </button>
        </div>

        {/* Action Form */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          {actionType === 'price' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.bulk_price_update_type')}
                </label>
                <select
                  value={priceUpdate.type}
                  onChange={(e) => setPriceUpdate({ ...priceUpdate, type: e.target.value as 'set' | 'increase' | 'decrease' })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                >
                  <option value="set">{t('admin.bulk_price_set')}</option>
                  <option value="increase">{t('admin.bulk_price_increase')}</option>
                  <option value="decrease">{t('admin.bulk_price_decrease')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {priceUpdate.type === 'set'
                    ? t('admin.bulk_price_new_price_label')
                    : t('admin.bulk_price_amount_label')}
                </label>
                <input
                  type="number"
                  value={priceUpdate.value}
                  onChange={(e) => setPriceUpdate({ ...priceUpdate, value: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}

          {actionType === 'status' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.bulk_status_label')}
              </label>
              <select
                value={statusUpdate}
                onChange={(e) => setStatusUpdate(e.target.value as 'active' | 'inactive')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="active">{t('admin.bulk_status_active')}</option>
                <option value="inactive">{t('admin.bulk_status_inactive')}</option>
              </select>
            </div>
          )}

          {actionType === 'featured' && (
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={featuredUpdate}
                  onChange={(e) => setFeaturedUpdate(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.bulk_featured_label')}
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Product Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={selectedProducts.length === products.length && products.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="font-medium text-gray-900 text-sm sm:text-base">
              {t('admin.bulk_selected_counter', {
                selected: selectedProducts.length.toString(),
                total: products.length.toString(),
              })}
            </span>
          </div>
          <button
            onClick={handleBulkUpdate}
            disabled={selectedProducts.length === 0 || updating}
            className="bg-black text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            {updating
              ? t('admin.bulk_update_failed')
              : t('admin.bulk_update_button', {
                  count: selectedProducts.length.toString(),
                })}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === products.length && products.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.products_name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('products.price')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('admin.products_status')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        product.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.isActive
                        ? t('admin.status_active')
                        : t('admin.status_inactive')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => {
          setShowInfoDialog(false);
          if (infoDialogType === 'success') {
            router.push('/admin/products');
          }
        }}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default BulkActionsPage;

