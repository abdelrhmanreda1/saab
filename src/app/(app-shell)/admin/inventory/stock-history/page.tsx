'use client';

import React, { useState, useEffect } from 'react';
import { getStockHistory, getWarehouseStockHistory, getAllWarehouses } from '@/lib/firestore/warehouses_db';
import { StockHistory } from '@/lib/firestore/warehouses';
import { Warehouse } from '@/lib/firestore/warehouses';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { useLanguage } from '@/context/LanguageContext';

const StockHistoryPage = () => {
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    warehouseId: '',
    productId: '',
  });
  const { t } = useLanguage();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchData = async () => {
    try {
      const [warehousesData, productsData] = await Promise.all([
        getAllWarehouses(true),
        getAllProducts(),
      ]);
      setWarehouses(warehousesData);
      setProducts(productsData);

      if (filters.warehouseId) {
        const historyData = await getWarehouseStockHistory(filters.warehouseId);
        setHistory(historyData);
      } else if (filters.productId) {
        const historyData = await getStockHistory(filters.productId);
        setHistory(historyData);
      } else {
        setHistory([]);
      }
    } catch {
      // Failed to fetch data
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t('admin.inventory_history_title') || 'Stock History'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t('admin.inventory_history_subtitle') || 'Complete stock movement history and audit trail'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t('admin.inventory_history_filter_warehouse') || 'Filter by Warehouse'}
            </label>
            <select
              value={filters.warehouseId}
              onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value, productId: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
            >
              <option value="">{t('admin.inventory_history_all_warehouses') || 'All Warehouses'}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t('admin.inventory_history_filter_product') || 'Filter by Product'}
            </label>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value, warehouseId: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
            >
              <option value="">{t('admin.inventory_history_all_products') || 'All Products'}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {history.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">
              {filters.warehouseId || filters.productId
                ? t('admin.inventory_history_empty_filtered') || 'No history found for selected filters'
                : t('admin.inventory_history_empty_unfiltered') ||
                  'Select a warehouse or product to view history'}
            </p>
            <p className="text-sm text-gray-400">
              {t('admin.inventory_history_empty_hint') || 'Try adjusting your filters'}
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
                      {t('admin.inventory_history_table_date') || 'Date'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_warehouse') || 'Warehouse'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_product') || 'Product'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_movement_type') || 'Movement Type'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_quantity') || 'Quantity'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_previous_stock') || 'Previous Stock'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_new_stock') || 'New Stock'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_history_table_reference') || 'Reference'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.createdAt?.toDate
                          ? new Date(entry.createdAt.toDate()).toLocaleString()
                          : t('common.not_applicable') || 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{entry.warehouseName}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {entry.productName}
                        {entry.variantName && <span className="text-gray-400"> ({entry.variantName})</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                            entry.movementType === 'transfer_in' ||
                            (entry.movementType === 'adjustment' && entry.quantity > 0) ||
                            entry.movementType === 'return' ||
                            entry.movementType === 'purchase'
                              ? 'bg-green-50 text-green-700'
                              : entry.movementType === 'transfer_out' ||
                                (entry.movementType === 'adjustment' && entry.quantity < 0) ||
                                entry.movementType === 'sale'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t(`admin.inventory_history_movement_${entry.movementType}`) ||
                            entry.movementType.replace('_', ' ')}
                        </span>
                      </td>
                      <td
                        className={`px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                          entry.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {entry.quantity > 0 ? '+' : ''}
                        {entry.quantity}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entry.previousStock}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{entry.newStock}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {entry.referenceNumber || entry.referenceId || t('common.not_applicable') || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {history.map((entry) => (
                <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1">
                        {entry.createdAt?.toDate
                          ? new Date(entry.createdAt.toDate()).toLocaleString()
                          : t('common.not_applicable') || 'N/A'}
                      </p>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {entry.productName}
                        {entry.variantName && <span className="text-gray-400"> ({entry.variantName})</span>}
                      </h3>
                      <p className="text-xs text-gray-600">{entry.warehouseName}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ml-3 ${
                        entry.movementType === 'transfer_in' ||
                        (entry.movementType === 'adjustment' && entry.quantity > 0) ||
                        entry.movementType === 'return' ||
                        entry.movementType === 'purchase'
                          ? 'bg-green-50 text-green-700'
                          : entry.movementType === 'transfer_out' ||
                            (entry.movementType === 'adjustment' && entry.quantity < 0) ||
                            entry.movementType === 'sale'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t(`admin.inventory_history_movement_${entry.movementType}`) ||
                        entry.movementType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 font-medium">{t('admin.inventory_history_table_quantity') || 'Quantity'}:</span>
                      <span className={`ml-2 font-semibold ${entry.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.quantity > 0 ? '+' : ''}
                        {entry.quantity}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">{t('admin.inventory_history_table_previous_stock') || 'Previous'}:</span>
                      <span className="ml-2 text-gray-900 font-semibold">{entry.previousStock}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">{t('admin.inventory_history_table_new_stock') || 'New Stock'}:</span>
                      <span className="ml-2 text-gray-900 font-semibold">{entry.newStock}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">{t('admin.inventory_history_table_reference') || 'Reference'}:</span>
                      <span className="ml-2 text-gray-900">
                        {entry.referenceNumber || entry.referenceId || t('common.not_applicable') || 'N/A'}
                      </span>
                    </div>
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

export default StockHistoryPage;

