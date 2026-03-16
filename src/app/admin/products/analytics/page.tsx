'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Product } from '@/lib/firestore/products';
import { getAllProducts } from '@/lib/firestore/products_db';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useLanguage } from '@/context/LanguageContext';

const ProductAnalyticsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('product');
  const { t } = useLanguage();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'views' | 'clicks' | 'conversion' | 'purchases'>('views');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const fetchedProducts = await getAllProducts();
        setProducts(fetchedProducts);
        
        if (productId) {
          // Product ID is available in URL for filtering
        }
      } catch {
        // Failed to fetch products
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [productId]);

  const sortedProducts = [...products].sort((a, b) => {
    const aAnalytics = a.analytics || { views: 0, clicks: 0, conversionRate: 0, purchases: 0 };
    const bAnalytics = b.analytics || { views: 0, clicks: 0, conversionRate: 0, purchases: 0 };
    
    switch (sortBy) {
      case 'views':
        return (bAnalytics.views || 0) - (aAnalytics.views || 0);
      case 'clicks':
        return (bAnalytics.clicks || 0) - (aAnalytics.clicks || 0);
      case 'conversion':
        return (bAnalytics.conversionRate || 0) - (aAnalytics.conversionRate || 0);
      case 'purchases':
        return (bAnalytics.purchases || 0) - (aAnalytics.purchases || 0);
      default:
        return 0;
    }
  });

  const topProducts = sortedProducts.slice(0, 10);

  const chartData = topProducts.map(product => ({
    name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
    views: product.analytics?.views || 0,
    clicks: product.analytics?.clicks || 0,
    purchases: product.analytics?.purchases || 0,
    conversion: product.analytics?.conversionRate || 0,
  }));

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.product_analytics_title') || 'Product Analytics'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.product_analytics_subtitle') || 'View analytics and performance metrics for your products'}
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/products')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.product_analytics_back_to_products') || 'Back to Products'}
        </button>
      </div>

      {/* Sort Options */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            {t('admin.product_analytics_sort_by_label') || 'Sort By:'}
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'views' | 'clicks' | 'conversion' | 'purchases')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm flex-1 sm:flex-initial"
          >
            <option value="views">{t('admin.product_analytics_sort_views') || 'Views'}</option>
            <option value="clicks">{t('admin.product_analytics_sort_clicks') || 'Clicks'}</option>
            <option value="conversion">{t('admin.product_analytics_sort_conversion') || 'Conversion Rate'}</option>
            <option value="purchases">{t('admin.product_analytics_sort_purchases') || 'Purchases'}</option>
          </select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">
            {t('admin.product_analytics_chart_views_clicks_title') || 'Views & Clicks'}
          </h3>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" fill="#000000" name={t('admin.product_analytics_table_views') || 'Views'} />
                <Bar dataKey="clicks" fill="#6366f1" name={t('admin.product_analytics_table_clicks') || 'Clicks'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">
            {t('admin.product_analytics_chart_conversion_title') || 'Conversion & Purchases'}
          </h3>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="conversion"
                  stroke="#10b981"
                  strokeWidth={2}
                  name={t('admin.product_analytics_table_conversion') || 'Conversion %'}
                />
                <Line
                  type="monotone"
                  dataKey="purchases"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name={t('admin.product_analytics_table_purchases') || 'Purchases'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Product List with Analytics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {t('admin.product_analytics_all_title') || 'All Products'}
          </h3>
        </div>
        {sortedProducts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.product_analytics_empty_title') || 'No products found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.product_analytics_empty_message') || 'Analytics will appear here once products are viewed.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_analytics_table_product') || 'Product'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_analytics_table_views') || 'Views'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_analytics_table_clicks') || 'Clicks'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_analytics_table_add_to_cart') || 'Add to Cart'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_analytics_table_purchases') || 'Purchases'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.product_analytics_table_conversion') || 'Conversion'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedProducts.map((product) => {
                    const analytics = product.analytics || {
                      views: 0,
                      clicks: 0,
                      addToCartCount: 0,
                      purchases: 0,
                      conversionRate: 0,
                    };
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{product.name}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{analytics.views}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{analytics.clicks}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{analytics.addToCartCount}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{analytics.purchases}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm">
                          <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                            analytics.conversionRate > 5 ? 'bg-green-50 text-green-700' :
                            analytics.conversionRate > 2 ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {analytics.conversionRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {sortedProducts.map((product) => {
                const analytics = product.analytics || {
                  views: 0,
                  clicks: 0,
                  addToCartCount: 0,
                  purchases: 0,
                  conversionRate: 0,
                };
                return (
                  <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{product.name}</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500 font-medium">{t('admin.product_analytics_table_views') || 'Views'}:</span>
                        <span className="ml-2 text-gray-900 font-semibold">{analytics.views}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">{t('admin.product_analytics_table_clicks') || 'Clicks'}:</span>
                        <span className="ml-2 text-gray-900 font-semibold">{analytics.clicks}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">{t('admin.product_analytics_table_add_to_cart') || 'Add to Cart'}:</span>
                        <span className="ml-2 text-gray-900 font-semibold">{analytics.addToCartCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">{t('admin.product_analytics_table_purchases') || 'Purchases'}:</span>
                        <span className="ml-2 text-gray-900 font-semibold">{analytics.purchases}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">{t('admin.product_analytics_table_conversion') || 'Conversion Rate'}:</span>
                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                          analytics.conversionRate > 5 ? 'bg-green-50 text-green-700' :
                          analytics.conversionRate > 2 ? 'bg-yellow-50 text-yellow-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {analytics.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductAnalyticsPage;

