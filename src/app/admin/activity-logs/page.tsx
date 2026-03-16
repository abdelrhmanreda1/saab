'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useLanguage } from '@/context/LanguageContext';
import { getAllActivityLogs } from '@/lib/firestore/user_management_db';
import { ActivityLog } from '@/lib/firestore/user_management';
import { useRouter } from 'next/navigation';

const ActivityLogsPage = () => {
  const [, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    resource?: string;
    action?: string;
    limit?: number;
  }>({ limit: 100 });
  const router = useRouter();
  const auth = getAuth(app);
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const fetchedLogs = await getAllActivityLogs(filters);
          setLogs(fetchedLogs);
        } catch {
          // Error fetching activity logs
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, filters]);

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800';
    if (action.includes('updated')) return 'bg-blue-100 text-blue-800';
    if (action.includes('deleted')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">{t('admin.activity_logs_title')}</h1>
        <p className="text-gray-500 text-sm">{t('admin.activity_logs_subtitle') || 'View system activity and user actions'}</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('admin.resource')}</label>
            <select
              value={filters.resource || ''}
              onChange={(e) => setFilters({ ...filters, resource: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">{t('admin.all_resources')}</option>
              <option value="products">{t('admin.products')}</option>
              <option value="orders">{t('admin.orders')}</option>
              <option value="customers">{t('admin.customers')}</option>
              <option value="staff">{t('admin.staff')}</option>
              <option value="settings">{t('admin.settings')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('admin.action')}</label>
            <select
              value={filters.action || ''}
              onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">{t('admin.all_actions')}</option>
              <option value="created">{t('admin.created')}</option>
              <option value="updated">{t('admin.updated')}</option>
              <option value="deleted">{t('admin.deleted')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('admin.limit')}</label>
            <select
              value={filters.limit || 100}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.no_activity_logs')}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.user')}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.action')}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.resource')}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.resource_id')}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="font-medium text-sm text-gray-900">{log.userName}</div>
                        <div className="text-xs text-gray-500">{log.userId.slice(0, 8)}...</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{log.resource}</td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600 font-mono">
                        {log.resourceId ? log.resourceId.slice(0, 8) + '...' : '-'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600">
                        {new Date(log.createdAt.seconds * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 mb-1">{log.userName}</div>
                      <div className="text-xs text-gray-500 mb-2">{log.userId.slice(0, 8)}...</div>
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                    <p><span className="font-medium">Resource:</span> {log.resource}</p>
                    <p><span className="font-medium">ID:</span> {log.resourceId ? log.resourceId.slice(0, 8) + '...' : '-'}</p>
                    <p><span className="font-medium">Time:</span> {new Date(log.createdAt.seconds * 1000).toLocaleString()}</p>
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

export default ActivityLogsPage;

