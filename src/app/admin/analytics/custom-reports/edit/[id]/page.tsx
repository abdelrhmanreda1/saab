'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCustomReportTemplate, updateCustomReportTemplate } from '@/lib/firestore/analytics_db';
import { CustomReportTemplate } from '@/lib/firestore/analytics';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';

const EditCustomReportPage = () => {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'sales' as CustomReportTemplate['type'],
    format: 'table' as 'table' | 'chart' | 'both',
    chartType: 'line' as 'line' | 'bar' | 'pie' | 'area',
    dateRange: {
      start: new Date(),
      end: new Date(),
    },
    categories: [] as string[],
    brands: [] as string[],
    products: [] as string[],
    orderStatus: [] as string[],
    metrics: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const template = await getCustomReportTemplate(id);

        if (!template) {
          alert(t('admin.custom_reports_error_template_not_found') || 'Template not found');
          router.push('/admin/analytics/custom-reports');
          return;
        }

        setFormData({
          name: template.name,
          description: template.description || '',
          type: template.type,
          format: template.format,
          chartType: template.chartType || 'line',
          dateRange: {
            start: template.filters.dateRange?.start?.toDate() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: template.filters.dateRange?.end?.toDate() || new Date(),
          },
          categories: template.filters.categories || [],
          brands: template.filters.brands || [],
          products: template.filters.products || [],
          orderStatus: template.filters.orderStatus || [],
          metrics: template.metrics,
        });
      } catch {
        // Error loading template
        alert(t('admin.custom_reports_error_load_failed') || 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id, router, t]);

  const availableMetrics = {
    sales: ['revenue', 'orders', 'averageOrderValue', 'conversionRate', 'refunds'],
    products: ['views', 'clicks', 'addToCart', 'purchases', 'revenue', 'conversionRate', 'rating', 'reviewCount'],
    customers: ['totalCustomers', 'newCustomers', 'returnCustomers', 'averageSpend', 'lifetimeValue'],
    inventory: ['currentStock', 'unitsSold', 'unitsReceived', 'unitsAdjusted', 'turnoverRate', 'stockValue'],
    financial: ['revenue', 'costs', 'profit', 'margin', 'taxes'],
    marketing: ['impressions', 'clicks', 'conversions', 'revenue', 'roi', 'ctr'],
    custom: ['revenue', 'orders', 'customers', 'products'],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Partial<Omit<CustomReportTemplate, 'id' | 'createdAt'>> = {
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
      };

      await updateCustomReportTemplate(id, updates);
      router.push('/admin/analytics/custom-reports');
    } catch {
      // Error updating template
      alert(t('admin.custom_reports_error_update_failed') || 'Failed to update template.');
    } finally {
      setSaving(false);
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">{t('admin.custom_reports_edit_title') || 'Edit Custom Report Template'}</h1>
        <p className="text-gray-500 text-sm">{t('admin.custom_reports_edit_subtitle') || 'Update your custom report template'}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Same form fields as new page */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_name') || 'Report Name'} *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_description') || 'Description'}</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.custom_reports_field_type') || 'Report Type'} *</label>
          <select
            value={formData.type}
            onChange={(e) => {
              setFormData({ 
                ...formData, 
                type: e.target.value as CustomReportTemplate['type'],
                metrics: [],
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
        </div>

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
            disabled={saving || !formData.name || formData.metrics.length === 0}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (t('admin.custom_reports_button_saving') || 'Saving...') : (t('admin.custom_reports_button_save') || 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCustomReportPage;

