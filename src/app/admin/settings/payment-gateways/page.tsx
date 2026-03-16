'use client';

import React, { useState, useEffect } from 'react';
import {
  getAllPaymentGateways,
  createPaymentGateway,
  updatePaymentGateway,
  deletePaymentGateway,
} from '@/lib/firestore/payment_gateways_db';
import { PaymentGateway, PaymentGatewayType } from '@/lib/firestore/payment_gateways';
import { useLanguage } from '@/context/LanguageContext';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Dialog from '@/components/ui/Dialog';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';

const PaymentGatewaysPage = () => {
  const { t } = useLanguage();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [formData, setFormData] = useState({
    type: 'stripe' as PaymentGatewayType,
    name: '',
    isActive: true,
    isTestMode: true,
    config: {
      publishableKey: '',
      secretKey: '',
      clientId: '',
      clientSecret: '',
      merchantId: '',
      environment: 'sandbox' as 'sandbox' | 'production',
      publicKey: '',
      keyId: '',
      keySecret: '',
      encryptionKey: '',
    },
    supportedRegions: [] as string[],
    minAmount: 0,
    maxAmount: 0,
    processingFee: 0,
    processingFeeType: 'fixed' as 'fixed' | 'percentage',
    icon: '',
    description: '',
  });

  useEffect(() => {
    fetchGateways();
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

  const fetchGateways = async () => {
    try {
      const data = await getAllPaymentGateways();
      setGateways(data);
    } catch {
      // Failed to fetch payment gateways
    } finally {
      setLoading(false);
    }
  };

  const getGatewayDefaults = (type: PaymentGatewayType) => {
    const defaults: Record<PaymentGatewayType, { name: string; icon: string; description: string }> = {
      stripe: { name: 'Stripe', icon: '💳', description: 'Accept payments via credit/debit cards' },
      paypal: { name: 'PayPal', icon: '🅿️', description: 'Pay with PayPal account' },
      paystack: { name: 'Paystack', icon: '💰', description: 'Paystack payment gateway' },
      razorpay: { name: 'Razorpay', icon: '💵', description: 'Razorpay payment gateway' },
      flutterwave: { name: 'Flutterwave', icon: '🌍', description: 'Flutterwave payment gateway' },
    };
    return defaults[type];
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      setUploading(true);
      const timestamp = Date.now();
      const fileName = `payment-gateway-${timestamp}-${file.name}`;
      const storageRef = ref(storage, `payment-gateways/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      return url;
    } catch (error) {
      throw error;
    } finally {
      setUploading(false);
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
      const defaults = getGatewayDefaults(formData.type);
      
      // Build config object based on gateway type, removing undefined/empty values
      const config: PaymentGateway['config'] = {};
      
      if (formData.type === 'stripe') {
        if (formData.config.publishableKey?.trim()) config.publishableKey = formData.config.publishableKey.trim();
        if (formData.config.secretKey?.trim()) config.secretKey = formData.config.secretKey.trim();
      } else if (formData.type === 'paypal') {
        if (formData.config.clientId?.trim()) config.clientId = formData.config.clientId.trim();
        if (formData.config.clientSecret?.trim()) config.clientSecret = formData.config.clientSecret.trim();
        if (formData.config.merchantId?.trim()) config.merchantId = formData.config.merchantId.trim();
        if (formData.config.environment) config.environment = formData.config.environment;
      } else if (formData.type === 'paystack') {
        if (formData.config.publicKey?.trim()) config.publicKey = formData.config.publicKey.trim();
        if (formData.config.secretKey?.trim()) config.secretKey = formData.config.secretKey.trim();
      } else if (formData.type === 'razorpay') {
        if (formData.config.keyId?.trim()) config.keyId = formData.config.keyId.trim();
        if (formData.config.keySecret?.trim()) config.keySecret = formData.config.keySecret.trim();
      } else if (formData.type === 'flutterwave') {
        if (formData.config.publicKey?.trim()) config.publicKey = formData.config.publicKey.trim();
        if (formData.config.secretKey?.trim()) config.secretKey = formData.config.secretKey.trim();
        if (formData.config.encryptionKey?.trim()) config.encryptionKey = formData.config.encryptionKey.trim();
      }

      const gatewayData: Omit<PaymentGateway, 'id' | 'createdAt' | 'updatedAt'> = {
        type: formData.type,
        name: formData.name || defaults.name,
        isActive: formData.isActive,
        isTestMode: formData.isTestMode,
        processingFeeType: formData.processingFeeType,
        icon: formData.icon || defaults.icon,
        description: formData.description || defaults.description,
        config, // Config is required in PaymentGateway interface
        ...(formData.supportedRegions.length > 0 && { supportedRegions: formData.supportedRegions }),
        ...(formData.minAmount > 0 && { minAmount: formData.minAmount }),
        ...(formData.maxAmount > 0 && { maxAmount: formData.maxAmount }),
        ...(formData.processingFee > 0 && { processingFee: formData.processingFee }),
      };

      if (editingGateway) {
        await updatePaymentGateway(editingGateway.id!, gatewayData);
      } else {
        await createPaymentGateway(gatewayData);
      }
      setShowForm(false);
      setEditingGateway(null);
      resetForm();
      fetchGateways();
      setInfoDialogMessage(editingGateway ? (t('admin.payment_gateways_update_success') || 'Payment gateway updated successfully!') : (t('admin.payment_gateways_create_success') || 'Payment gateway created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save payment gateway
      setInfoDialogMessage(t('admin.payment_gateways_save_failed') || 'Failed to save payment gateway.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleEdit = (gateway: PaymentGateway) => {
    setEditingGateway(gateway);
    setFormData({
      type: gateway.type,
      name: gateway.name,
      isActive: gateway.isActive,
      isTestMode: gateway.isTestMode,
      config: {
        publishableKey: gateway.config.publishableKey || '',
        secretKey: '', // Don't show secret key
        clientId: gateway.config.clientId || '',
        clientSecret: '', // Don't show secret
        merchantId: gateway.config.merchantId || '',
        environment: gateway.config.environment || 'sandbox',
        publicKey: gateway.config.publicKey || '',
        keyId: gateway.config.keyId || '',
        keySecret: '', // Don't show secret
        encryptionKey: '', // Don't show secret
      },
      supportedRegions: gateway.supportedRegions || [],
      minAmount: gateway.minAmount || 0,
      maxAmount: gateway.maxAmount || 0,
      processingFee: gateway.processingFee || 0,
      processingFeeType: gateway.processingFeeType || 'fixed',
      icon: gateway.icon || '',
      description: gateway.description || '',
    });
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
    setConfirmDialogMessage(t('admin.payment_gateways_delete_confirm') || 'Are you sure you want to delete this payment gateway?');
    setConfirmDialogAction(() => async () => {
      try {
        await deletePaymentGateway(id);
        fetchGateways();
        setInfoDialogMessage(t('admin.payment_gateways_delete_success') || 'Payment gateway deleted successfully.');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete payment gateway
        setInfoDialogMessage(t('admin.payment_gateways_delete_failed') || 'Failed to delete payment gateway');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const resetForm = () => {
    setFormData({
      type: 'stripe',
      name: '',
      isActive: true,
      isTestMode: true,
      config: {
        publishableKey: '',
        secretKey: '',
        clientId: '',
        clientSecret: '',
        merchantId: '',
        environment: 'sandbox',
        publicKey: '',
        keyId: '',
        keySecret: '',
        encryptionKey: '',
      },
      supportedRegions: [],
      minAmount: 0,
      maxAmount: 0,
      processingFee: 0,
      processingFeeType: 'fixed',
      icon: '',
      description: '',
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.payment_gateways_title') || 'Payment Gateways'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.payment_gateways_subtitle') ||
              'Configure payment gateways (Stripe, PayPal, Paystack, Razorpay, Flutterwave)'}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingGateway(null);
            setShowForm(true);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.payment_gateways_new_button') || 'New Gateway'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {editingGateway
              ? t('admin.payment_gateways_form_title_edit') || 'Edit Payment Gateway'
              : t('admin.payment_gateways_form_title_create') || 'Create Payment Gateway'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.payment_gateways_field_type_label') || 'Gateway Type'}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const type = e.target.value as PaymentGatewayType;
                    const defaults = getGatewayDefaults(type);
                    setFormData({
                      ...formData,
                      type,
                      name: defaults.name,
                      icon: defaults.icon,
                      description: defaults.description,
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                >
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="paystack">Paystack</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="flutterwave">Flutterwave</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.payment_gateways_field_name_label') || 'Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.payment_gateways_field_icon_label') || 'Icon (Emoji, URL, or Image)'}
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder={
                      t('admin.payment_gateways_field_icon_placeholder') || '💳 or https://...'
                    }
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">OR</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*';
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            try {
                              setUploading(true);
                              const imageUrl = await handleFileUpload(file);
                              setFormData({ ...formData, icon: imageUrl });
                            } catch {
                              alert(t('admin.payment_gateways_image_upload_failed') || 'Failed to upload image');
                            } finally {
                              setUploading(false);
                            }
                          }
                        };
                        fileInput.click();
                      }}
                      disabled={uploading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (t('admin.common.uploading') || 'Uploading...') : (t('admin.payment_gateways_upload_image') || 'Upload Image')}
                    </button>
                  </div>
                  {formData.icon && (formData.icon.startsWith('http') || formData.icon.startsWith('/')) && (
                    <div className="mt-2">
                      <div className="w-16 h-16 border border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
                        <img
                          src={formData.icon}
                          alt="Gateway icon"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            // If image fails to load, it might be an emoji or invalid URL
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-2xl">${formData.icon || '💳'}</span>`;
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.payment_gateways_field_description_label') || 'Description'}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-bold text-gray-900 mb-3">
                {t('admin.payment_gateways_section_config_title') || 'Configuration'}
              </h3>
              
              {formData.type === 'stripe' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_stripe_publishable_key') ||
                        'Publishable Key'}
                    </label>
                    <input
                      type="text"
                      value={formData.config.publishableKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, publishableKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_stripe_secret_key') ||
                        'Secret Key'}
                    </label>
                    <input
                      type="password"
                      value={formData.config.secretKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, secretKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={editingGateway ? 'Leave blank to keep existing' : ''}
                      required={!editingGateway}
                    />
                  </div>
                </div>
              )}

              {formData.type === 'paypal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_paypal_client_id') ||
                        'Client ID'}
                    </label>
                    <input
                      type="text"
                      value={formData.config.clientId}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, clientId: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_paypal_client_secret') ||
                        'Client Secret'}
                    </label>
                    <input
                      type="password"
                      value={formData.config.clientSecret}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, clientSecret: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={editingGateway ? 'Leave blank to keep existing' : ''}
                      required={!editingGateway}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_paypal_merchant_id') ||
                        'Merchant ID'}
                    </label>
                    <input
                      type="text"
                      value={formData.config.merchantId}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, merchantId: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_paypal_environment') ||
                        'Environment'}
                    </label>
                    <select
                      value={formData.config.environment}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, environment: e.target.value as 'sandbox' | 'production' } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    >
                      <option value="sandbox">
                        {t('admin.payment_gateways_field_paypal_environment_sandbox') ||
                          'Sandbox'}
                      </option>
                      <option value="production">
                        {t('admin.payment_gateways_field_paypal_environment_production') ||
                          'Production'}
                      </option>
                    </select>
                  </div>
                </div>
              )}

              {formData.type === 'paystack' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_paystack_public_key') ||
                        'Public Key'}
                    </label>
                    <input
                      type="text"
                      value={formData.config.publicKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, publicKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_paystack_secret_key') ||
                        'Secret Key'}
                    </label>
                    <input
                      type="password"
                      value={formData.config.secretKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, secretKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={editingGateway ? 'Leave blank to keep existing' : ''}
                      required={!editingGateway}
                    />
                  </div>
                </div>
              )}

              {formData.type === 'razorpay' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_razorpay_key_id') || 'Key ID'}
                    </label>
                    <input
                      type="text"
                      value={formData.config.keyId}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, keyId: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_razorpay_key_secret') ||
                        'Key Secret'}
                    </label>
                    <input
                      type="password"
                      value={formData.config.keySecret}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, keySecret: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={editingGateway ? 'Leave blank to keep existing' : ''}
                      required={!editingGateway}
                    />
                  </div>
                </div>
              )}

              {formData.type === 'flutterwave' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_flutterwave_public_key') ||
                        'Public Key'}
                    </label>
                    <input
                      type="text"
                      value={formData.config.publicKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, publicKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_flutterwave_secret_key') ||
                        'Secret Key'}
                    </label>
                    <input
                      type="password"
                      value={formData.config.secretKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, secretKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={editingGateway ? 'Leave blank to keep existing' : ''}
                      required={!editingGateway}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.payment_gateways_field_flutterwave_encryption_key') ||
                        'Encryption Key'}
                    </label>
                    <input
                      type="password"
                      value={formData.config.encryptionKey}
                      onChange={(e) => setFormData({ ...formData, config: { ...formData.config, encryptionKey: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder={editingGateway ? 'Leave blank to keep existing' : ''}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.payment_gateways_field_min_amount_label') || 'Min Amount'}
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
                <label className="block text.sm font-medium text-gray-700 mb-1">
                  {t('admin.payment_gateways_field_max_amount_label') || 'Max Amount'}
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
                  {t('admin.payment_gateways_field_processing_fee_label') ||
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
                  {t('admin.payment_gateways_field_processing_fee_type_label') ||
                    'Processing Fee Type'}
                </label>
                <select
                  value={formData.processingFeeType}
                  onChange={(e) => setFormData({ ...formData, processingFeeType: e.target.value as 'fixed' | 'percentage' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                >
                  <option value="fixed">
                    {t('admin.payment_gateways_field_processing_fee_type_fixed') ||
                      'Fixed'}
                  </option>
                  <option value="percentage">
                    {t('admin.payment_gateways_field_processing_fee_type_percentage') ||
                      'Percentage'}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.payment_gateways_field_active_label') || 'Active'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isTestMode}
                  onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.payment_gateways_field_test_mode_label') || 'Test Mode'}
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                {editingGateway
                  ? t('admin.payment_gateways_save_button_update') || 'Update Gateway'
                  : t('admin.payment_gateways_save_button_create') || 'Create Gateway'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingGateway(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.payment_gateways_cancel_button') ||
                  t('common.cancel') ||
                  'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {gateways.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">No payment gateways found.</p>
            <p className="text-sm text-gray-400">Get started by adding your first payment gateway</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.payment_gateways_table_icon') || 'Icon'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.payment_gateways_table_name') || 'Name'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.payment_gateways_table_type') || 'Type'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.payment_gateways_table_mode') || 'Mode'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.payment_gateways_table_status') || 'Status'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.payment_gateways_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gateways.map((gateway) => (
                    <tr key={gateway.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {gateway.icon && (gateway.icon.startsWith('http') || gateway.icon.startsWith('/')) ? (
                          <div className="w-10 h-10 flex items-center justify-center">
                            <img
                              src={gateway.icon}
                              alt={gateway.name}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                // Fallback to emoji if image fails
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-2xl">${gateway.icon || '💳'}</span>`;
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-2xl">{gateway.icon || '💳'}</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{gateway.name}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{gateway.type}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          gateway.isTestMode ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {gateway.isTestMode
                            ? t('admin.payment_gateways_mode_test') || 'Test'
                            : t('admin.payment_gateways_mode_live') || 'Live'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          gateway.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {gateway.isActive
                            ? t('admin.payment_gateways_status_active') || 'Active'
                            : t('admin.payment_gateways_status_inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(gateway)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('common.edit') || 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(gateway.id!)}
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
              {gateways.map((gateway) => (
                <div key={gateway.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {gateway.icon && (gateway.icon.startsWith('http') || gateway.icon.startsWith('/')) ? (
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                          <img
                            src={gateway.icon}
                            alt={gateway.name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              // Fallback to emoji if image fails
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="text-2xl flex-shrink-0">${gateway.icon || '💳'}</span>`;
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-2xl flex-shrink-0">{gateway.icon || '💳'}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">{gateway.name}</h3>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p><span className="font-medium">Type:</span> <span className="capitalize">{gateway.type}</span></p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-3">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        gateway.isTestMode ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {gateway.isTestMode
                          ? t('admin.payment_gateways_mode_test') || 'Test'
                          : t('admin.payment_gateways_mode_live') || 'Live'}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        gateway.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {gateway.isActive
                          ? t('admin.payment_gateways_status_active') || 'Active'
                          : t('admin.payment_gateways_status_inactive') || 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(gateway)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('common.edit') || 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(gateway.id!)}
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

export default PaymentGatewaysPage;

