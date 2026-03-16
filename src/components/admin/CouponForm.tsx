'use client';

import React, { useState, useEffect } from 'react';
import { Coupon, addCoupon, updateCoupon, getCoupon } from '@/lib/firestore/coupons';
import { Timestamp } from 'firebase/firestore';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '../ui/Dialog';
import { useLanguage } from '@/context/LanguageContext';

interface CouponFormProps {
  couponId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CouponForm: React.FC<CouponFormProps> = ({ couponId, onSuccess, onCancel }) => {
  const isEditMode = !!couponId;

  const [coupon, setCoupon] = useState<Partial<Coupon>>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    minimumOrderAmount: 0,
    isActive: true,
    usageLimit: 100,
    perUserLimit: undefined,
    validFrom: Timestamp.now(),
    validUntil: Timestamp.now(),
  });
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const { t } = useLanguage();

  const [validFromStr, setValidFromStr] = useState('');
  const [validUntilStr, setValidUntilStr] = useState('');

  useEffect(() => {
    if (isEditMode && couponId) {
      setLoading(true);
      getCoupon(couponId).then(fetched => {
        if (fetched) {
          setCoupon(fetched);
          setValidFromStr(fetched.validFrom.toDate().toISOString().slice(0, 16));
          setValidUntilStr(fetched.validUntil.toDate().toISOString().slice(0, 16));
        }
      }).finally(() => setLoading(false));
    }
  }, [couponId, isEditMode]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    try {
      const couponData = {
        ...coupon,
        validFrom: Timestamp.fromDate(new Date(validFromStr)),
        validUntil: Timestamp.fromDate(new Date(validUntilStr)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      if (isEditMode && couponId) {
        await updateCoupon(couponId, couponData);
      } else {
        await addCoupon(couponData);
      }
      setInfoDialogMessage(isEditMode ? (t('admin.coupons_update_success') || 'Coupon updated successfully!') : (t('admin.coupons_create_success') || 'Coupon created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      // Failed to save coupon
      setInfoDialogMessage(t('admin.coupons_save_failed') || 'Failed to save coupon.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setCoupon(prev => {
      if (type === 'checkbox') {
        return { ...prev, [name]: checked };
      } else if (type === 'number') {
        // Handle empty values for optional number fields
        if (value === '' && (name === 'usageLimit' || name === 'perUserLimit' || name === 'minimumOrderAmount')) {
          return { ...prev, [name]: undefined };
        }
        return { ...prev, [name]: parseFloat(value) || 0 };
      } else {
        return { ...prev, [name]: value };
      }
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {isEditMode
          ? `${t('common.edit') || 'Edit'} ${t('admin.coupons') || 'Coupons'}`
          : `${t('common.add') || 'Add'} ${t('admin.coupons') || 'Coupons'}`}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.coupons_table_code') || 'Code'}</label>
          <input
            type="text"
            name="code"
            value={coupon.code}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.coupons_table_type') || 'Type'}</label>
            <select
              name="discountType"
              value={coupon.discountType}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="percentage">{t('admin.coupons_type_percentage') || 'Percentage'}</option>
              <option value="fixed">{t('admin.coupons_type_fixed') || 'Fixed Amount'}</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.coupons_table_value') || 'Value'}</label>
            <input
              type="number"
              name="discountValue"
              value={coupon.discountValue}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Valid From</label>
            <input
              type="datetime-local"
              value={validFromStr}
              onChange={(e) => setValidFromStr(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Valid Until</label>
            <input
              type="datetime-local"
              value={validUntilStr}
              onChange={(e) => setValidUntilStr(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                 <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.coupons_total_usage_limit') || 'Total Usage Limit'}</label>
                 <input
                    type="number"
                    name="usageLimit"
                    value={coupon.usageLimit}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder={t('admin.coupons_unlimited_placeholder') || 'Leave empty for unlimited'}
                 />
                 <p className="text-xs text-gray-500 mt-1">{t('admin.coupons_total_usage_hint') || 'Total times this coupon can be used by all users'}</p>
            </div>
             <div>
                 <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.coupons_per_user_limit') || 'Per User Limit'}</label>
                 <input
                    type="number"
                    name="perUserLimit"
                    value={coupon.perUserLimit || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder={t('admin.coupons_unlimited_placeholder') || 'Leave empty for unlimited'}
                 />
                 <p className="text-xs text-gray-500 mt-1">{t('admin.coupons_per_user_hint') || 'How many times each customer can use this coupon'}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                 <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.coupons_min_order_amount') || 'Min Order Amount'}</label>
                 <input
                    type="number"
                    name="minimumOrderAmount"
                    value={coupon.minimumOrderAmount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 />
            </div>
        </div>

        <div>
           <label className="inline-flex items-center cursor-pointer">
             <input
                type="checkbox"
                name="isActive"
                checked={coupon.isActive}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-green-600 rounded focus:ring-green-500"
             />
             <span className="ml-2 text-gray-700 font-medium">{t('admin.coupons_active_label') || t('admin.shipping_zones_status_active') || 'Active'}</span>
           </label>
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
            {loading ? (t('common.saving') || 'Saving...') : (t('admin.coupons_save_button') || 'Save Coupon')}
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

export default CouponForm;
