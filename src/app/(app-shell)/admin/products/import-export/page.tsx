'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/lib/firestore/products';
import { getAllProducts, addProduct } from '@/lib/firestore/products_db';
import { generateSlug } from '@/lib/utils/slug';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const ImportExportPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      // Failed to fetch settings
    }
  };

  const handleExport = async () => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const products = await getAllProducts();
      
      // Convert products to CSV format
      const csvHeaders = ['Name', 'Description', 'Price', 'Category', 'Brand ID', 'Is Featured', 'Is Active', 'Variants'];
      const csvRows = products.map(product => {
        const variants = product.variants.map(v => `${v.name}:${v.value}:${v.stock}`).join(';');
        return [
          product.name,
          product.description.replace(/,/g, ';'),
          product.price,
          product.category,
          product.brandId || '',
          product.isFeatured ? (t('admin.common.yes') || 'Yes') : (t('admin.common.no') || 'No'),
          product.isActive ? (t('admin.common.yes') || 'Yes') : (t('admin.common.no') || 'No'),
          variants,
        ];
      });

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(
        t('admin.export_success', { count: products.length.toString() })
      );
    } catch {
      // Failed to export
      setError(t('admin.export_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      // Reset file input
      event.target.value = '';
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error(t('admin.import_file_min_rows_error'));
      }

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const dataRows = lines.slice(1);

      let imported = 0;
      let errors = 0;

      for (const row of dataRows) {
        try {
          const values = row.split(',').map(v => v.replace(/^"|"$/g, '').trim());
          
          if (values.length < headers.length) continue;

          const productName = values[0] || t('admin.import_untitled_product');
          const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
            name: productName,
            slug: generateSlug(productName),
            description: values[1] || '',
            price: parseFloat(values[2]) || 0,
            salePrice: values[8] ? parseFloat(values[8]) : undefined,
            discountType: values[9] ? (values[9] as 'percentage' | 'fixed') : undefined,
            discountValue: values[10] ? parseFloat(values[10]) : undefined,
            category: values[3] || '',
            brandId: values[4] || undefined,
            isFeatured: values[5]?.toLowerCase() === 'yes',
            isActive: values[6]?.toLowerCase() !== 'no',
            allowPreOrder: false,
            isBundle: false,
            images: [],
            variants: values[7] ? values[7].split(';').map(v => {
              const parts = v.split(':');
              const [name, value, stock, price, salePrice, priceAdjustment] = parts;
              return {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: name || 'Size',
                value: value || '',
                stock: parseInt(stock) || 0,
                price: price ? parseFloat(price) : undefined,
                salePrice: salePrice ? parseFloat(salePrice) : undefined,
                priceAdjustment: priceAdjustment ? parseFloat(priceAdjustment) : undefined,
              };
            }) : [],
            analytics: {
              views: 0,
              clicks: 0,
              addToCartCount: 0,
              purchases: 0,
              conversionRate: 0,
            },
          };

          await addProduct(productData);
          imported++;
        } catch {
          // Failed to import row
          errors++;
        }
      }

      if (imported > 0) {
        let message = t('admin.import_success', {
          count: imported.toString(),
        });
        if (errors > 0) {
          message += ` ${t('admin.import_partial_errors', {
            count: errors.toString(),
          })}`;
        }
        setSuccess(message);
        setTimeout(() => {
          router.push('/admin/products');
        }, 2000);
      } else {
        setError(t('admin.import_none_imported'));
      }
    } catch {
      // Failed to import
      setError(t('admin.import_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.import_export_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.import_export_subtitle')}
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/products')}
          className="text-gray-600 hover:text-gray-900 text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← {t('admin.back_to_products')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Export */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t('admin.export_products_title')}
              </h2>
              <p className="text-sm text-gray-500">
                {t('admin.export_products_subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? t('admin.exporting') : t('admin.export_to_csv')}
          </button>
        </div>

        {/* Import */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t('admin.import_products_title')}
              </h2>
              <p className="text-sm text-gray-500">
                {t('admin.import_products_subtitle')}
              </p>
            </div>
          </div>
          <label className="block w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-center font-medium">
            {loading ? t('admin.importing') : t('admin.choose_csv_file')}
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* CSV Format Guide */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mt-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {t('admin.csv_guide_title')}
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <strong>{t('admin.csv_required_columns')}</strong> {t('admin.csv_required_columns_list') || 'Name, Description, Price, Category, Brand ID, Is Featured, Is Active, Variants'}
          </p>
          <p>
            <strong>{t('admin.csv_variants_format')}</strong> {t('admin.csv_variants_format_example') || 'Size:Small:10;Color:Red:5 (separate multiple variants with semicolon)'}
          </p>
          <p>
            <strong>{t('admin.csv_example_row')}</strong>
          </p>
          <code className="block bg-white p-3 rounded border border-gray-200 text-xs">
            &quot;Abaya Classic&quot;,&quot;Elegant black abaya&quot;,5000,&quot;abayas&quot;,&quot;brand123&quot;,&quot;Yes&quot;,&quot;Yes&quot;,&quot;Size:Small:10;Size:Medium:15&quot;
          </code>
        </div>
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

export default ImportExportPage;

