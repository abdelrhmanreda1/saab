'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { addCustomReportTemplate } from '@/lib/firestore/analytics_db';
import { CustomReportTemplate } from '@/lib/firestore/analytics';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';

const NewCustomReportPage = () => {
  const { t } = useLanguage();
  const router = useRouter();
  const auth = getAuth(app);
  const user = auth.currentUser;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'sales' as CustomReportTemplate['type'],
    format: 'table' as 'table' | 'chart' | 'both',
    chartType: 'line' as 'line' | 'bar' | 'pie' | 'area',
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(),
    },
    categories: [] as string[],
    brands: [] as string[],
    products: [] as string[],
    orderStatus: [] as string[],
    metrics: [] as string[],
  });

  const [loading, setLoading] = useState(false);

  // Note: Category/brand/product filters can be added here in future if needed.

  const availableMetrics = {
    sales: ['revenue', 'orders', 'averageOrderValue', 'conversionRate', 'refunds'],
    products: ['views', 'clicks', 'addToCart', 'purchases', 'revenue', 'conversionRate', 'rating', 'reviewCount'],
    customers: ['totalCustomers', 'newCustomers', 'returnCustomers', 'averageSpend', 'lifetimeValue'],
    inventory: ['currentStock', 'unitsSold', 'unitsReceived', 'unitsAdjusted', 'turnoverRate', 'stockValue'],
    financial: ['revenue', 'costs', 'profit', 'margin', 'taxes'],
    marketing: ['impressions', 'clicks', 'conversions', 'revenue', 'roi', 'ctr'],
    custom: ['revenue', 'orders', 'customers', 'products'],
  };

  const categories: { id?: string; name: string }[] = [];
  const brands: { id?: string; name: string }[] = [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert(t('admin.custom_reports_error_login_required') || 'You must be logged in to create a report template.');
      return;
    }

    setLoading(true);
    try {
      const template: Omit<CustomReportTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        filters: {
          dateRange: {
            start: Timestamp.fromDate(formData.dateRange.start),
            end: Timestamp.fromDate(formData.dateRange.end),
          },
          ...(formData.categories.length > 0 && { categories: formData.categories }),
          ...(formData.brands.length > 0 && { brands: formData.brands }),
          ...(formData.products.length > 0 && { products: formData.products }),
          ...(formData.orderStatus.length > 0 && { orderStatus: formData.orderStatus }),
        },
        metrics: formData.metrics,
        format: formData.format,
        ...(formData.format !== 'table' && { chartType: formData.chartType }),
        createdBy: user.uid,
      };

      await addCustomReportTemplate(template);
      router.push('/admin/analytics/custom-reports');
    } catch {
      // Error creating template
      alert(t('admin.custom_reports_error_create_failed') || 'Failed to create report template.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">{t('admin.custom_reports_create_title') || 'Create Custom Report Template'}</h1>
        <p className="text-gray-500 text-sm">{t('admin.custom_reports_create_subtitle') || 'Build a custom report with your preferred filters and metrics'}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_name') || 'Report Name'} *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            placeholder={t('admin.custom_reports_placeholder_name') || 'e.g., Monthly Sales Report'}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_description') || 'Description'}</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            rows={3}
            placeholder={t('admin.custom_reports_placeholder_description') || 'Optional description for this report'}
          />
        </div>

        {/* Report Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_type') || 'Report Type'} *</label>
          <select
            value={formData.type}
            onChange={(e) => {
              setFormData({ 
                ...formData, 
                type: e.target.value as CustomReportTemplate['type'],
                metrics: [], // Reset metrics when type changes
              });
            }}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          >
            <option value="sales">{t('admin.custom_reports_option_type_sales') || 'Sales'}</option>
            <option value="products">{t('admin.custom_reports_option_type_products') || 'Products'}</option>
            <option value="customers">{t('admin.custom_reports_option_type_customers') || 'Customers'}</option>
            <option value="inventory">{t('admin.custom_reports_option_type_inventory') || 'Inventory'}</option>
            <option value="financial">{t('admin.custom_reports_option_type_financial') || 'Financial'}</option>
            <option value="marketing">{t('admin.custom_reports_option_type_marketing') || 'Marketing'}</option>
            <option value="custom">{t('admin.custom_reports_option_type_custom') || 'Custom'}</option>
          </select>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_format') || 'Format'} *</label>
          <select
            value={formData.format}
            onChange={(e) => setFormData({ ...formData, format: e.target.value as 'table' | 'chart' | 'both' })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          >
            <option value="table">{t('admin.custom_reports_option_format_table') || 'Table Only'}</option>
            <option value="chart">{t('admin.custom_reports_option_format_chart') || 'Chart Only'}</option>
            <option value="both">{t('admin.custom_reports_option_format_both') || 'Table + Chart'}</option>
          </select>
        </div>

        {formData.format !== 'table' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_chart_type') || 'Chart Type'} *</label>
            <select
              value={formData.chartType}
              onChange={(e) => setFormData({ ...formData, chartType: e.target.value as 'line' | 'bar' | 'pie' | 'area' })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            >
              <option value="line">{t('admin.custom_reports_option_chart_line') || 'Line Chart'}</option>
              <option value="bar">{t('admin.custom_reports_option_chart_bar') || 'Bar Chart'}</option>
              <option value="pie">{t('admin.custom_reports_option_chart_pie') || 'Pie Chart'}</option>
              <option value="area">{t('admin.custom_reports_option_chart_area') || 'Area Chart'}</option>
            </select>
          </div>
        )}

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_start_date') || 'Start Date'} *</label>
            <input
              type="date"
              value={formData.dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => setFormData({
                ...formData,
                dateRange: { ...formData.dateRange, start: new Date(e.target.value) },
              })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_end_date') || 'End Date'} *</label>
            <input
              type="date"
              value={formData.dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => setFormData({
                ...formData,
                dateRange: { ...formData.dateRange, end: new Date(e.target.value) },
              })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Metrics */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_metrics') || 'Metrics'} *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
            {availableMetrics[formData.type].map((metric) => (
              <label key={metric} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.metrics.includes(metric)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, metrics: [...formData.metrics, metric] });
                    } else {
                      setFormData({ ...formData, metrics: formData.metrics.filter(m => m !== metric) });
                    }
                  }}
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm text-gray-700 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
              </label>
            ))}
          </div>
          {formData.metrics.length === 0 && (
            <p className="text-sm text-red-600 mt-1">{t('admin.custom_reports_error_no_metrics') || 'Please select at least one metric'}</p>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('admin.custom_reports_field_filters') || 'Filters (Optional)'}</h3>

          {/* Categories */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_categories') || 'Categories'}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border border-gray-300 rounded-lg p-4 max-h-40 overflow-y-auto">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.categories.includes(cat.id || '')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, categories: [...formData.categories, cat.id || ''] });
                      } else {
                        setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat.id) });
                      }
                    }}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <span className="text-sm text-gray-700">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Brands */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_brands') || 'Brands'}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border border-gray-300 rounded-lg p-4 max-h-40 overflow-y-auto">
              {brands.map((brand) => (
                <label key={brand.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.brands.includes(brand.id || '')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, brands: [...formData.brands, brand.id || ''] });
                      } else {
                        setFormData({ ...formData, brands: formData.brands.filter(b => b !== brand.id) });
                      }
                    }}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <span className="text-sm text-gray-700">{brand.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Order Status (for sales reports) */}
          {formData.type === 'sales' && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_order_status') || 'Order Status'}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border border-gray-300 rounded-lg p-4">
                {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map((status) => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.orderStatus.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, orderStatus: [...formData.orderStatus, status] });
                        } else {
                          setFormData({ ...formData, orderStatus: formData.orderStatus.filter(s => s !== status) });
                        }
                      }}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <span className="text-sm text-gray-700 capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('admin.custom_reports_button_cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name || formData.metrics.length === 0}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (t('admin.custom_reports_button_creating') || 'Creating...') : (t('admin.custom_reports_button_create') || 'Create Template')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewCustomReportPage;

