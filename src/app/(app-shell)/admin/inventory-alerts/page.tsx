'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { InventoryAlert } from '@/lib/firestore/suppliers';
import { getAllInventoryAlerts, resolveAlert, deleteInventoryAlert } from '@/lib/firestore/inventory_alerts_db';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const InventoryAlertsPage = () => {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  const fetchAlerts = useCallback(async () => {
    try {
      const fetchedAlerts = await getAllInventoryAlerts(filter === 'resolved' ? true : filter === 'active' ? false : undefined);
      setAlerts(fetchedAlerts);
    } catch {
      // Failed to fetch alerts
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const data = await getSettings();
        if (data) {
          setSettings({ ...defaultSettings, ...data });
        }
      } catch {
        // Failed to fetch settings
      }
    };
    fetchSettingsData();
  }, []);

  const handleResolve = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await resolveAlert(id);
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === id ? { ...alert, isResolved: true, resolvedAt: Timestamp.now() } : alert)),
      );
      setInfoDialogMessage(t('admin.inventory_alerts_resolve_success') || 'Alert resolved successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to resolve alert
      setInfoDialogMessage(t('admin.inventory_alerts_resolve_failed') || 'Failed to resolve alert.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.inventory_alerts_delete_confirm') || 'Are you sure you want to delete this alert?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteInventoryAlert(id);
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        setInfoDialogMessage(t('admin.inventory_alerts_delete_success') || 'Alert deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete alert
        setInfoDialogMessage(t('admin.inventory_alerts_delete_failed') || 'Failed to delete alert.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
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

  const activeAlerts = alerts.filter(a => !a.isResolved);
  const lowStockCount = activeAlerts.filter(a => a.alertType === 'low').length;
  const outOfStockCount = activeAlerts.filter(a => a.alertType === 'out_of_stock').length;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.inventory_alerts_title') || 'Inventory Alerts'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.inventory_alerts_subtitle') || 'Monitor low stock and out of stock items'}
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'resolved')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
        >
          <option value="active">{t('admin.inventory_alerts_filter_active') || 'Active Alerts'}</option>
          <option value="resolved">{t('admin.inventory_alerts_filter_resolved') || 'Resolved'}</option>
          <option value="all">{t('admin.inventory_alerts_filter_all') || 'All Alerts'}</option>
        </select>
      </div>

      {filter === 'active' && activeAlerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-semibold">
                  {t('admin.inventory_alerts_low_stock_label') || 'Low Stock'}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-800">{lowStockCount}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-semibold">
                  {t('admin.inventory_alerts_out_of_stock_label') || 'Out of Stock'}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-red-800">{outOfStockCount}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10 text-red-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {alerts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
              />
            </svg>
            <p className="text-base sm:text-lg font-medium">
              {t('admin.inventory_alerts_empty_title') || 'No alerts found'}
            </p>
            <p className="text-sm mt-2 text-gray-400">
              {t('admin.inventory_alerts_empty_subtitle') || 'All products are well stocked'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_product') || 'Product'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_variant') || 'Variant'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_current_stock') || 'Current Stock'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_threshold') || 'Threshold'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_type') || 'Alert Type'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_date') || 'Date'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_alerts_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className={`hover:bg-gray-50 transition-colors ${alert.isResolved ? 'opacity-60' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{alert.productName}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {alert.variantName || t('common.not_applicable') || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${alert.currentStock === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {alert.currentStock}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{alert.threshold}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                          alert.alertType === 'out_of_stock' 
                            ? 'bg-red-50 text-red-700' 
                            : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {alert.alertType === 'out_of_stock'
                            ? t('admin.inventory_alerts_badge_out_of_stock') || 'Out of Stock'
                            : t('admin.inventory_alerts_badge_low_stock') || 'Low Stock'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(alert.createdAt.seconds * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${alert.productId}`}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            {t('admin.inventory_alerts_action_view_product') || 'View'}
                          </Link>
                          {!alert.isResolved && (
                            <button
                              onClick={() => handleResolve(alert.id!)}
                              className="text-green-600 hover:text-green-900 text-sm font-medium"
                            >
                              {t('admin.inventory_alerts_action_resolve') || 'Resolve'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(alert.id!)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            {t('common.delete') || 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 hover:bg-gray-50 transition-colors ${alert.isResolved ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{alert.productName}</h3>
                      <p className="text-xs text-gray-500">
                        {t('admin.inventory_alerts_table_variant') || 'Variant'}: {alert.variantName || t('common.not_applicable') || 'N/A'}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ml-3 ${
                      alert.alertType === 'out_of_stock' 
                        ? 'bg-red-50 text-red-700' 
                        : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {alert.alertType === 'out_of_stock'
                        ? t('admin.inventory_alerts_badge_out_of_stock') || 'Out of Stock'
                        : t('admin.inventory_alerts_badge_low_stock') || 'Low Stock'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                    <div>
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_alerts_current_stock_label') || 'Current Stock'}:
                      </span>
                      <span className={`ml-2 font-semibold ${alert.currentStock === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {alert.currentStock}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_alerts_threshold_label') || 'Threshold'}:
                      </span>
                      <span className="ml-2 text-gray-900 font-semibold">{alert.threshold}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 font-medium">
                        {t('admin.inventory_alerts_date_label') || 'Date'}:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {new Date(alert.createdAt.seconds * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Link
                      href={`/admin/products/${alert.productId}`}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors text-center"
                    >
                      {t('admin.inventory_alerts_action_view_product') || 'View Product'}
                    </Link>
                    {!alert.isResolved && (
                      <button
                        onClick={() => handleResolve(alert.id!)}
                        className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-md text-sm font-medium hover:bg-green-100 transition-colors"
                      >
                        {t('admin.inventory_alerts_action_resolve') || 'Resolve'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id!)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('common.delete') || 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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

      {/* Confirm Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title={t('common.confirm') || 'Confirm'}
        message={confirmDialogMessage}
        type="confirm"
        onConfirm={() => {
          if (confirmDialogAction) {
            confirmDialogAction();
          }
          setShowConfirmDialog(false);
        }}
        confirmText={t('common.confirm') || 'Confirm'}
        cancelText={t('common.cancel') || 'Cancel'}
      />
    </div>
  );
};

export default InventoryAlertsPage;

