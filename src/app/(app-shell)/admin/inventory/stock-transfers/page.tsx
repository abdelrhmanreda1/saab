'use client';

import React, { useState, useEffect } from 'react';
import {
  getAllStockTransfers,
  createStockTransfer,
  approveStockTransfer,
  completeStockTransfer,
  getAllWarehouses,
} from '@/lib/firestore/warehouses_db';
import { StockTransfer } from '@/lib/firestore/warehouses';
import { Warehouse } from '@/lib/firestore/warehouses';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const StockTransfersPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    items: [{ productId: '', variantId: '', quantity: 1 }],
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
      const [transfersData, warehousesData, productsData] = await Promise.all([
        getAllStockTransfers(),
        getAllWarehouses(true),
        getAllProducts(),
      ]);
      setTransfers(transfersData);
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
      const fromWarehouse = warehouses.find(w => w.id === formData.fromWarehouseId);
      const toWarehouse = warehouses.find(w => w.id === formData.toWarehouseId);

      if (!fromWarehouse || !toWarehouse) {
        setInfoDialogMessage(t('admin.inventory_transfers_select_both_warehouses') || 'Please select both warehouses');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        return;
      }

      const items = formData.items.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          variantId: item.variantId || undefined,
          variantName: item.variantId ? product?.variants.find(v => v.id === item.variantId)?.name : undefined,
          quantity: item.quantity,
        };
      });

      await createStockTransfer({
        fromWarehouseId: formData.fromWarehouseId,
        fromWarehouseName: fromWarehouse.name,
        toWarehouseId: formData.toWarehouseId,
        toWarehouseName: toWarehouse.name,
        items,
        notes: formData.notes || undefined,
        requestedBy: user.uid,
        requestedByName: user.displayName || user.email || 'Admin',
      });

      setShowForm(false);
      resetForm();
      fetchData();
      setInfoDialogMessage(t('admin.inventory_transfers_create_success') || 'Stock transfer created successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to create transfer
      setInfoDialogMessage(t('admin.inventory_transfers_create_failed') || 'Failed to create transfer');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const resetForm = () => {
    setFormData({
      fromWarehouseId: '',
      toWarehouseId: '',
      items: [{ productId: '', variantId: '', quantity: 1 }],
      notes: '',
    });
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await approveStockTransfer(id, user.uid);
      fetchData();
      setInfoDialogMessage(t('admin.inventory_transfers_approve_success') || 'Transfer approved successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to approve transfer
      setInfoDialogMessage(t('admin.inventory_transfers_approve_failed') || 'Failed to approve transfer.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleComplete = async (id: string) => {
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await completeStockTransfer(id, user.uid);
      fetchData();
      setInfoDialogMessage(t('admin.inventory_transfers_complete_success') || 'Transfer completed successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to complete transfer
      setInfoDialogMessage(t('admin.inventory_transfers_complete_failed') || 'Failed to complete transfer.');
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
            {t('admin.inventory_transfers_title') || 'Stock Transfers'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.inventory_transfers_subtitle') || 'Transfer stock between warehouses'}
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
          {t('admin.inventory_transfers_new_button') || 'New Transfer'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {t('admin.inventory_transfers_create_title') || 'New Stock Transfer'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_transfers_field_from') || 'From Warehouse'}
                </label>
                <select
                  value={formData.fromWarehouseId}
                  onChange={(e) => setFormData({ ...formData, fromWarehouseId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
                  required
                >
                  <option value="">
                    {t('admin.inventory_transfers_field_from_placeholder') || 'Select warehouse'}
                  </option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_transfers_field_to') || 'To Warehouse'}
                </label>
                <select
                  value={formData.toWarehouseId}
                  onChange={(e) => setFormData({ ...formData, toWarehouseId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
                  required
                >
                  <option value="">
                    {t('admin.inventory_transfers_field_to_placeholder') || 'Select warehouse'}
                  </option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.inventory_transfers_field_items') || 'Items'}
              </label>
              {formData.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      const newItems = [...formData.items];
                      newItems[idx].productId = e.target.value;
                      setFormData({ ...formData, items: newItems });
                    }}
                    className="sm:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
                    required
                  >
                    <option value="">
                      {t('admin.inventory_transfers_field_product_placeholder') || 'Select product'}
                    </option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder={t('admin.inventory_transfers_field_quantity_placeholder') || 'Quantity'}
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...formData.items];
                      newItems[idx].quantity = parseInt(e.target.value) || 1;
                      setFormData({ ...formData, items: newItems });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
                    required
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = formData.items.filter((_, i) => i !== idx);
                      setFormData({ ...formData, items: newItems });
                    }}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    {t('common.remove') || 'Remove'}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, items: [...formData.items, { productId: '', variantId: '', quantity: 1 }] })}
                className="text-blue-600 hover:text-blue-900 text-sm font-medium"
              >
                {t('admin.inventory_transfers_add_item_button') || '+ Add Item'}
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('admin.inventory_transfers_field_notes') || 'Notes'}
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
                {t('admin.inventory_transfers_create_button') || 'Create Transfer'}
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
        {transfers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.inventory_transfers_empty') || 'No stock transfers found.'}</p>
            <p className="text-sm text-gray-400">
              {t('admin.inventory_transfers_empty_message') || 'Get started by creating your first transfer'}
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
                      {t('admin.inventory_transfers_table_number') || 'Transfer #'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_transfers_table_from_to') || 'From → To'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_transfers_table_items') || 'Items'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_transfers_table_status') || 'Status'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_transfers_table_requested_by') || 'Requested By'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_transfers_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{transfer.transferNumber}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {transfer.fromWarehouseName} → {transfer.toWarehouseName}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {t('admin.inventory_transfers_items_count', { count: transfer.items.length }) ||
                          `${transfer.items.length} items`}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                            transfer.status === 'completed'
                              ? 'bg-green-50 text-green-700'
                              : transfer.status === 'in_transit'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {t(`admin.inventory_transfers_status_${transfer.status}`) || transfer.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{transfer.requestedByName || 'N/A'}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {transfer.status === 'pending' && (
                            <button
                              onClick={() => handleApprove(transfer.id!)}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              {t('admin.inventory_transfers_action_approve') || 'Approve'}
                            </button>
                          )}
                          {transfer.status === 'in_transit' && (
                            <button
                              onClick={() => handleComplete(transfer.id!)}
                              className="text-green-600 hover:text-green-900 text-sm font-medium"
                            >
                              {t('admin.inventory_transfers_action_complete') || 'Complete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {transfers.map((transfer) => (
                <div key={transfer.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{transfer.transferNumber}</h3>
                      <p className="text-xs text-gray-600 mb-2">
                        {transfer.fromWarehouseName} → {transfer.toWarehouseName}
                      </p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>
                          <span className="font-medium">{t('admin.inventory_transfers_table_items') || 'Items'}:</span> {transfer.items.length}
                        </p>
                        <p>
                          <span className="font-medium">{t('admin.inventory_transfers_table_requested_by') || 'Requested by'}:</span> {transfer.requestedByName || (t('common.not_applicable') || 'N/A')}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ml-3 ${
                        transfer.status === 'completed'
                          ? 'bg-green-50 text-green-700'
                          : transfer.status === 'in_transit'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {t(`admin.inventory_transfers_status_${transfer.status}`) || transfer.status}
                    </span>
                  </div>
                  {(transfer.status === 'pending' || transfer.status === 'in_transit') && (
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      {transfer.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(transfer.id!)}
                          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          {t('admin.inventory_transfers_action_approve') || 'Approve'}
                        </button>
                      )}
                      {transfer.status === 'in_transit' && (
                        <button
                          onClick={() => handleComplete(transfer.id!)}
                          className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-md text-sm font-medium hover:bg-green-100 transition-colors"
                        >
                          {t('admin.inventory_transfers_action_complete') || 'Complete'}
                        </button>
                      )}
                    </div>
                  )}
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

export default StockTransfersPage;

