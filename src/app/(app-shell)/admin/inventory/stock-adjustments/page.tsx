'use client';

import React, { useState, useEffect } from 'react';
import { getAllStockAdjustments, createStockAdjustment, getAllWarehouses } from '@/lib/firestore/warehouses_db';
import { StockAdjustment } from '@/lib/firestore/warehouses';
import { Warehouse } from '@/lib/firestore/warehouses';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const StockAdjustmentsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    warehouseId: '',
    productId: '',
    variantId: '',
    adjustmentType: 'increase' as 'increase' | 'decrease',
    quantity: 1,
    reason: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    try {
      const [adjustmentsData, warehousesData, productsData] = await Promise.all([
        getAllStockAdjustments(),
        getAllWarehouses(true),
        getAllProducts(),
      ]);
      setAdjustments(adjustmentsData);
      setWarehouses(warehousesData);
      setProducts(productsData);
    } catch {
      // Failed to fetch data
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const warehouse = warehouses.find((w) => w.id === formData.warehouseId);
      const product = products.find((p) => p.id === formData.productId);

      if (!warehouse || !product) {
        setInfoDialogMessage(t('admin.inventory_adjustments_select_required') || 'Please select warehouse and product');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        return;
      }

      await createStockAdjustment({
        warehouseId: formData.warehouseId,
        warehouseName: warehouse.name,
        productId: formData.productId,
        productName: product.name,
        variantId: formData.variantId || undefined,
        variantName: formData.variantId ? product.variants.find(v => v.id === formData.variantId)?.name : undefined,
        adjustmentType: formData.adjustmentType,
        quantity: formData.quantity,
        reason: formData.reason,
        notes: formData.notes || undefined,
        adjustedBy: user.uid,
        adjustedByName: user.displayName || user.email || t('admin.user_admin_fallback') || 'Admin',
      });

      setShowForm(false);
      resetForm();
      fetchData();
      setInfoDialogMessage(t('admin.inventory_adjustments_create_success') || 'Stock adjustment created successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to create adjustment
      setInfoDialogMessage(t('admin.inventory_adjustments_create_failed') || 'Failed to create adjustment');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const resetForm = () => {
    setFormData({
      warehouseId: '',
      productId: '',
      variantId: '',
      adjustmentType: 'increase',
      quantity: 1,
      reason: '',
      notes: '',
    });
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

  const selectedProduct = products.find(p => p.id === formData.productId);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.inventory_adjustments_title') || 'Stock Adjustments'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.inventory_adjustments_subtitle') || 'Manual stock adjustments with audit trail'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            resetForm();
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.inventory_adjustments_new_button') || 'New Adjustment'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {t('admin.inventory_adjustments_create_title') || 'New Stock Adjustment'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('admin.inventory_adjustments_field_warehouse') || 'Warehouse'}
              </label>
              <select
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
                required
              >
                <option value="">
                  {t('admin.inventory_adjustments_field_warehouse_placeholder') || 'Select warehouse'}
                </option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('admin.inventory_adjustments_field_product') || 'Product'}
              </label>
              <select
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value, variantId: '' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
                required
              >
                <option value="">
                  {t('admin.inventory_adjustments_field_product_placeholder') || 'Select product'}
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedProduct && selectedProduct.variants.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_adjustments_field_variant') || 'Variant (Optional)'}
                </label>
                <select
                  value={formData.variantId}
                  onChange={(e) => setFormData({ ...formData, variantId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
                >
                  <option value="">{t('admin.inventory_adjustments_field_variant_none') || 'No variant'}</option>
                  {selectedProduct.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}: {variant.value}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_adjustments_field_type') || 'Adjustment Type'}
                </label>
                <select
                  value={formData.adjustmentType}
                  onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value as 'increase' | 'decrease' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
                >
                  <option value="increase">
                    {t('admin.inventory_adjustments_type_increase') || 'Increase'}
                  </option>
                  <option value="decrease">
                    {t('admin.inventory_adjustments_type_decrease') || 'Decrease'}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_adjustments_field_quantity') || 'Quantity'}
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
                  required
                  min="1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('admin.inventory_adjustments_field_reason') || 'Reason'}
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
                required
              >
                <option value="">
                  {t('admin.inventory_adjustments_reason_placeholder') || 'Select reason'}
                </option>
                <option value="Damaged">
                  {t('admin.inventory_adjustments_reason_damaged') || 'Damaged'}
                </option>
                <option value="Found">
                  {t('admin.inventory_adjustments_reason_found') || 'Found'}
                </option>
                <option value="Theft">
                  {t('admin.inventory_adjustments_reason_theft') || 'Theft'}
                </option>
                <option value="Expired">
                  {t('admin.inventory_adjustments_reason_expired') || 'Expired'}
                </option>
                <option value="Returned">
                  {t('admin.inventory_adjustments_reason_returned') || 'Returned'}
                </option>
                <option value="Other">
                  {t('admin.inventory_adjustments_reason_other') || 'Other'}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('admin.inventory_adjustments_field_notes') || 'Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="px-4 sm:px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {t('admin.inventory_adjustments_create_button') || 'Create Adjustment'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 sm:px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {adjustments.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.inventory_adjustments_empty') || 'No stock adjustments found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.inventory_adjustments_empty_message') || 'Get started by creating your first adjustment'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_number') || 'Adjustment #'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_warehouse') || 'Warehouse'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_product') || 'Product'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_type') || 'Type'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_quantity') || 'Quantity'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_reason') || 'Reason'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_adjusted_by') || 'Adjusted By'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_adjustments_table_date') || 'Date'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {adjustments.map((adjustment) => (
                    <tr key={adjustment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{adjustment.adjustmentNumber}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{adjustment.warehouseName}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {adjustment.productName}
                        {adjustment.variantName && <span className="text-gray-400"> ({adjustment.variantName})</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                            adjustment.adjustmentType === 'increase'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {adjustment.adjustmentType === 'increase'
                            ? t('admin.inventory_adjustments_type_increase') || 'Increase'
                            : t('admin.inventory_adjustments_type_decrease') || 'Decrease'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{adjustment.quantity}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{adjustment.reason}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {adjustment.adjustedByName || t('common.not_applicable') || 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {adjustment.createdAt?.toDate
                          ? new Date(adjustment.createdAt.toDate()).toLocaleDateString()
                          : t('common.not_applicable') || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {adjustments.map((adjustment) => (
                <div key={adjustment.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{adjustment.adjustmentNumber}</h3>
                      <p className="text-xs text-gray-500 mb-2">{adjustment.warehouseName}</p>
                      <p className="text-sm text-gray-900 mb-1">
                        {adjustment.productName}
                        {adjustment.variantName && <span className="text-gray-400"> ({adjustment.variantName})</span>}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ml-3 ${
                        adjustment.adjustmentType === 'increase'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {adjustment.adjustmentType === 'increase'
                        ? t('admin.inventory_adjustments_type_increase') || 'Increase'
                        : t('admin.inventory_adjustments_type_decrease') || 'Decrease'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_adjustments_quantity_label') || 'Quantity'}:
                      </span>
                      <span className="ml-2 text-gray-900 font-semibold">{adjustment.quantity}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_adjustments_reason_label') || 'Reason'}:
                      </span>
                      <span className="ml-2 text-gray-900">{adjustment.reason}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_adjustments_adjusted_by_label') || 'Adjusted by'}:
                      </span>
                      <span className="ml-2 text-gray-900">{adjustment.adjustedByName || t('common.not_applicable') || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_adjustments_date_label') || 'Date'}:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {adjustment.createdAt?.toDate
                          ? new Date(adjustment.createdAt.toDate()).toLocaleDateString()
                          : t('common.not_applicable') || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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

export default StockAdjustmentsPage;

