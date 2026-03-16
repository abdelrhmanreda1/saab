'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import Switch from '@/components/Switch';
import Dialog from '@/components/ui/Dialog';

const GiftWrapPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogType, setDialogType] = useState<'success' | 'error'>('success');

  const fetchSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      setDialogMessage(t('admin.settings.load_failed') || 'Failed to load settings');
      setDialogType('error');
      setShowDialog(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setDialogType('error');
      setShowDialog(true);
      return;
    }
    setSaving(true);
    try {
      // Ensure giftWrap has all required fields with defaults
      const giftWrapData = {
        enabled: settings.giftWrap?.enabled ?? false,
        price: settings.giftWrap?.price ?? 150,
        description: settings.giftWrap?.description ?? 'Add a special touch',
      };
      
      await updateSettings({
        giftWrap: giftWrapData,
      });
      setDialogMessage(t('admin.settings.save_success') || 'Settings saved successfully!');
      setDialogType('success');
      setShowDialog(true);
    } catch {
      setDialogMessage(t('admin.settings.save_failed') || 'Failed to save settings');
      setDialogType('error');
      setShowDialog(true);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof Settings['giftWrap'], value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      giftWrap: {
        enabled: prev.giftWrap?.enabled ?? false,
        price: prev.giftWrap?.price ?? 150,
        description: prev.giftWrap?.description ?? 'Add a special touch',
        [field]: value,
      },
    }));
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
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t('admin.gift_wrap_title') || 'Gift Wrap'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t('admin.gift_wrap_subtitle') || 'Configure gift wrap options for your orders'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {t('admin.gift_wrap_enable') || 'Enable Gift Wrap'}
            </h3>
            <p className="text-sm text-gray-500">
              {t('admin.gift_wrap_enable_hint') || 'Allow customers to add gift wrap to their orders'}
            </p>
          </div>
          <Switch
            label=""
            checked={settings.giftWrap?.enabled || false}
            onChange={(e) => handleInputChange('enabled', e.target.checked)}
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('admin.gift_wrap_price') || 'Price'}
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.giftWrap?.price || 150}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              placeholder="150"
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
              {formatPrice(settings.giftWrap?.price || 150)}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('admin.gift_wrap_price_hint') || 'Additional charge for gift wrap service'}
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('admin.gift_wrap_description') || 'Description'}
          </label>
          <input
            type="text"
            value={settings.giftWrap?.description || 'Add a special touch'}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            placeholder="Add a special touch"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('admin.gift_wrap_description_hint') || 'This text will be shown to customers'}
          </p>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            {t('admin.gift_wrap_preview') || 'Preview'}
          </h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.giftWrap?.enabled || false}
                disabled
                className="w-5 h-5"
              />
              <div>
                <label className="text-sm font-medium text-gray-900">
                  {t('admin.gift_wrap') || 'Gift Wrap'}
                </label>
                <p className="text-xs text-gray-500">
                  {settings.giftWrap?.description || 'Add a special touch'}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {formatPrice(settings.giftWrap?.price || 150)}
            </span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={fetchSettings}
            className="px-4 sm:px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
            disabled={saving}
          >
            {t('admin.settings_discard') || 'Discard Changes'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-4 sm:px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-all flex items-center justify-center ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('admin.settings_saving') || 'Saving...'}
              </>
            ) : (
              t('admin.settings_save') || 'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* Success/Error Dialog */}
      <Dialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title={dialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={dialogMessage}
        type={dialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default GiftWrapPage;

