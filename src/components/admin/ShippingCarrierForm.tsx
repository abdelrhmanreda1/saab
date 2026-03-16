'use client';

import React, { useState, useEffect } from 'react';
import { ShippingCarrier } from '@/lib/firestore/shipping';
import { addShippingCarrier, updateShippingCarrier, getShippingCarrier } from '@/lib/firestore/shipping_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { useLanguage } from '@/context/LanguageContext';
import Dialog from '@/components/ui/Dialog';

interface ShippingCarrierFormProps {
  carrierId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ShippingCarrierForm: React.FC<ShippingCarrierFormProps> = ({ carrierId, onSuccess, onCancel }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(!!carrierId);
  const [error, setError] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [carrier, setCarrier] = useState<Omit<ShippingCarrier, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    code: '',
    website: '',
    phone: '',
    email: '',
    trackingUrl: '',
    isActive: true,
  });

  useEffect(() => {
    if (carrierId) {
      const fetchCarrier = async () => {
        try {
          const fetchedCarrier = await getShippingCarrier(carrierId);
          if (fetchedCarrier) {
            setCarrier({
              name: fetchedCarrier.name,
              code: fetchedCarrier.code,
              website: fetchedCarrier.website || '',
              phone: fetchedCarrier.phone || '',
              email: fetchedCarrier.email || '',
              trackingUrl: fetchedCarrier.trackingUrl || '',
              isActive: fetchedCarrier.isActive,
            });
          }
        } catch {
          // Failed to fetch carrier
          setError('Failed to load carrier data.');
        } finally {
          setLoading(false);
        }
      };
      fetchCarrier();
    } else {
      setLoading(false);
    }
  }, [carrierId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCarrier(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const settings = await getSettings();
    if (settings?.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (carrierId) {
        await updateShippingCarrier(carrierId, carrier);
      } else {
        await addShippingCarrier(carrier);
      }
      setInfoDialogMessage(carrierId ? (t('admin.shipping_carrier_update_success') || 'Shipping carrier updated successfully!') : (t('admin.shipping_carrier_create_success') || 'Shipping carrier created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      // Failed to save carrier
      setError(t('admin.shipping_carriers_save_failed') || 'Failed to save carrier. Please try again.');
      setInfoDialogMessage(t('admin.shipping_carriers_save_failed') || 'Failed to save carrier. Please try again.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading && carrierId && !carrier.name) {
    return <div className="text-center py-12">{t('admin.shipping_carriers_loading') || t('common.loading') || 'Loading...'}</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {carrierId
          ? `${t('common.edit') || 'Edit'} ${t('admin.carriers') || 'Carriers'}`
          : `${t('common.add') || 'Add'} ${t('admin.carriers') || 'Carriers'}`}
      </h2>
      {error && <div className="text-red-500 bg-red-50 p-4 rounded-lg mb-6">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.shipping_carriers_name_label') || 'Carrier Name'} *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={carrier.name}
              onChange={handleChange}
              required
              placeholder={t('admin.shipping_carriers_name_placeholder') || 'e.g., FedEx, DHL, TCS'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.shipping_carriers_code_label') || 'Code'} *</label>
            <input
              type="text"
              id="code"
              name="code"
              value={carrier.code}
              onChange={handleChange}
              required
              placeholder={t('admin.shipping_carriers_code_placeholder') || 'e.g., fedex, dhl, tcs'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">{t('admin.shipping_carriers_code_hint') || 'Unique identifier (lowercase, no spaces)'}</p>
          </div>

          <div>
            <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_phone_label') || 'Phone'}</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={carrier.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_email_label') || 'Email'}</label>
            <input
              type="email"
              id="email"
              name="email"
              value={carrier.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="website" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.shipping_carriers_website_label') || 'Website'}</label>
            <input
              type="url"
              id="website"
              name="website"
              value={carrier.website}
              onChange={handleChange}
              placeholder={t('admin.shipping_carriers_website_placeholder') || 'https://...'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="trackingUrl" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.shipping_carriers_tracking_url_label') || 'Tracking URL Template'}</label>
            <input
              type="text"
              id="trackingUrl"
              name="trackingUrl"
              value={carrier.trackingUrl}
              onChange={handleChange}
              placeholder={t('admin.shipping_carriers_tracking_url_placeholder') || 'https://tracking.example.com/track/{tracking_number}'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{t('admin.shipping_carriers_tracking_url_hint') || "Use {tracking_number} as placeholder for tracking number"}</p>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                checked={carrier.isActive}
                onChange={(e) => setCarrier(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="text-gray-700 font-medium">{t('admin.shipping_carriers_active_label') || 'Active Carrier'}</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-70"
            disabled={loading}
          >
            {loading
              ? (t('common.saving') || 'Saving...')
              : carrierId
                ? (t('admin.shipping_carriers_update_button') || 'Update Carrier')
                : (t('admin.shipping_carriers_create_button') || 'Create Carrier')}
          </button>
        </div>
      </form>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => {
          setShowInfoDialog(false);
          if (infoDialogType === 'success') {
            onSuccess();
          }
        }}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default ShippingCarrierForm;

