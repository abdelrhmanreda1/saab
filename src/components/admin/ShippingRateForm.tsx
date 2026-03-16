'use client';

import React, { useState, useEffect } from 'react';
import { ShippingRate } from '@/lib/firestore/shipping';
import { addShippingRate, updateShippingRate, getShippingRate } from '@/lib/firestore/shipping_db';
import { getAllShippingZones } from '@/lib/firestore/shipping_db';
import { ShippingZone } from '@/lib/firestore/shipping';
import { getAllShippingCarriers } from '@/lib/firestore/shipping_db';
import { ShippingCarrier } from '@/lib/firestore/shipping';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import Dialog from '../ui/Dialog';

interface ShippingRateFormProps {
  rateId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ShippingRateForm: React.FC<ShippingRateFormProps> = ({ rateId, onSuccess, onCancel }) => {
  const { t } = useLanguage();
  const { defaultCurrency } = useCurrency();
  const [loading, setLoading] = useState(!!rateId);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [rate, setRate] = useState<Omit<ShippingRate, 'id' | 'createdAt' | 'updatedAt'>>({
    zoneId: '',
    zoneName: '',
    name: '',
    description: '',
    rateType: 'flat',
    flatRate: 0,
    estimatedDays: 3,
    isActive: true,
  });
  const [weightRanges, setWeightRanges] = useState<{ minWeight: number; maxWeight: number; rate: number }[]>([]);
  const [priceRanges, setPriceRanges] = useState<{ minPrice: number; maxPrice: number; rate: number }[]>([]);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedZones, fetchedCarriers] = await Promise.all([
          getAllShippingZones(),
          getAllShippingCarriers(true),
        ]);
        setZones(fetchedZones);
        setCarriers(fetchedCarriers);

