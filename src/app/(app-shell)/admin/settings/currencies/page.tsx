'use client';

import React, { useState, useEffect } from 'react';
import {
  getAllCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
} from '@/lib/firestore/internationalization_db';
import { Currency } from '@/lib/firestore/internationalization';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const CurrenciesPage = () => {
  const { t } = useLanguage();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
    symbolPosition: 'left' as 'left' | 'right',
    decimalPlaces: 2,
    isActive: true,
    isDefault: false,
  });

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    try {
      const currenciesData = await getAllCurrencies();
      setCurrencies(currenciesData);
      const defaultCurrencyData = currenciesData.find((c) => c.isDefault) || null;
      setDefaultCurrency(defaultCurrencyData);
    } catch {
      // Failed to fetch currencies
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      // If setting as default currency, unset other default currencies
      if (formData.isDefault) {
        const otherDefaultCurrencies = currencies.filter(
          (c) => c.isDefault && c.id !== editingCurrency?.id
        );
        for (const currency of otherDefaultCurrencies) {
          await updateCurrency(currency.id!, { isDefault: false });
        }
      }

      if (editingCurrency) {
        await updateCurrency(editingCurrency.id!, formData);
      } else {
        await createCurrency(formData);
      }
      setShowForm(false);
      setEditingCurrency(null);
      resetForm();
      fetchData();
      setInfoDialogMessage(editingCurrency ? (t('admin.currencies_update_success') || 'Currency updated successfully!') : (t('admin.currencies_create_success') || 'Currency created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save currency
      setInfoDialogMessage(t('admin.currencies_save_failed') || 'Failed to save currency');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleEdit = (currency: Currency) => {
    setEditingCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      symbolPosition: currency.symbolPosition,
      decimalPlaces: currency.decimalPlaces,
      isActive: currency.isActive,
      isDefault: currency.isDefault || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (currency: Currency) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    if (!currency.id) {
      setInfoDialogMessage(t('admin.currencies_delete_id_missing') || 'Currency ID is missing');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    if (currency.isDefault) {
      setInfoDialogMessage(
        t('admin.currencies_delete_default_forbidden') ||
          'Cannot delete default currency. Please set another currency as default first.'
      );
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    setConfirmDialogMessage(
      t('admin.currencies_delete_confirm', {
        code: currency.code,
        name: currency.name,
      }) || `Are you sure you want to delete ${currency.code} (${currency.name})?`
    );
    setConfirmDialogAction(() => async () => {
      try {
        await deleteCurrency(currency.id!);
        fetchData();
        setInfoDialogMessage(t('admin.currencies_delete_success') || 'Currency deleted successfully');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch (error) {
        // Failed to delete currency
        setInfoDialogMessage(
          `${t('admin.currencies_delete_failed_prefix') || 'Failed to delete currency:'} ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      symbol: '',
      symbolPosition: 'left',
      decimalPlaces: 2,
      isActive: true,
      isDefault: false,
    });
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.currencies_title') || 'Currencies'}
          </h1>
          <p className="text-gray-500 text-sm">
            {t('admin.currencies_subtitle') || 'Manage currencies for your store'}
          </p>
          {defaultCurrency && (
            <p className="text-sm text-gray-600 mt-1">
              {t('admin.currencies_default_prefix') || 'Default Currency:'}{' '}
              <strong>
                {defaultCurrency.code} ({defaultCurrency.symbol})
              </strong>
            </p>
          )}
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCurrency(null);
            setShowForm(true);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          {t('admin.currencies_new_button') || '+ New Currency'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">
            {editingCurrency
              ? t('admin.currencies_form_title_edit') || 'Edit Currency'
              : t('admin.currencies_form_title_create') || 'Create Currency'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.currencies_field_code_label') || 'Currency Code'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.currencies_field_code_placeholder') ||
                    'e.g., USD, EUR'
                  }
                  required
                  maxLength={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.currencies_field_name_label') || 'Currency Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.currencies_field_name_placeholder') ||
                    'e.g., Pakistani Rupee'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.currencies_field_symbol_label') || 'Symbol'}
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData({ ...formData, symbol: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.currencies_field_symbol_placeholder') || 'e.g., Rs, $, €'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.currencies_field_symbol_position_label') ||
                    'Symbol Position'}
                </label>
                <select
                  value={formData.symbolPosition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      symbolPosition: e.target.value as 'left' | 'right',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="left">
                    {t('admin.currencies_field_symbol_position_left') || 'Left'}
                  </option>
                  <option value="right">
                    {t('admin.currencies_field_symbol_position_right') || 'Right'}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.currencies_field_decimal_places_label') ||
                    'Decimal Places'}
                </label>
                <input
                  type="number"
                  value={formData.decimalPlaces}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      decimalPlaces: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  min="0"
                  max="4"
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.currencies_field_set_default_label') ||
                    'Set as Default Currency'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.currencies_field_active_label') || 'Active'}
                </span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                {editingCurrency
                  ? t('admin.currencies_save_button_update') || 'Update Currency'
                  : t('admin.currencies_save_button_create') || 'Create Currency'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingCurrency(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.currencies_cancel_button') ||
                  t('common.cancel') ||
                  'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {currencies.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">
              {t('admin.currencies_empty_title') || 'No currencies found.'}
            </p>
            <p className="text-sm text-gray-400">
              {t('admin.currencies_empty_message') || 'Get started by adding your first currency'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.currencies_table_code') || 'Code'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.currencies_table_name') || 'Name'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.currencies_table_symbol') || 'Symbol'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.currencies_table_default') || 'Default'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.currencies_table_status') || 'Status'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">
                      {t('admin.currencies_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currencies.map((currency) => (
                    <tr key={currency.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{currency.code}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{currency.name}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{currency.symbol}</td>
                      <td className="px-4 sm:px-6 py-4">
                        {currency.isDefault && (
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-50 text-yellow-700">
                            {t('admin.currencies_badge_default') || 'Default'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          currency.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {currency.isActive ? t('admin.currencies_status_active') || 'Active' : t('admin.currencies_status_inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(currency)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(currency)}
                          className={`text-sm font-medium ${
                            currency.isDefault
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:text-red-800'
                          }`}
                          disabled={currency.isDefault || !currency.id}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {currencies.map((currency) => (
                <div key={currency.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{currency.name}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>Code: {currency.code}</p>
                        <p>Symbol: {currency.symbol}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {currency.isDefault && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-50 text-yellow-700">
                        {t('admin.currencies_badge_default') || 'Default'}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      currency.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {currency.isActive ? t('admin.currencies_status_active') || 'Active' : t('admin.currencies_status_inactive') || 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(currency)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(currency)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currency.isDefault
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                      disabled={currency.isDefault || !currency.id}
                    >
                      Delete
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

export default CurrenciesPage;

