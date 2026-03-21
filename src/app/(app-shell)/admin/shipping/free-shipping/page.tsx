'use client';

import React, { useState, useEffect } from 'react';
import { getAllFreeShippingRules, createFreeShippingRule, updateFreeShippingRule, deleteFreeShippingRule } from '@/lib/firestore/campaigns_db';
import { FreeShippingRule } from '@/lib/firestore/campaigns';
import { getAllShippingZones } from '@/lib/firestore/shipping_db';
import { ShippingZone } from '@/lib/firestore/shipping';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Timestamp } from 'firebase/firestore';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const FreeShippingPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice, defaultCurrency } = useCurrency();
  const [rules, setRules] = useState<FreeShippingRule[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<FreeShippingRule | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    threshold: 0,
    zoneIds: [] as string[],
    validFrom: '',
    validUntil: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    try {
      const [rulesData, zonesData] = await Promise.all([
        getAllFreeShippingRules(),
        getAllShippingZones(),
      ]);
      setRules(rulesData);
      setZones(zonesData);
    } catch {
      // Failed to fetch data
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    try {
      const ruleData: Omit<FreeShippingRule, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        threshold: formData.threshold,
        isActive: editingRule ? editingRule.isActive : true,
        createdBy: editingRule ? editingRule.createdBy : user.uid,
        ...(formData.description && formData.description.trim() !== '' && { description: formData.description }),
        ...(formData.zoneIds.length > 0 && { zoneIds: formData.zoneIds }),
        ...(formData.validFrom && { validFrom: Timestamp.fromDate(new Date(formData.validFrom)) }),
        ...(formData.validUntil && { validUntil: Timestamp.fromDate(new Date(formData.validUntil)) }),
      };

      if (editingRule) {
        await updateFreeShippingRule(editingRule.id!, ruleData);
      } else {
        await createFreeShippingRule(ruleData);
      }

      setShowForm(false);
      setEditingRule(null);
      resetForm();
      fetchData();
      setInfoDialogMessage(editingRule ? (t('admin.free_shipping_update_success') || 'Free shipping rule updated successfully!') : (t('admin.free_shipping_create_success') || 'Free shipping rule created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save rule
      setInfoDialogMessage(t('admin.free_shipping.save_failed') || 'Failed to save rule');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      threshold: 0,
      zoneIds: [],
      validFrom: '',
      validUntil: '',
    });
  };

  const handleDelete = async (id: string) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.free_shipping_delete_confirm') || 'Are you sure you want to delete this rule?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteFreeShippingRule(id);
        fetchData();
        setInfoDialogMessage(t('admin.free_shipping_delete_success') || 'Free shipping rule deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete rule
        setInfoDialogMessage(t('admin.free_shipping_delete_failed') || 'Failed to delete rule');
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

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.free_shipping_rules') || 'Free Shipping Rules'}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.free_shipping_subtitle') || 'Create dynamic free shipping thresholds'}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingRule(null);
            resetForm();
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.free_shipping_add_new') || 'New Rule'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">{editingRule ? (t('admin.free_shipping_edit') || 'Edit Rule') : (t('admin.free_shipping_add_new') || 'New Free Shipping Rule')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.free_shipping_name_label') || 'Rule Name'}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.free_shipping_description_label') || 'Description'}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.free_shipping_threshold_label') || 'Minimum Order Amount'}{defaultCurrency?.symbol ? ` (${defaultCurrency.symbol})` : ''}</label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.free_shipping_zones_label') || 'Shipping Zones (Optional - Leave empty for all zones)'}</label>
              <select
                multiple
                value={formData.zoneIds}
                onChange={(e) => setFormData({ ...formData, zoneIds: Array.from(e.target.selectedOptions, option => option.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none h-32"
              >
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">{t('admin.free_shipping_zones_hint') || 'Hold Ctrl/Cmd to select multiple zones'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.free_shipping_valid_from_label') || 'Valid From (Optional)'}</label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.free_shipping_valid_until_label') || 'Valid Until (Optional)'}</label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                {editingRule ? (t('admin.common.update') || 'Update') : (t('admin.common.add') || 'Create')} {t('admin.free_shipping_rule') || 'Rule'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRule(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.common.cancel') || 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-base sm:text-lg font-medium text-gray-900 mb-1">{t('admin.free_shipping_empty') || 'No free shipping rules found'}</p>
            <p className="text-sm text-gray-400">{t('admin.free_shipping_empty_message') || 'Create your first free shipping rule to get started.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.free_shipping_table_name') || 'Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.free_shipping_table_threshold') || 'Threshold'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.free_shipping_table_zones') || 'Zones'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.free_shipping_table_valid_period') || 'Valid Period'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.free_shipping_table_status') || 'Status'}</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.free_shipping_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rule.name}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatPrice(rule.threshold)}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {rule.zoneIds && rule.zoneIds.length > 0 ? t('admin.free_shipping_zones_count', { count: rule.zoneIds.length.toString() }) || `${rule.zoneIds.length} zones` : (t('admin.free_shipping_all_zones') || 'All zones')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {rule.validFrom?.toDate ? new Date(rule.validFrom.toDate()).toLocaleDateString() : (t('admin.free_shipping_always') || 'Always')} - {rule.validUntil?.toDate ? new Date(rule.validUntil.toDate()).toLocaleDateString() : (t('admin.free_shipping_always') || 'Always')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          rule.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {rule.isActive ? (t('admin.free_shipping_active') || 'Active') : (t('admin.free_shipping_inactive') || 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={async () => {
                              // Check if demo mode is enabled
                              if (settings.demoMode) {
                                setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                                setInfoDialogType('error');
                                setShowInfoDialog(true);
                                return;
                              }
                              try {
                                await updateFreeShippingRule(rule.id!, { isActive: !rule.isActive });
                                fetchData();
                                setInfoDialogMessage(t('admin.free_shipping_update_success') || 'Free shipping rule updated successfully!');
                                setInfoDialogType('success');
                                setShowInfoDialog(true);
                                } catch {
                                // Failed to update rule
                                setInfoDialogMessage(t('admin.free_shipping.update_failed') || 'Failed to update rule');
                                setInfoDialogType('error');
                                setShowInfoDialog(true);
                              }
                            }}
                            className="text-gray-600 hover:text-gray-800"
                            title={rule.isActive ? (t('admin.free_shipping_deactivate') || 'Deactivate') : (t('admin.free_shipping_activate') || 'Activate')}
                          >
                            {rule.isActive ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setFormData({
                                name: rule.name,
                                description: rule.description || '',
                                threshold: rule.threshold,
                                zoneIds: rule.zoneIds || [],
                                validFrom: rule.validFrom?.toDate ? new Date(rule.validFrom.toDate()).toISOString().split('T')[0] : '',
                                validUntil: rule.validUntil?.toDate ? new Date(rule.validUntil.toDate()).toISOString().split('T')[0] : '',
                              });
                              setShowForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('admin.common.edit') || 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id!)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            {t('admin.common.delete') || 'Delete'}
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
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{rule.name}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-medium">{t('admin.free_shipping_table_threshold') || 'Threshold'}:</span> {formatPrice(rule.threshold)}</p>
                        <p><span className="font-medium">{t('admin.free_shipping_table_zones') || 'Zones'}:</span> {rule.zoneIds && rule.zoneIds.length > 0 ? t('admin.free_shipping_zones_count', { count: rule.zoneIds.length.toString() }) || `${rule.zoneIds.length} zones` : (t('admin.free_shipping_all_zones') || 'All zones')}</p>
                        <p><span className="font-medium">{t('admin.free_shipping_table_valid_period') || 'Valid Period'}:</span> {rule.validFrom?.toDate ? new Date(rule.validFrom.toDate()).toLocaleDateString() : (t('admin.free_shipping_always') || 'Always')} - {rule.validUntil?.toDate ? new Date(rule.validUntil.toDate()).toLocaleDateString() : (t('admin.free_shipping_always') || 'Always')}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ml-3 ${
                      rule.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                          {rule.isActive ? (t('admin.free_shipping_active') || 'Active') : (t('admin.free_shipping_inactive') || 'Inactive')}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={async () => {
                        // Check if demo mode is enabled
                        if (settings.demoMode) {
                          setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                          setInfoDialogType('error');
                          setShowInfoDialog(true);
                          return;
                        }
                        try {
                          await updateFreeShippingRule(rule.id!, { isActive: !rule.isActive });
                          fetchData();
                          setInfoDialogMessage(t('admin.free_shipping_update_success') || 'Free shipping rule updated successfully!');
                          setInfoDialogType('success');
                          setShowInfoDialog(true);
                          } catch {
                          // Failed to update rule
                          setInfoDialogMessage(t('admin.free_shipping.update_failed') || 'Failed to update rule');
                          setInfoDialogType('error');
                          setShowInfoDialog(true);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-gray-50 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                      {rule.isActive ? (t('admin.free_shipping_deactivate') || 'Deactivate') : (t('admin.free_shipping_activate') || 'Activate')}
                    </button>
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setFormData({
                          name: rule.name,
                          description: rule.description || '',
                          threshold: rule.threshold,
                          zoneIds: rule.zoneIds || [],
                          validFrom: rule.validFrom?.toDate ? new Date(rule.validFrom.toDate()).toISOString().split('T')[0] : '',
                          validUntil: rule.validUntil?.toDate ? new Date(rule.validUntil.toDate()).toISOString().split('T')[0] : '',
                        });
                        setShowForm(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.common.edit') || 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('admin.common.delete') || 'Delete'}
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

export default FreeShippingPage;

