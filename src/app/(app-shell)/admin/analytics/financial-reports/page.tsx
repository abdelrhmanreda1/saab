'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getFinancialReport } from '@/lib/firestore/analytics_db';
import { FinancialReport } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const FinancialReportsPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await fetchReport();
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, router, dateRange]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(dateRange));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const data = await getFinancialReport(start, end);
      setReport(data);
    } catch {
      // Error fetching financial report
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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

  if (!report) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        <div className="text-center text-gray-500 p-8">{t('admin.financial_reports_empty') || 'No financial data available.'}</div>
      </div>
    );
  }

  const costData = [
    { name: 'Product Cost', value: report.costs.productCost },
    { name: 'Shipping', value: report.costs.shipping },
    { name: 'Marketing', value: report.costs.marketing },
    { name: 'Operational', value: report.costs.operational },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.financial_reports') || 'Financial Reports'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.financial_reports_subtitle') || 'View revenue, costs, and profit analysis'}</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">{t('admin.financial_reports_total_revenue') || 'Total Revenue'}</h3>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatPrice(report.revenue.total)}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">{t('admin.financial_reports_total_costs') || 'Total Costs'}</h3>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{formatPrice(report.costs.total)}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">{t('admin.financial_reports_net_profit') || 'Net Profit'}</h3>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{formatPrice(report.profit.net)}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">{t('admin.financial_reports_profit_margin') || 'Profit Margin'}</h3>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{report.profit.margin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Revenue Breakdown */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">{t('admin.financial_reports_revenue_breakdown') || 'Revenue Breakdown'}</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('admin.financial_reports_product_sales') || 'Product Sales'}</span>
              <span className="font-medium">{formatPrice(report.revenue.productSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('admin.financial_reports_shipping') || 'Shipping'}</span>
              <span className="font-medium">{formatPrice(report.revenue.shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('admin.financial_reports_taxes') || 'Taxes'}</span>
              <span className="font-medium">{formatPrice(report.revenue.taxes)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-900">{t('admin.financial_reports_total') || 'Total'}</span>
              <span className="font-bold text-gray-900">{formatPrice(report.revenue.total)}</span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">{t('admin.financial_reports_cost_breakdown') || 'Cost Breakdown'}</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={costData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {costData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders Summary */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">{t('admin.financial_reports_orders_summary') || 'Orders Summary'}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">{t('admin.financial_reports_total_orders') || 'Total Orders'}</p>
            <p className="text-2xl font-bold">{report.orders.total}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('admin.financial_reports_completed') || 'Completed'}</p>
            <p className="text-2xl font-bold text-green-600">{report.orders.completed}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('admin.financial_reports_cancelled') || 'Cancelled'}</p>
            <p className="text-2xl font-bold text-red-600">{report.orders.cancelled}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('admin.financial_reports_refunded') || 'Refunded'}</p>
            <p className="text-2xl font-bold text-orange-600">{report.orders.refunded}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReportsPage;

