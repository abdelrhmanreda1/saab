'use client';

import React, { useState, useEffect } from 'react';
import { getSalesReport, SalesReport } from '@/lib/firestore/reports_db';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const ReportsPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [reportData, setReportData] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // '7', '30', '90'

  const fetchReport = React.useCallback(async () => {
    setLoading(true);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - parseInt(dateRange));
    
    // Set start to beginning of day, end to end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const data = await getSalesReport(start, end);
    setReportData(data);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReport();
  }, [fetchReport]);

  const totalRevenue = reportData.reduce((sum, item) => sum + item.totalSales, 0);
  const totalOrders = reportData.reduce((sum, item) => sum + item.totalOrders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.reports_title') || 'Sales Reports'}</h1>
        </div>
        
        <select 
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
        >
          <option value="7">{t('admin.last_7_days') || 'Last 7 Days'}</option>
          <option value="30">{t('admin.last_30_days') || 'Last 30 Days'}</option>
          <option value="90">{t('admin.last_3_months') || 'Last 3 Months'}</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500">{t('admin.reports_summary_total_revenue') || 'Total Revenue'}</h3>
          <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-2">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500">{t('admin.reports_summary_total_orders') || 'Total Orders'}</h3>
          <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-2">{totalOrders}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500">{t('admin.reports_summary_avg_order_value') || 'Average Order Value'}</h3>
          <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-2">{formatPrice(avgOrderValue)}</p>
        </div>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="h-64 sm:h-96 flex items-center justify-center bg-white rounded-xl border border-gray-200 mb-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
              {t('admin.common.loading') || 'Loading...'}
            </div>
          </div>
        </div>
      ) : reportData.length === 0 ? (
        <div className="h-64 sm:h-96 flex items-center justify-center bg-white rounded-xl border border-gray-200 text-gray-500 mb-6 p-8">
          <p className="text-center">{t('admin.reports_empty') || 'No data available for the selected period.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Sales Trend */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">{t('admin.reports_chart_sales_trend') || 'Sales Trend'}</h3>
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    fontSize={12}
                    tickMargin={10}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value: number | undefined) => [formatPrice(value || 0), 'Sales']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="totalSales" stroke="#000000" strokeWidth={2} name={t('admin.reports_chart_sales') || 'Sales'} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Orders Trend */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">{t('admin.reports_chart_orders_trend') || 'Orders Trend'}</h3>
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    fontSize={12}
                    tickMargin={10}
                  />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip 
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Bar dataKey="totalOrders" fill="#000000" name={t('admin.reports_chart_orders') || 'Orders'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{t('admin.reports_table_daily_breakdown') || 'Daily Breakdown'}</h3>
        </div>
        {reportData.length === 0 && !loading ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-sm">{t('admin.reports_no_records') || 'No records found'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-600">{t('admin.reports_table_date') || 'Date'}</th>
                    <th className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-600 text-right">{t('admin.reports_table_orders') || 'Orders'}</th>
                    <th className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-600 text-right">{t('admin.reports_table_revenue') || 'Revenue'}</th>
                    <th className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-600 text-right">{t('admin.reports_table_avg_order_value') || 'Avg. Order Value'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.map((row) => (
                    <tr key={row.date} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">
                        {new Date(row.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 text-right">{row.totalOrders}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 text-right">{formatPrice(row.totalSales)}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 text-right">{formatPrice(row.averageOrderValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {reportData.map((row) => (
                <div key={row.date} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {new Date(row.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                      </h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-medium">{t('admin.reports_table_orders') || 'Orders'}:</span> {row.totalOrders}</p>
                        <p><span className="font-medium">{t('admin.reports_table_revenue') || 'Revenue'}:</span> {formatPrice(row.totalSales)}</p>
                        <p><span className="font-medium">{t('admin.reports_table_avg_order_value') || 'Avg. Order Value'}:</span> {formatPrice(row.averageOrderValue)}</p>
                      </div>
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

export default ReportsPage;
