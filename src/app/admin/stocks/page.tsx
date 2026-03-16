'use client';

import React, { useEffect, useState } from 'react';
import { getAllProducts, updateProduct } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { checkLowStock } from '@/lib/firestore/inventory_alerts_db';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const StockManagementPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null); // Product ID being updated
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchProducts();
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

  const handleStockChange = (productId: string, variantId: string | null, newStock: number) => {
    setProducts(prevProducts =>
      prevProducts.map(product => {
        if (product.id !== productId) return product;

        if (variantId) {
          // Update variant stock
          const updatedVariants = product.variants.map(variant =>
            variant.id === variantId ? { ...variant, stock: newStock } : variant
          );
          return { ...product, variants: updatedVariants };
        } else {
            // Update main product stock (if we had a main stock field, but currently structure uses variants mostly)
            // If product has no variants, we might want to store stock on the product itself?
            // Based on Product interface, stock is only on variants.
            // If the user wants to manage simple products without variants, we should probably check if we need to add stock to the main product interface.
            // For now, let's assume we are editing variants.
            return product;
        }
      })
    );
  };

  const saveStock = async (product: Product) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setUpdating(product.id);
    try {
      // Only update the variants field to save bandwidth/risk
      await updateProduct(product.id, { variants: product.variants });

      // Check for low stock alerts after updating
      const LOW_STOCK_THRESHOLD = 10; // Default threshold
      for (const variant of product.variants) {
        await checkLowStock(product.id, variant.id, variant.stock, LOW_STOCK_THRESHOLD);
      }

      setInfoDialogMessage(t('admin.stocks_update_success') || 'Stock updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to update stock
      setInfoDialogMessage(t('admin.stocks_update_failed') || 'Failed to update stock');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setUpdating(null);
    }
  };
  
  // Filter products based on search
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
            {t('admin.stocks_title') || 'Stock Management'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage product stock levels</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder={t('admin.stocks_search_placeholder') || 'Search products...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          {filteredProducts.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 font-medium whitespace-nowrap">{t('admin.common.items_per_page') || 'Items per page'}:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
          <Link
            href="/admin/inventory-alerts"
            className="px-4 py-2 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            {t('admin.stocks_view_alerts_button') || 'View Alerts'}
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">
              {t('admin.stocks_empty_search', { term: searchTerm }) ||
                `No products found matching "${searchTerm}"`}
            </p>
            <p className="text-sm text-gray-400">Try adjusting your search terms</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.stocks_table_product') || 'Product'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.stocks_table_variants') || 'Variants & Stock'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.stocks_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 relative rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                            {product.images && product.images.length > 0 ? (
                              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full w-full text-xs text-gray-400">
                                {t('admin.stocks_no_image') || 'No Img'}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{formatPrice(product.price)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        {product.variants && product.variants.length > 0 ? (
                          <div className="space-y-2">
                            {product.variants.map((variant) => (
                              <div key={variant.id} className="flex items-center gap-3">
                                <span
                                  className="text-sm text-gray-600 w-24 truncate"
                                  title={`${variant.name}: ${variant.value}`}
                                >
                                  {variant.name}: {variant.value}
                                </span>
                                <div className={`flex items-center border rounded-md overflow-hidden ${
                                  variant.stock === 0 
                                    ? 'border-red-300 bg-red-50' 
                                    : variant.stock <= 10 
                                    ? 'border-yellow-300 bg-yellow-50' 
                                    : 'border-gray-300'
                                }`}>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={variant.stock}
                                    onChange={(e) => handleStockChange(product.id, variant.id, parseInt(e.target.value) || 0)}
                                    className={`w-20 px-2 py-1 text-sm outline-none text-center ${
                                      variant.stock === 0 
                                        ? 'text-red-600 font-semibold' 
                                        : variant.stock <= 10 
                                        ? 'text-yellow-600 font-medium' 
                                        : ''
                                    }`}
                                  />
                                </div>
                                {variant.stock <= 10 && (
                                  <span
                                    className={`text-xs px-2 py-1 rounded-full ${
                                      variant.stock === 0
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {variant.stock === 0
                                      ? t('admin.stocks_badge_out_of_stock') || 'Out of Stock'
                                      : t('admin.stocks_badge_low_stock') || 'Low Stock'}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No variants configured</div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => saveStock(product)}
                          disabled={updating === product.id}
                          className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${
                            updating === product.id 
                              ? 'bg-blue-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {updating === product.id
                            ? (t('common.saving') || 'Saving...')
                            : (t('admin.stocks_update_button') || 'Update Stock')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedProducts.map((product) => (
                <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-16 w-16 flex-shrink-0 relative rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      {product.images && product.images.length > 0 ? (
                        <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full w-full text-xs text-gray-400">
                          {t('admin.stocks_no_image') || 'No Img'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-500">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                  
                  {product.variants && product.variants.length > 0 ? (
                    <div className="space-y-3 mb-4">
                      {product.variants.map((variant) => (
                        <div key={variant.id} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              {variant.name}: {variant.value}
                            </span>
                            {variant.stock <= 10 && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  variant.stock === 0
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {variant.stock === 0
                                  ? t('admin.stocks_badge_out_of_stock') || 'Out of Stock'
                                  : t('admin.stocks_badge_low_stock') || 'Low Stock'}
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center border rounded-md overflow-hidden ${
                            variant.stock === 0 
                              ? 'border-red-300 bg-red-50' 
                              : variant.stock <= 10 
                              ? 'border-yellow-300 bg-yellow-50' 
                              : 'border-gray-300'
                          }`}>
                            <input 
                              type="number" 
                              min="0"
                              value={variant.stock}
                              onChange={(e) => handleStockChange(product.id, variant.id, parseInt(e.target.value) || 0)}
                              className={`flex-1 px-3 py-2 text-sm outline-none text-center ${
                                variant.stock === 0 
                                  ? 'text-red-600 font-semibold' 
                                  : variant.stock <= 10 
                                  ? 'text-yellow-600 font-medium' 
                                  : ''
                              }`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic mb-4">No variants configured</div>
                  )}
                  
                  <button
                    onClick={() => saveStock(product)}
                    disabled={updating === product.id}
                    className={`w-full px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${
                      updating === product.id 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {updating === product.id
                      ? (t('common.saving') || 'Saving...')
                      : (t('admin.stocks_update_button') || 'Update Stock')}
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-700">
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, filteredProducts.length)} {t('admin.common.of') || 'of'} {filteredProducts.length} {t('admin.common.results') || 'results'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.previous') || 'Previous'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.next') || 'Next'}
                  </button>
                </div>
              </div>
            )}
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

export default StockManagementPage;