'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getProductPerformance } from '@/lib/firestore/analytics_db';
import { ProductPerformance } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const ProductPerformancePage = () => {
  const { t } = useLanguage();
  const { formatPrice, defaultCurrency } = useCurrency();
  const [, setUser] = useState<User | null>(null);
  const [performances, setPerformances] = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchPerformance();
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, router, dateRange]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(dateRange));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const data = await getProductPerformance(start, end);
      setPerformances(data);
    } catch {
      // Error fetching performance
    } finally {
      setLoading(false);
    }
  };

  const topProducts = performances.slice(0, 10);

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
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.product_performance_reports') || t('admin.product_performance') || 'Product Performance Reports'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.product_performance_subtitle') || 'Track product sales and performance metrics'}</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
        >
          <option value="7">{t('admin.last_7_days') || 'Last 7 Days'}</option>
          <option value="30">{t('admin.last_30_days') || 'Last 30 Days'}</option>
          <option value="90">{t('admin.last_3_months') || 'Last 3 Months'}</option>
          <option value="365">{t('admin.last_year') || 'Last Year'}</option>
        </select>
      </div>

      {topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">{t('admin.product_performance_top_10') || 'Top 10 Products by Revenue'}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="productName" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#8884d8" name={`${t('admin.product_performance_revenue') || 'Revenue'} (${defaultCurrency?.symbol || ''})`} />
              <Bar dataKey="purchases" fill="#82ca9d" name={t('admin.product_performance_purchases') || 'Purchases'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {performances.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.product_performance_empty') || 'No product performance data available.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_product') || 'Product'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_views') || 'Views'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_clicks') || 'Clicks'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_add_to_cart') || 'Add to Cart'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_purchases') || 'Purchases'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_revenue') || 'Revenue'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.product_performance_table_conversion_rate') || 'Conversion Rate'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {performances.map((perf) => (
                    <tr key={perf.productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{perf.productName}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{perf.views.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{perf.clicks.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{perf.addToCart.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{perf.purchases.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatPrice(perf.revenue)}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          perf.conversionRate > 5 ? 'bg-green-50 text-green-700' :
                          perf.conversionRate > 2 ? 'bg-yellow-50 text-yellow-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {perf.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {performances.map((perf) => (
                <div key={perf.productId} className="p-4 hover:bg-gray-50 transition-colors">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">{perf.productName}</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div><span className="font-medium">{t('admin.product_performance_table_views') || 'Views'}:</span> {perf.views.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.product_performance_table_clicks') || 'Clicks'}:</span> {perf.clicks.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.product_performance_table_add_to_cart') || 'Add to Cart'}:</span> {perf.addToCart.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.product_performance_table_purchases') || 'Purchases'}:</span> {perf.purchases.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.product_performance_table_revenue') || 'Revenue'}:</span> {formatPrice(perf.revenue)}</div>
                    <div>
                      <span className="font-medium">{t('admin.product_performance_table_conversion_rate') || 'Conversion'}:</span>{' '}
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        perf.conversionRate > 5 ? 'bg-green-50 text-green-700' :
                        perf.conversionRate > 2 ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {perf.conversionRate.toFixed(1)}%
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

export default ProductPerformancePage;