        if (rateId) {
          const fetchedRate = await getShippingRate(rateId);
          if (fetchedRate) {
            setRate({
              zoneId: fetchedRate.zoneId,
              zoneName: fetchedRate.zoneName,
              name: fetchedRate.name,
              description: fetchedRate.description || '',
              carrierId: fetchedRate.carrierId,
              carrierName: fetchedRate.carrierName,
              rateType: fetchedRate.rateType,
              flatRate: fetchedRate.flatRate,
              freeShippingThreshold: fetchedRate.freeShippingThreshold,
              estimatedDays: fetchedRate.estimatedDays,
              isActive: fetchedRate.isActive,
            });
            if (fetchedRate.weightRanges) {
              setWeightRanges(fetchedRate.weightRanges);
            }
            if (fetchedRate.priceRanges) {
              setPriceRanges(fetchedRate.priceRanges);
            }
          }
        }
      } catch {
        // Failed to fetch data
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [rateId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'flatRate' || name === 'estimatedDays' || name === 'freeShippingThreshold') {
      setRate(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setRate(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zoneId = e.target.value;
    const zone = zones.find(z => z.id === zoneId);
    setRate(prev => ({
      ...prev,
      zoneId,
      zoneName: zone?.name || '',
    }));
  };

  const handleCarrierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const carrierId = e.target.value;
    const carrier = carriers.find(c => c.id === carrierId);
    setRate(prev => ({
      ...prev,
      carrierId: carrierId || undefined,
      carrierName: carrier?.name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rate.zoneId) {
      setInfoDialogMessage(t('admin.shipping.select_zone') || 'Please select a shipping zone');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

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
      const rateData = {
        ...rate,
        weightRanges: rate.rateType === 'weight_based' && weightRanges.length > 0 ? weightRanges : undefined,
        priceRanges: rate.rateType === 'price_based' && priceRanges.length > 0 ? priceRanges : undefined,
      };

      if (rateId) {
        await updateShippingRate(rateId, rateData);
      } else {
        await addShippingRate(rateData);
      }
      setInfoDialogMessage(rateId ? (t('admin.shipping_rate_update_success') || 'Shipping rate updated successfully!') : (t('admin.shipping_rate_create_success') || 'Shipping rate created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      // Failed to save shipping rate
      setError('Failed to save shipping rate. Please try again.');
      setInfoDialogMessage('Failed to save shipping rate. Please try again.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading && rateId && !rate.name) {
    return <div className="text-center py-12">{t('admin.shipping_rates_loading') || t('common.loading') || 'Loading...'}</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {rateId
          ? `${t('common.edit') || 'Edit'} ${t('admin.shipping_rates') || 'Shipping Rates'}`
          : `${t('common.add') || 'Add'} ${t('admin.shipping_rates') || 'Shipping Rates'}`}
      </h2>
      {error && <div className="text-red-500 bg-red-50 p-4 rounded-lg mb-6">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="zoneId" className="block text-gray-700 text-sm font-bold mb-2">
              {t('admin.shipping_rates_table_zone') || 'Shipping Zone'} *
            </label>
            <select
              id="zoneId"
              name="zoneId"
              value={rate.zoneId}
              onChange={handleZoneChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">{t('admin.shipping_rates_select_zone') || 'Select Zone'}</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
              {t('admin.shipping_rates_table_name') || 'Rate Name'} *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={rate.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="rateType" className="block text-gray-700 text-sm font-bold mb-2">
              {t('admin.shipping_rates_rate_type_label') || 'Rate Type'} *
            </label>
            <select
              id="rateType"
              name="rateType"
              value={rate.rateType}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="flat">{t('admin.shipping_rates_rate_type_flat') || 'Flat Rate'}</option>
              <option value="weight_based">{t('admin.shipping_rates_rate_type_weight') || 'Weight Based'}</option>
              <option value="price_based">{t('admin.shipping_rates_rate_type_price') || 'Price Based'}</option>
              <option value="free">{t('admin.shipping_rates_rate_type_free') || 'Free Shipping'}</option>
            </select>
          </div>

          <div>
            <label htmlFor="carrierId" className="block text-gray-700 text-sm font-bold mb-2">
              {t('admin.shipping_rates_carrier_optional') || 'Carrier (Optional)'}
            </label>
            <select
              id="carrierId"
              name="carrierId"
              value={rate.carrierId || ''}
              onChange={handleCarrierChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">{t('admin.shipping_rates_carrier_none') || 'No Carrier'}</option>
              {carriers.map(carrier => (
                <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
              ))}
            </select>
          </div>

          {rate.rateType === 'flat' && (
            <div>
              <label htmlFor="flatRate" className="block text-gray-700 text-sm font-bold mb-2">
                {(t('admin.shipping_rates_flat_rate_label') || 'Flat Rate')}{defaultCurrency?.symbol ? ` (${defaultCurrency.symbol})` : ''} *
              </label>
              <input
                type="number"
                id="flatRate"
                name="flatRate"
                min="0"
                step="0.01"
                value={rate.flatRate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
            </div>
          )}

          {rate.rateType === 'free' && (
            <div>
              <label htmlFor="freeShippingThreshold" className="block text-gray-700 text-sm font-bold mb-2">
                {(t('admin.shipping_rates_free_threshold_label') || 'Free Shipping Threshold')}{defaultCurrency?.symbol ? ` (${defaultCurrency.symbol})` : ''}
              </label>
              <input
                type="number"
                id="freeShippingThreshold"
                name="freeShippingThreshold"
                min="0"
                step="0.01"
                value={rate.freeShippingThreshold || 0}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="estimatedDays" className="block text-gray-700 text-sm font-bold mb-2">
              {t('admin.shipping_rates_estimated_days_label') || 'Estimated Delivery Days'} *
            </label>
            <input
              type="number"
              id="estimatedDays"
              name="estimatedDays"
              min="1"
              value={rate.estimatedDays}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
              {t('admin.shipping_rates_table_description') || t('common.description') || 'Description'}
            </label>
            <textarea
              id="description"
              name="description"
              value={rate.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                checked={rate.isActive}
                onChange={(e) => setRate(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="text-gray-700 font-medium">{t('admin.shipping_rates_active_label') || 'Active Rate'}</span>
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
              : rateId
                ? (t('admin.shipping_rates_update_button') || 'Update Rate')
                : (t('admin.shipping_rates_create_button') || 'Create Rate')}
          </button>
        </div>
      </form>

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

export default ShippingRateForm;

