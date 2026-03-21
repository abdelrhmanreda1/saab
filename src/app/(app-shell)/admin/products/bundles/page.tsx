'use client';

import React, { useState, useEffect } from 'react';
import { getAllProductBundles, createProductBundle, updateProductBundle, deleteProductBundle } from '@/lib/firestore/product_bundles_db';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';

const ProductBundlesPage = () => {
  const { t } = useLanguage();
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showForm, setShowForm] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ProductBundle | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    products: [] as { productId: string; quantity: number; discount?: number; isRequired: boolean }[],
    bundlePrice: '',
    discountType: 'percentage' as 'percentage' | 'fixed' | 'bundle_price',
    discountValue: '',
    validFrom: '',
    validUntil: '',
    isActive: true,
  });

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchData = async () => {
    try {
      const [bundlesData, productsData] = await Promise.all([
        getAllProductBundles(),
        getAllProducts(),
      ]);
      setBundles(bundlesData);
      setProducts(productsData);
    } catch {
      // Failed to fetch data
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      // Failed to fetch settings
    }
  };

  const handleAddProduct = () => {
    setFormData({
      ...formData,
      products: [...formData.products, { productId: '', quantity: 1, discount: 0, isRequired: true }],
    });
  };

  const handleRemoveProduct = (index: number) => {
    setFormData({
      ...formData,
      products: formData.products.filter((_, i) => i !== index),
    });
  };

  const handleProductChange = (index: number, field: string, value: string | number | boolean | undefined) => {
    const updatedProducts = [...formData.products];
    updatedProducts[index] = { ...updatedProducts[index], [field]: value };
    setFormData({ ...formData, products: updatedProducts });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Disable create/update in demo mode
    if (settings.demoMode) {
      alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      return;
    }

    try {
      const bundleData: Omit<ProductBundle, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        ...(formData.description.trim() ? { description: formData.description.trim() } : {}),
        ...(formData.image.trim() ? { image: formData.image.trim() } : {}),
        products: formData.products.map(p => ({
          productId: p.productId,
          productName: products.find(pr => pr.id === p.productId)?.name || '',
          quantity: p.quantity,
          discount: p.discount,
          isRequired: p.isRequired,
        })),
        ...(formData.bundlePrice ? { bundlePrice: parseFloat(formData.bundlePrice) } : {}),
        discountType: formData.discountType,
        ...(formData.discountValue ? { discountValue: parseFloat(formData.discountValue) } : {}),
        ...(formData.validFrom ? { validFrom: Timestamp.fromDate(new Date(formData.validFrom)) } : {}),
        ...(formData.validUntil ? { validUntil: Timestamp.fromDate(new Date(formData.validUntil)) } : {}),
        isActive: formData.isActive,
      };

      if (editingBundle) {
        await updateProductBundle(editingBundle.id!, bundleData);
      } else {
        await createProductBundle(bundleData);
      }

      setShowForm(false);
      setEditingBundle(null);
      resetForm();
      fetchData();
    } catch {
      // Failed to save bundle
      alert(t('admin.product_bundles_save_failed'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      products: [],
      bundlePrice: '',
      discountType: 'percentage',
      discountValue: '',
      validFrom: '',
      validUntil: '',
      isActive: true,
    });
  };

  const handleEdit = (bundle: ProductBundle) => {
    setEditingBundle(bundle);
    setFormData({
      name: bundle.name,
      description: bundle.description || '',
      image: bundle.image || '',
      products: bundle.products.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        discount: p.discount,
        isRequired: p.isRequired,
      })),
      bundlePrice: bundle.bundlePrice?.toString() || '',
      discountType: bundle.discountType,
      discountValue: bundle.discountValue?.toString() || '',
      validFrom: bundle.validFrom?.toDate ? new Date(bundle.validFrom.toDate()).toISOString().split('T')[0] : '',
      validUntil: bundle.validUntil?.toDate ? new Date(bundle.validUntil.toDate()).toISOString().split('T')[0] : '',
      isActive: bundle.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Disable delete in demo mode
    if (settings.demoMode) {
      alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      return;
    }

    if (!confirm(t('admin.product_bundles_delete_confirm'))) return;
    try {
      await deleteProductBundle(id);
      fetchData();
    } catch {
      // Failed to delete bundle
      alert(t('admin.product_bundles_delete_failed'));
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.product_bundles_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.product_bundles_subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingBundle(null);
            setShowForm(true);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          + {t('admin.product_bundles_new')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">
            {editingBundle
              ? t('admin.product_bundles_form_title_edit')
              : t('admin.product_bundles_form_title_create')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.product_bundles_name_label')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.product_bundles_description_label')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.product_bundles_discount_type_label')}
              </label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' | 'bundle_price' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="percentage">
                  {t('admin.product_bundles_discount_type_percentage')}
                </option>
                <option value="fixed">
                  {t('admin.product_bundles_discount_type_fixed')}
                </option>
                <option value="bundle_price">
                  {t('admin.product_bundles_discount_type_bundle_price')}
                </option>
              </select>
            </div>
            {formData.discountType !== 'bundle_price' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.discountType === 'percentage' ? (t('admin.product_bundles_discount_percentage_label') || 'Discount Percentage') : (t('admin.product_bundles_discount_amount_label') || 'Discount Amount')}
                </label>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            )}
            {formData.discountType === 'bundle_price' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.product_bundles_bundle_price_label')}
                </label>
                <input
                  type="number"
                  value={formData.bundlePrice}
                  onChange={(e) => setFormData({ ...formData, bundlePrice: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.product_bundles_products_label')}
              </label>
              {formData.products.map((product, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    value={product.productId}
                    onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    required
                  >
                    <option value="">
                      {t('admin.product_bundles_products_select_placeholder')}
                    </option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={product.quantity}
                    onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value))}
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={t('admin.product_bundles_quantity_placeholder')}
                    min="1"
                    required
                  />
                  <input
                    type="number"
                    value={product.discount || ''}
                    onChange={(e) => handleProductChange(index, 'discount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={t('admin.product_bundles_discount_placeholder')}
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={product.isRequired}
                      onChange={(e) => handleProductChange(index, 'isRequired', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      {t('admin.product_bundles_required_label')}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    {t('admin.product_bundles_delete')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddProduct}
                className="text-blue-600 hover:text-blue-900 text-sm font-medium"
              >
                + {t('admin.product_bundles_add_product')}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                {editingBundle
                  ? t('admin.product_bundles_save_update')
                  : t('admin.product_bundles_save_create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingBundle(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.product_bundles_cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {bundles.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">
              {t('admin.product_bundles_empty_title') || 'No bundles found.'}
            </p>
            <p className="text-sm text-gray-400">
              {t('admin.product_bundles_empty_message') || 'Get started by creating your first bundle'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_bundles_table_name')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_bundles_table_products')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_bundles_table_discount')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_bundles_table_status')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_bundles_table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bundles.map((bundle) => (
                    <tr key={bundle.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {bundle.name}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {t('admin.product_bundles_products_count', {
                          count: bundle.products.length.toString(),
                        })}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {bundle.discountType === 'percentage' &&
                          bundle.discountValue &&
                          t('admin.product_bundles_discount_percentage', {
                            value: bundle.discountValue.toString(),
                          })}
                        {bundle.discountType === 'fixed' &&
                          bundle.discountValue &&
                          t('admin.product_bundles_discount_fixed', {
                            value: bundle.discountValue.toString(),
                          })}
                        {bundle.discountType === 'bundle_price' &&
                          bundle.bundlePrice &&
                          t('admin.product_bundles_discount_price', {
                            value: bundle.bundlePrice.toString(),
                          })}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                            bundle.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {bundle.isActive
                            ? t('admin.product_bundles_status_active')
                            : t('admin.product_bundles_status_inactive')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(bundle)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {t('admin.product_bundles_edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(bundle.id!)}
                            className="text-red-600 hover:text-red-800"
                          >
                            {t('admin.product_bundles_delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {bundles.map((bundle) => (
                <div key={bundle.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{bundle.name}</h3>
                      <p className="text-xs text-gray-500">
                        {t('admin.product_bundles_products_count', {
                          count: bundle.products.length.toString(),
                        })}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {bundle.discountType === 'percentage' &&
                          bundle.discountValue &&
                          t('admin.product_bundles_discount_percentage', {
                            value: bundle.discountValue.toString(),
                          })}
                        {bundle.discountType === 'fixed' &&
                          bundle.discountValue &&
                          t('admin.product_bundles_discount_fixed', {
                            value: bundle.discountValue.toString(),
                          })}
                        {bundle.discountType === 'bundle_price' &&
                          bundle.bundlePrice &&
                          t('admin.product_bundles_discount_price', {
                            value: bundle.bundlePrice.toString(),
                          })}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md ml-3 ${
                        bundle.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {bundle.isActive
                        ? t('admin.product_bundles_status_active')
                        : t('admin.product_bundles_status_inactive')}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(bundle)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.product_bundles_edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(bundle.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('admin.product_bundles_delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductBundlesPage;

