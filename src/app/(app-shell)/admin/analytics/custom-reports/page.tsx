'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getAllCustomReportTemplates, deleteCustomReportTemplate } from '@/lib/firestore/analytics_db';
import { CustomReportTemplate } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

const CustomReportsPage = () => {
  const { t } = useLanguage();
  const [, setUser] = useState<User | null>(null);
  const [templates, setTemplates] = useState<CustomReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const data = await getAllCustomReportTemplates();
          setTemplates(data);
        } catch {
          // Error fetching templates
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.delete_template_confirm'))) return;
    try {
      await deleteCustomReportTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
    } catch {
      // Error deleting template
      alert(t('admin.delete_failed'));
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
            {t('admin.custom_reports_title')}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.custom_reports_subtitle') || 'Create and manage custom report templates'}</p>
        </div>
        <Link
          href="/admin/analytics/custom-reports/new"
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-sm text-center"
        >
          {t('admin.create_report_template')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {templates.length === 0 ? (
          <div className="col-span-full text-center py-8 sm:py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-base sm:text-lg text-gray-500 mb-4">{t('admin.no_custom_reports')}</p>
            <Link
              href="/admin/analytics/custom-reports/new"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {t('admin.create_first_template')}
            </Link>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900">{template.name}</h3>
              {template.description && (
                <p className="text-xs sm:text-sm text-gray-500 mb-4 line-clamp-2">{template.description}</p>
              )}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t('admin.type')}:</span>
                  <span className="text-xs font-medium capitalize">{template.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t('admin.format')}:</span>
                  <span className="text-xs font-medium capitalize">{template.format}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t('admin.metrics') || 'Metrics'}:</span>
                  <span className="text-xs font-medium">{t('admin.custom_reports_metrics_count', { count: template.metrics.length.toString() }) || `${template.metrics.length} metrics`}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/admin/analytics/custom-reports/${template.id}`}
                  className="flex-1 text-center px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  {t('admin.view')}
                </Link>
                <Link
                  href={`/admin/analytics/custom-reports/edit/${template.id}`}
                  className="flex-1 text-center px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('admin.edit')}
                </Link>
                <button
                  onClick={() => template.id && handleDelete(template.id)}
                  className="px-3 sm:px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                >
                  {t('admin.delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomReportsPage;

