'use client';

import React, { useState, useEffect } from 'react';
import { Supplier } from '@/lib/firestore/suppliers';
import { addSupplier, updateSupplier, getSupplier } from '@/lib/firestore/suppliers_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';
import { useLanguage } from '@/context/LanguageContext';

interface SupplierFormProps {
  supplierId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ supplierId, onSuccess, onCancel }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(!!supplierId);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [supplier, setSupplier] = useState<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    taxId: '',
    paymentTerms: 'Net 30',
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    if (supplierId) {
      const fetchSupplier = async () => {
        try {
          const fetchedSupplier = await getSupplier(supplierId);
          if (fetchedSupplier) {
            setSupplier({
              name: fetchedSupplier.name,
              contactPerson: fetchedSupplier.contactPerson,
              email: fetchedSupplier.email,
              phone: fetchedSupplier.phone,
              address: fetchedSupplier.address,
              city: fetchedSupplier.city,
              state: fetchedSupplier.state,
              country: fetchedSupplier.country,
              zipCode: fetchedSupplier.zipCode,
              taxId: fetchedSupplier.taxId || '',
              paymentTerms: fetchedSupplier.paymentTerms,
              notes: fetchedSupplier.notes || '',
              isActive: fetchedSupplier.isActive,
            });
          }
        } catch {
          // Failed to fetch supplier
          setError('Failed to load supplier data.');
        } finally {
          setLoading(false);
        }
      };
      fetchSupplier();
    } else {
      setLoading(false);
    }

    // Load settings
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
  }, [supplierId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSupplier(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (supplierId) {
        await updateSupplier(supplierId, supplier);
      } else {
        await addSupplier(supplier);
      }
      setInfoDialogMessage(supplierId ? (t('admin.suppliers_update_success') || 'Supplier updated successfully!') : (t('admin.suppliers_create_success') || 'Supplier created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      // Failed to save supplier
      setError(t('admin.suppliers_save_failed') || 'Failed to save supplier. Please try again.');
      setInfoDialogMessage(t('admin.suppliers_save_failed') || 'Failed to save supplier. Please try again.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading && supplierId && !supplier.name) {
    return <div className="text-center py-12">{t('admin.suppliers_loading') || t('common.loading') || 'Loading...'}</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {supplierId
          ? `${t('common.edit') || 'Edit'} ${t('admin.suppliers') || 'Suppliers'}`
          : `${t('common.add') || 'Add'} ${t('admin.suppliers') || 'Suppliers'}`}
      </h2>
      {error && <div className="text-red-500 bg-red-50 p-4 rounded-lg mb-6">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_name_label') || 'Supplier Name'} *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={supplier.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="contactPerson" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_contact_person_label') || 'Contact Person'} *</label>
            <input
              type="text"
              id="contactPerson"
              name="contactPerson"
              value={supplier.contactPerson}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_email_label') || 'Email'} *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={supplier.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_phone_label') || 'Phone'} *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={supplier.phone}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_address_label') || 'Address'} *</label>
            <input
              type="text"
              id="address"
              name="address"
              value={supplier.address}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_city_label') || 'City'} *</label>
            <input
              type="text"
              id="city"
              name="city"
              value={supplier.city}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="state" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_state_label') || 'State/Province'} *</label>
            <input
              type="text"
              id="state"
              name="state"
              value={supplier.state}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="country" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_country_label') || 'Country'} *</label>
            <input
              type="text"
              id="country"
              name="country"
              value={supplier.country}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="zipCode" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_zip_label') || 'Zip Code'}</label>
            <input
              type="text"
              id="zipCode"
              name="zipCode"
              value={supplier.zipCode}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="taxId" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_tax_id_label') || 'Tax ID'}</label>
            <input
              type="text"
              id="taxId"
              name="taxId"
              value={supplier.taxId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="paymentTerms" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_table_payment_terms') || 'Payment Terms'} *</label>
            <select
              id="paymentTerms"
              name="paymentTerms"
              value={supplier.paymentTerms}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="COD">{t('admin.suppliers_payment_cod') || 'Cash on Delivery'}</option>
              <option value="Net 15">{t('admin.suppliers_payment_net_15') || 'Net 15'}</option>
              <option value="Net 30">{t('admin.suppliers_payment_net_30') || 'Net 30'}</option>
              <option value="Net 45">{t('admin.suppliers_payment_net_45') || 'Net 45'}</option>
              <option value="Net 60">{t('admin.suppliers_payment_net_60') || 'Net 60'}</option>
              <option value="Prepaid">{t('admin.suppliers_payment_prepaid') || 'Prepaid'}</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.suppliers_form_notes_label') || 'Notes'}</label>
            <textarea
              id="notes"
              name="notes"
              value={supplier.notes}
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
                checked={supplier.isActive}
                onChange={(e) => setSupplier(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="text-gray-700 font-medium">{t('admin.suppliers_active_label') || 'Active Supplier'}</span>
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
              : supplierId
                ? (t('admin.suppliers_update_button') || 'Update Supplier')
                : (t('admin.suppliers_create_button') || 'Create Supplier')}
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

export default SupplierForm;

