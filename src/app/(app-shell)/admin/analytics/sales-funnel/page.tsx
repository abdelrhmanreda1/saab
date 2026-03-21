'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getSalesFunnel } from '@/lib/firestore/analytics_db';
import { SalesFunnelStage } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/context/LanguageContext';

const SalesFunnelPage = () => {
  const { t } = useLanguage();
  const [funnel, setFunnel] = useState<SalesFunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await fetchFunnel();
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, router, dateRange]);

  const fetchFunnel = async () => {
    try {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(dateRange));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const funnelData = await getSalesFunnel(start, end);
      setFunnel(funnelData);
    } catch {
      // Error fetching funnel
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.sales_funnel_analysis') || t('admin.sales_funnel') || 'Sales Funnel Analysis'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.sales_funnel_subtitle') || 'Track customer journey through sales stages'}</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
        >
          <option value="7">{t('admin.sales_funnel_date_7_days') || 'Last 7 Days'}</option>
          <option value="30">{t('admin.sales_funnel_date_30_days') || 'Last 30 Days'}</option>
          <option value="90">{t('admin.sales_funnel_date_3_months') || 'Last 3 Months'}</option>
          <option value="365">{t('admin.sales_funnel_date_year') || 'Last Year'}</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">{t('admin.sales_funnel_overview') || 'Funnel Overview'}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={funnel}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" name="Count" />
            <Bar dataKey="percentage" fill="#82ca9d" name="Percentage (%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {funnel.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.sales_funnel_empty') || 'No funnel data available'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.sales_funnel_table_stage') || 'Stage'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.sales_funnel_table_count') || 'Count'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.sales_funnel_table_percentage') || 'Percentage'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.sales_funnel_table_dropoff') || 'Drop-off Rate'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {funnel.map((stage) => (
                    <tr key={stage.stage} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <span className="font-medium text-sm text-gray-900 capitalize">{stage.stage}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{stage.count.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${stage.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm font-medium">{stage.percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        {stage.dropoffRate !== undefined ? (
                          <span className="text-red-600 font-medium text-sm">{stage.dropoffRate.toFixed(1)}%</span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {funnel.map((stage) => (
                <div key={stage.stage} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 capitalize mb-2">{stage.stage}</h3>
                      <p className="text-xs text-gray-600 mb-2">{t('admin.sales_funnel_table_count') || 'Count'}: {stage.count.toLocaleString()}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${stage.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{stage.percentage.toFixed(1)}%</span>
                      </div>
                      {stage.dropoffRate !== undefined && (
                        <p className="text-xs text-red-600 font-medium">{t('admin.sales_funnel_table_dropoff') || 'Drop-off'}: {stage.dropoffRate.toFixed(1)}%</p>
                      )}
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

export default SalesFunnelPage;

