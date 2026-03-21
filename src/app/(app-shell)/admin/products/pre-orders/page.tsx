'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { updateProduct } from '@/lib/firestore/products_db';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const PreOrdersPage = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'preorder' | 'backorder'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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

  const fetchProducts = async () => {
    try {
      const allProducts = await getAllProducts();
      let filtered = allProducts;
      
      if (filter === 'preorder') {
        filtered = allProducts.filter(p => p.allowPreOrder);
      } else if (filter === 'backorder') {
        filtered = allProducts.filter(p => {
          const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
          return totalStock === 0 && !p.allowPreOrder;
        });
      }
      
      setProducts(filtered);
    } catch {
      // Failed to fetch products
    } finally {
      setLoading(false);
    }
  };

  const handleEnablePreOrder = async (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleSavePreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    const formData = new FormData(e.target as HTMLFormElement);
    const expectedDate = formData.get('expectedDate') as string;
    const message = formData.get('message') as string;

    try {
      await updateProduct(editingProduct.id, {
        allowPreOrder: true,
        preOrderExpectedDate: expectedDate ? Timestamp.fromDate(new Date(expectedDate)) : undefined,
        preOrderMessage: message || undefined,
      });

      setShowForm(false);
      setEditingProduct(null);
      fetchProducts();
      setInfoDialogMessage(t('admin.preorders_update_success') || 'Pre-order settings updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to update product
      setInfoDialogMessage(t('admin.preorders_update_failed') || 'Failed to update pre-order settings.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleDisablePreOrder = async (productId: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await updateProduct(productId, {
        allowPreOrder: false,
        preOrderExpectedDate: undefined,
        preOrderMessage: undefined,
      });
      fetchProducts();
      setInfoDialogMessage(t('admin.preorders_disable_success') || 'Pre-order disabled successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to update product
      setInfoDialogMessage(t('admin.preorders_update_failed') || 'Failed to update pre-order settings.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.preorders_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.preorders_subtitle')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.preorders_filter_all')}
          </button>
          <button
            onClick={() => setFilter('preorder')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'preorder' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.preorders_filter_preorders')}
          </button>
          <button
            onClick={() => setFilter('backorder')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'backorder' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.preorders_filter_backorders')}
          </button>
        </div>
      </div>

      {showForm && editingProduct && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">
            {t('admin.preorders_enable_title', { product: editingProduct.name })}
          </h2>
          <form onSubmit={handleSavePreOrder} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.preorders_expected_date_label')}
              </label>
              <input
                type="date"
                name="expectedDate"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.preorders_message_label')}
              </label>
              <textarea
                name="message"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.preorders_message_placeholder')}
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('admin.preorders_save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingProduct(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('admin.preorders_cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.preorders_table_product')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.preorders_table_stock')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.preorders_table_preorder')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.preorders_table_expected_date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.preorders_table_message')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.preorders_table_actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                const isOutOfStock = totalStock === 0;
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/admin/products/${product.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={isOutOfStock ? 'text-red-600 font-medium' : ''}>
                        {t('admin.preorders_stock_units', {
                          count: totalStock.toString(),
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded-full ${
                          product.allowPreOrder
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {product.allowPreOrder
                          ? t('admin.preorders_status_enabled')
                          : t('admin.preorders_status_disabled')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.preOrderExpectedDate?.toDate
                        ? new Date(
                            product.preOrderExpectedDate.toDate()
                          ).toLocaleDateString()
                        : t('admin.preorders_date_not_set')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {product.preOrderMessage ||
                        t('admin.preorders_message_not_set')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {product.allowPreOrder ? (
                        <button
                          onClick={() => handleDisablePreOrder(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('admin.preorders_disable')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnablePreOrder(product)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('admin.preorders_enable')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {products.map((product) => {
            const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
            const isOutOfStock = totalStock === 0;
            
            return (
              <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/products/${product.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600 block mb-2">
                      {product.name}
                    </Link>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>{t('admin.preorders_table_stock') || 'Stock'}: <span className={isOutOfStock ? 'text-red-600 font-medium' : ''}>{totalStock} {t('admin.preorders_stock_units', { count: totalStock.toString() })}</span></p>
                      <p>Expected: {product.preOrderExpectedDate?.toDate ? new Date(product.preOrderExpectedDate.toDate()).toLocaleDateString() : t('admin.preorders_date_not_set')}</p>
                      {product.preOrderMessage && <p className="line-clamp-2">{product.preOrderMessage}</p>}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                    product.allowPreOrder ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
                  }`}>
                    {product.allowPreOrder ? t('admin.preorders_status_enabled') : t('admin.preorders_status_disabled')}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  {product.allowPreOrder ? (
                    <button
                      onClick={() => handleDisablePreOrder(product.id)}
                      className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('admin.preorders_disable')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnablePreOrder(product)}
                      className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.preorders_enable')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
    </div>
  );
};

export default PreOrdersPage;

