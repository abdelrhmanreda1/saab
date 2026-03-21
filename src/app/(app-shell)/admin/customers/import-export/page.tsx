'use client';

import React, { useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { exportCustomersToCSV, importCustomersFromCSV } from '@/lib/firestore/customer_management_db';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

const CustomerImportExportPage = () => {
  const [, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const router = useRouter();
  const auth = getAuth(app);
  const { t } = useLanguage();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportCustomersToCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Error exporting
      alert(t('admin.customers_export_failed'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importCustomersFromCSV(text);
      setImportResult(result);
      if (result.errors.length > 0) {
        alert(
          t('admin.customers_import_partial', {
            success: result.success.toString(),
            errors: result.errors.length.toString(),
          })
        );
      } else {
        alert(
          t('admin.customers_import_success', {
            count: result.success.toString(),
          })
        );
      }
      } catch {
      // Error importing
      alert(t('admin.customers_import_failed'));
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset input
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
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <Link
          href="/admin/customers"
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.customers_import_export_back_to_customers')}
        </Link>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
          {t('admin.customers_import_export_title')}
        </h1>
        <p className="text-gray-500 text-sm">{t('admin.customers_import_export_subtitle') || 'Import and export customer data'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Export */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">
            {t('admin.customers_export_title')}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            {t('admin.customers_export_description')}
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-gray-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-70"
          >
            {exporting
              ? t('admin.customers_exporting')
              : t('admin.customers_export_button')}
          </button>
        </div>

        {/* Import */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">
            {t('admin.customers_import_title')}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            {t('admin.customers_import_description')}
          </p>
          <label className="block">
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
            <div className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:border-gray-400 transition-colors">
              {importing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-900"></div>
                  <span className="text-sm">{t('admin.customers_importing')}</span>
                </div>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700">
                    {t('admin.customers_import_click_to_upload')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.customers_import_drag_drop')}
                  </p>
                </>
              )}
            </div>
          </label>
        </div>
      </div>

      {importResult && (
        <div className="mt-4 sm:mt-6 bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">
            {t('admin.customers_import_results_title')}
          </h3>
          <div className="space-y-2">
            <p className="text-green-600 font-medium text-sm">
              {t('admin.customers_import_results_success', {
                count: importResult.success.toString(),
              })}
            </p>
            {importResult.errors.length > 0 && (
              <div>
                <p className="text-red-600 font-medium mb-2 text-sm">
                  {t('admin.customers_import_results_errors_title', {
                    count: importResult.errors.length.toString(),
                  })}
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-gray-600 space-y-1">
                  {importResult.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="mt-4 sm:mt-6 bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">
          {t('admin.customers_csv_format_title')}
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 mb-2">
          {t('admin.customers_csv_format_description')}
        </p>
        <code className="block bg-white p-3 rounded border border-gray-300 text-xs font-mono overflow-x-auto">
          {t('admin.customers_csv_format_example')}
        </code>
      </div>
    </div>
  );
};

export default CustomerImportExportPage;

