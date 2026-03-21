'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getInventoryReport } from '@/lib/firestore/analytics_db';
import { InventoryReport } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const InventoryReportsPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchReports();
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, router, dateRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(dateRange));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const data = await getInventoryReport(start, end);
      setReports(data);
    } catch {
      // Error fetching inventory reports
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="container mx-auto p-4 max-w-7xl py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-serif font-bold">
          {t('admin.inventory_reports') || 'Inventory Reports'}
        </h1>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
        >
          <option value="7">{t('admin.last_7_days') || 'Last 7 Days'}</option>
          <option value="30">{t('admin.last_30_days') || 'Last 30 Days'}</option>
          <option value="90">{t('admin.last_3_months') || 'Last 3 Months'}</option>
          <option value="365">{t('admin.last_year') || 'Last Year'}</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.inventory_reports_empty') || 'No inventory data available.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_product') || 'Product'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_current_stock') || 'Current Stock'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_units_sold') || 'Units Sold'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_stock_value') || 'Stock Value'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_sales_value') || 'Sales Value'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_turnover_rate') || 'Turnover Rate'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_days_of_stock') || 'Days of Stock'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.inventory_reports_table_status') || 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{report.productName}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{report.currentStock}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{report.unitsSold}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatPrice(report.stockValue)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatPrice(report.salesValue)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{report.turnoverRate.toFixed(1)}%</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {report.daysOfStock < 999 ? report.daysOfStock.toFixed(0) : 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        {report.lowStockAlert ? (
                          <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-md">
                            {t('admin.inventory_reports_low_stock') || 'Low Stock'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-md">
                            {t('admin.inventory_reports_in_stock') || 'In Stock'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {reports.map((report) => (
                <div key={report.productId} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{report.productName}</h3>
                    </div>
                    {report.lowStockAlert ? (
                      <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-md ml-3">
                        {t('admin.inventory_reports_low_stock') || 'Low Stock'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-md ml-3">
                        {t('admin.inventory_reports_in_stock') || 'In Stock'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div><span className="font-medium">{t('admin.inventory_reports_table_current_stock') || 'Stock'}:</span> {report.currentStock}</div>
                    <div><span className="font-medium">{t('admin.inventory_reports_table_units_sold') || 'Sold'}:</span> {report.unitsSold}</div>
                    <div><span className="font-medium">{t('admin.inventory_reports_table_stock_value') || 'Stock Value'}:</span> {formatPrice(report.stockValue)}</div>
                    <div><span className="font-medium">{t('admin.inventory_reports_table_sales_value') || 'Sales Value'}:</span> {formatPrice(report.salesValue)}</div>
                    <div><span className="font-medium">{t('admin.inventory_reports_table_turnover_rate') || 'Turnover'}:</span> {report.turnoverRate.toFixed(1)}%</div>
                    <div><span className="font-medium">{t('admin.inventory_reports_table_days_of_stock') || 'Days'}:</span> {report.daysOfStock < 999 ? report.daysOfStock.toFixed(0) : (t('common.not_applicable') || 'N/A')}</div>
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

export default InventoryReportsPage;

