'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  getAllLocalPaymentMethods,
  createLocalPaymentMethod,
  updateLocalPaymentMethod,
  deleteLocalPaymentMethod,
} from '@/lib/firestore/internationalization_db';
import { LocalPaymentMethod } from '@/lib/firestore/internationalization';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import Dialog from '@/components/ui/Dialog';
const PaymentMethodsPage = () => {
  const { t } = useLanguage();
  const [methods, setMethods] = useState<LocalPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<LocalPaymentMethod | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [iconImageFile, setIconImageFile] = useState<File | null>(null);
  const [iconImagePreview, setIconImagePreview] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'manual' as 'wallet' | 'bank' | 'card' | 'manual',
    icon: '',
    isActive: true,
    accountNumber: '',
    accountTitle: '',
    bankName: '',
    iban: '',
    swiftCode: '',
    instructions: '',
    apiKey: '',
    merchantId: '',
    apiUrl: '',
    supportedRegions: [] as string[],
    minAmount: 0,
    maxAmount: 0,
    processingFee: 0,
    processingFeeType: 'fixed' as 'fixed' | 'percentage',
  });

  useEffect(() => {
    fetchMethods();
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

  const fetchMethods = async () => {
    try {
      const data = await getAllLocalPaymentMethods();
      setMethods(data);
    } catch {
      // Failed to fetch payment methods
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
    setUploadingIcon(true);
    try {
      let iconUrl = formData.icon;

      // Upload icon image if file is selected
      if (iconImageFile) {
        try {
          const sanitizedFileName = iconImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `payment-methods/icons/${Date.now()}_${sanitizedFileName}`;
          const storageRef = ref(storage, filePath);
          const uploadResult = await uploadBytes(storageRef, iconImageFile);
          iconUrl = await getDownloadURL(uploadResult.ref);
        } catch {
          setInfoDialogMessage(t('admin.local_payments_icon_upload_failed') || 'Failed to upload icon image.');
          setInfoDialogType('error');
          setShowInfoDialog(true);
          setUploadingIcon(false);
          return;
        }
      }

      // Build config object, removing undefined values
      const config: Record<string, string> = {};
      if (formData.accountNumber?.trim()) config.accountNumber = formData.accountNumber.trim();
      if (formData.accountTitle?.trim()) config.accountTitle = formData.accountTitle.trim();
      if (formData.bankName?.trim()) config.bankName = formData.bankName.trim();
      if (formData.iban?.trim()) config.iban = formData.iban.trim();
      if (formData.swiftCode?.trim()) config.swiftCode = formData.swiftCode.trim();
      if (formData.instructions?.trim()) config.instructions = formData.instructions.trim();
      if (formData.apiKey?.trim()) config.apiKey = formData.apiKey.trim();
      if (formData.merchantId?.trim()) config.merchantId = formData.merchantId.trim();
      if (formData.apiUrl?.trim()) config.apiUrl = formData.apiUrl.trim();

      const methodData: Omit<LocalPaymentMethod, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        code: formData.code,
        type: formData.type,
        isActive: formData.isActive,
        processingFeeType: formData.processingFeeType,
        ...(iconUrl?.trim() && { icon: iconUrl.trim() }),
        ...(Object.keys(config).length > 0 && { config }),
        ...(formData.supportedRegions.length > 0 && { supportedRegions: formData.supportedRegions }),
        ...(formData.minAmount > 0 && { minAmount: formData.minAmount }),
        ...(formData.maxAmount > 0 && { maxAmount: formData.maxAmount }),
        ...(formData.processingFee > 0 && { processingFee: formData.processingFee }),
      };

      if (editingMethod) {
        await updateLocalPaymentMethod(editingMethod.id!, methodData);
      } else {
        await createLocalPaymentMethod(methodData);
      }
      setShowForm(false);
      setEditingMethod(null);
      resetForm();
      fetchMethods();
      setInfoDialogMessage(editingMethod ? (t('admin.local_payments_update_success') || 'Payment method updated successfully!') : (t('admin.local_payments_create_success') || 'Payment method created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save payment method
      setInfoDialogMessage(t('admin.local_payments_save_failed') || 'Failed to save payment method.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleEdit = (method: LocalPaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      name: method.name,
      code: method.code,
      type: method.type,
      icon: method.icon || '',
      isActive: method.isActive,
      accountNumber: method.config?.accountNumber || '',
      accountTitle: method.config?.accountTitle || '',
      bankName: method.config?.bankName || '',
      iban: method.config?.iban || '',
      swiftCode: method.config?.swiftCode || '',
      instructions: method.config?.instructions || '',
      apiKey: method.config?.apiKey || '',
      merchantId: method.config?.merchantId || '',
      apiUrl: method.config?.apiUrl || '',
      supportedRegions: method.supportedRegions || [],
      minAmount: method.minAmount || 0,
      maxAmount: method.maxAmount || 0,
      processingFee: method.processingFee || 0,
      processingFeeType: method.processingFeeType || 'fixed',
    });
    // Reset icon image preview and file
    setIconImageFile(null);
    setIconImagePreview(null);
    if (iconFileInputRef.current) {
      iconFileInputRef.current.value = '';
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.local_payments_delete_confirm') || 'Are you sure you want to delete this payment method?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteLocalPaymentMethod(id);
        fetchMethods();
        setInfoDialogMessage(t('admin.local_payments_delete_success') || 'Payment method deleted successfully.');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete payment method
        setInfoDialogMessage(t('admin.local_payments_delete_failed') || 'Failed to delete payment method');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'manual',
      icon: '',
      isActive: true,
      accountNumber: '',
      accountTitle: '',
      bankName: '',
      iban: '',
      swiftCode: '',
      instructions: '',
      apiKey: '',
      merchantId: '',
      apiUrl: '',
      supportedRegions: [],
      minAmount: 0,
      maxAmount: 0,
      processingFee: 0,
      processingFeeType: 'fixed',
    });
    setIconImageFile(null);
    setIconImagePreview(null);
    if (iconFileInputRef.current) {
      iconFileInputRef.current.value = '';
    }
  };

  const handleIconImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.page_editor_image_upload_disabled_demo') || 'Image upload is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      e.target.value = '';
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setInfoDialogMessage(t('admin.local_payments_icon_invalid_file') || 'Please select a valid image file.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        e.target.value = '';
        return;
      }
      setIconImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIconImage = () => {
    setIconImageFile(null);
    setIconImagePreview(null);
    if (iconFileInputRef.current) {
      iconFileInputRef.current.value = '';
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.local_payments_title') || 'Local Payment Methods'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.local_payments_subtitle') ||
              'Configure local payment gateways (JazzCash, EasyPaisa, Bank Transfer, etc.)'}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingMethod(null);
            setShowForm(true);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.local_payments_new_button') || 'New Payment Method'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {editingMethod
              ? t('admin.local_payments_form_title_edit') || 'Edit Payment Method'
              : t('admin.local_payments_form_title_create') || 'Create Payment Method'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_name_label') || 'Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  placeholder={
                    t('admin.local_payments_field_name_placeholder') ||
                    'e.g., JazzCash, EasyPaisa'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_code_label') || 'Code'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  placeholder={
                    t('admin.local_payments_field_code_placeholder') ||
                    'e.g., jazzcash, easypaisa'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_type_label') || 'Type'}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'wallet' | 'bank' | 'card' | 'manual' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                >
                  <option value="wallet">
                    {t('admin.local_payments_field_type_wallet') || 'Wallet'}
                  </option>
                  <option value="bank">
                    {t('admin.local_payments_field_type_bank') || 'Bank Transfer'}
                  </option>
                  <option value="card">
                    {t('admin.local_payments_field_type_card') || 'Card'}
                  </option>
                  <option value="manual">
                    {t('admin.local_payments_field_type_manual') || 'Manual'}
                  </option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_icon_label') || 'Icon (Emoji, URL, or Image)'}
                </label>
                
                {/* Icon Preview */}
                {(iconImagePreview || (formData.icon && formData.icon.startsWith('http'))) && (
                  <div className="mb-3 relative inline-block">
                    <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {iconImagePreview ? (
                        <Image
                          src={iconImagePreview}
                          alt="Icon Preview"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : formData.icon.startsWith('http') ? (
                        <Image
                          src={formData.icon}
                          alt="Icon"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-3xl">{formData.icon}</span>
                      )}
                    </div>
                    {iconImagePreview && (
                      <button
                        type="button"
                        onClick={removeIconImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {/* Image Upload */}
                <div className="mb-3">
                  <label
                    htmlFor="icon-image-upload"
                    className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-6 h-6 mb-2 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="text-xs text-gray-500 text-center">
                        <span className="font-semibold">Click to upload icon image</span>
                      </p>
                      <p className="text-xs text-gray-400 text-center mt-1">PNG, JPG, SVG (MAX. 2MB)</p>
                    </div>
                    <input
                      id="icon-image-upload"
                      ref={iconFileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleIconImageChange}
                    />
                  </label>
                </div>

                {/* Text Input for Emoji or URL */}
                <div className="relative">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder={
                      t('admin.local_payments_field_icon_placeholder') || '💳 or https://example.com/icon.png'
                    }
                    disabled={!!iconImageFile}
                  />
                  {iconImageFile && (
                    <p className="mt-1 text-xs text-gray-500">
                      {t('admin.local_payments_icon_image_selected') || 'Image selected. Upload will replace text input.'}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t('admin.local_payments_field_icon_hint') || 'Enter an emoji (💳), image URL, or upload an image above'}
                </p>
              </div>
            </div>
            
            {(formData.type === 'bank' || formData.type === 'manual') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_account_number_label') ||
                      'Account Number'}
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_account_title_label') ||
                      'Account Title'}
                  </label>
                  <input
                    type="text"
                    value={formData.accountTitle}
                    onChange={(e) => setFormData({ ...formData, accountTitle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_bank_name_label') || 'Bank Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_iban_label') || 'IBAN'}
                  </label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_swift_label') || 'SWIFT Code'}
                  </label>
                  <input
                    type="text"
                    value={formData.swiftCode}
                    onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                {formData.type === 'manual' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.local_payments_field_instructions_label') ||
                        'Instructions'}
                    </label>
                    <textarea
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={
                        t('admin.local_payments_field_instructions_placeholder') ||
                        'Payment instructions for customers...'
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {(formData.type === 'wallet' || formData.type === 'card') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_api_key_label') || 'API Key'}
                  </label>
                  <input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_merchant_id_label') || 'Merchant ID'}
                  </label>
                  <input
                    type="text"
                    value={formData.merchantId}
                    onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.local_payments_field_api_url_label') || 'API URL'}
                  </label>
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder={
                      t('admin.local_payments_field_api_url_placeholder') ||
                      'https://api.example.com'
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_min_amount_label') || 'Min Amount'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.minAmount}
                  onChange={(e) => setFormData({ ...formData, minAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_max_amount_label') || 'Max Amount'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.maxAmount}
                  onChange={(e) => setFormData({ ...formData, maxAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_processing_fee_label') ||
                    'Processing Fee'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.processingFee}
                  onChange={(e) => setFormData({ ...formData, processingFee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.local_payments_field_processing_fee_type_label') ||
                    'Processing Fee Type'}
                </label>
                <select
                  value={formData.processingFeeType}
                  onChange={(e) => setFormData({ ...formData, processingFeeType: e.target.value as 'fixed' | 'percentage' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                >
                  <option value="fixed">
                    {t('admin.local_payments_field_processing_fee_type_fixed') ||
                      'Fixed'}
                  </option>
                  <option value="percentage">
                    {t('admin.local_payments_field_processing_fee_type_percentage') ||
                      'Percentage'}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
              />
              <span className="text-sm font-medium text-gray-700">
                {t('admin.local_payments_field_active_label') || 'Active'}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploadingIcon}
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingIcon
                  ? (t('admin.local_payments_uploading') || 'Uploading...')
                  : editingMethod
                  ? t('admin.local_payments_save_button_update') ||
                    'Update Payment Method'
                  : t('admin.local_payments_save_button_create') ||
                    'Create Payment Method'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingMethod(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.local_payments_cancel_button') ||
                  t('common.cancel') ||
                  'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {methods.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">No payment methods found.</p>
            <p className="text-sm text-gray-400">Get started by adding your first payment method</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.local_payments_table_icon') || 'Icon'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.local_payments_table_name') || 'Name'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.local_payments_table_code') || 'Code'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.local_payments_table_type') || 'Type'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.local_payments_table_status') || 'Status'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.local_payments_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {methods.map((method) => (
                    <tr key={method.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {method.icon ? (
                          method.icon.startsWith('http') ? (
                            <Image
                              src={method.icon}
                              alt={`${method.name} icon`}
                              width={32}
                              height={32}
                              className="w-8 h-8 object-cover rounded"
                              unoptimized
                            />
                          ) : (
                            <span className="text-2xl">{method.icon}</span>
                          )
                        ) : (
                          <span className="text-2xl">💳</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{method.name}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{method.code}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{method.type}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          method.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {method.isActive
                            ? t('admin.local_payments_status_active') || 'Active'
                            : t('admin.local_payments_status_inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(method)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('common.edit') || 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(method.id!)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
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
              {methods.map((method) => (
                <div key={method.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {method.icon ? (
                        method.icon.startsWith('http') ? (
                          <Image
                            src={method.icon}
                            alt={`${method.name} icon`}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-cover rounded flex-shrink-0"
                            unoptimized
                          />
                        ) : (
                          <span className="text-2xl flex-shrink-0">{method.icon}</span>
                        )
                      ) : (
                        <span className="text-2xl flex-shrink-0">💳</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">{method.name}</h3>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p><span className="font-medium">Code:</span> {method.code}</p>
                          <p><span className="font-medium">Type:</span> <span className="capitalize">{method.type}</span></p>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ml-3 ${
                      method.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {method.isActive
                        ? t('admin.local_payments_status_active') || 'Active'
                        : t('admin.local_payments_status_inactive') || 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(method)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('common.edit') || 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(method.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
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

export default PaymentMethodsPage;

