'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { getSettings, updateSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings, PaymentMethod } from '@/lib/firestore/settings';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const ThemePage = () => {
  const { t } = useLanguage();
  const { defaultCurrency } = useCurrency();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('logo');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      // Failed to fetch settings
      alert(t('admin.theme_fetch_failed') || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    // Check if demo mode is enabled
    if (settings.demoMode) {
      alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setSaving(false);
      return;
    }
    try {
      await updateSettings(settings);
      alert(t('admin.theme_save_success') || 'Theme settings saved successfully!');
    } catch {
      // Failed to save settings
      alert(t('admin.theme_save_failed') || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (
    section: 'colors' | 'fonts' | 'topBar',
    field: string,
    value: unknown
  ) => {
    setSettings((prev) => {
      const currentTheme = prev.theme || defaultSettings.theme;
      if (section === 'colors') {
        return {
          ...prev,
          theme: {
            ...currentTheme,
            colors: {
              ...(currentTheme.colors || defaultSettings.theme.colors),
              [field]: value,
            },
          },
        };
      }
      if (section === 'fonts') {
        return {
          ...prev,
          theme: {
            ...currentTheme,
            fonts: {
              ...(currentTheme.fonts || defaultSettings.theme.fonts),
              [field]: value,
            },
          },
        };
      }
      if (section === 'topBar') {
        const existingTopBar = currentTheme.topBar || defaultSettings.theme.topBar;
        const topBarValue = field === 'enabled' ? Boolean(value) : value;
        return {
          ...prev,
          theme: {
            ...currentTheme,
            topBar: {
              enabled: existingTopBar?.enabled ?? false,
              text: existingTopBar?.text ?? '',
              backgroundColor: existingTopBar?.backgroundColor ?? '#000000',
              textColor: existingTopBar?.textColor ?? '#ffffff',
              [field]: topBarValue,
            },
          },
        };
      }
      return prev;
    });
  };

  const handleFileUpload = async (
    file: File,
    field: 'logoUrl' | 'faviconUrl' | 'loginImageUrl' | string
  ): Promise<string> => {
    if (!file) {
      throw new Error('No file provided');
    }

    const fieldKey = field === 'logoUrl' || field === 'faviconUrl' || field === 'loginImageUrl' ? field : 'custom';
    setUploading((prev) => ({ ...prev, [fieldKey]: true }));
    try {
      const storagePath = field === 'logoUrl' || field === 'faviconUrl' || field === 'loginImageUrl' 
        ? `theme/${field}_${Date.now()}_${file.name}`
        : `${field}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (field === 'logoUrl' || field === 'faviconUrl' || field === 'loginImageUrl') {
        setSettings((prev) => ({
          ...prev,
          theme: {
            ...prev.theme,
            [field]: url,
          },
        }));
      }
      
      return url;
    } catch {
      // Failed to upload image
      alert(t('admin.settings.upload_image_failed') || 'Failed to upload image');
      throw new Error('Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const tabs = [
    { id: 'logo', label: t('admin.theme_tab_logo') || 'App Logo & Favicon' },
    { id: 'login', label: t('admin.theme_tab_login') || 'Login Image' },
    { id: 'colors', label: t('admin.theme_tab_colors') || 'Website Colors' },
    { id: 'fonts', label: t('admin.theme_tab_fonts') || 'Website Fonts' },
    { id: 'topbar', label: t('admin.theme_tab_topbar') || 'Top Bar' },
    { id: 'payment', label: t('admin.theme_tab_payment') || 'Payment Methods' },
  ];

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Montserrat', label: 'Montserrat' },
  ];

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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          {t('admin.theme_title') || t('admin.theme') || 'Theme Settings'}
        </h1>
        <p className="text-gray-500 text-sm">{t('admin.theme_subtitle') || "Customize your store's appearance and branding"}</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 flex-wrap overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-all focus:outline-none ${
                activeTab === tab.id
                  ? 'border-black text-black bg-gray-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 md:p-8">
          {/* App Logo & Favicon */}
          {activeTab === 'logo' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {t('admin.theme_logo_section_title') || 'App Logo & Favicon'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t('admin.theme_logo_section_subtitle') ||
                    'Update your brand assets and visual identity.'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-8">
                {/* Logo Upload */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <label className="block text-base font-bold text-gray-900 mb-1">
                        {t('admin.theme_logo_website_label') || 'Website Logo'}
                      </label>
                      <p className="text-sm text-gray-500">
                        {t('admin.theme_logo_website_hint') ||
                          'Displayed in the header. Recommended size: 200x60px (PNG/SVG).'
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-40 bg-white border border-gray-200 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-xs font-medium overflow-hidden relative">
                        {settings.theme.logoUrl ? (
                          <Image src={settings.theme.logoUrl} alt="Logo" fill className="object-contain" unoptimized />
                        ) : (
                          t('admin.theme_logo_preview') || 'Preview'
                        )}
                        {uploading.logoUrl && (
                          <div className="absolute inset-0 bg-black/50 flex.items-center justify-center text-white text-xs">
                            {t('admin.theme_logo_uploading') || 'Uploading...'}
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors shadow-sm">
                        {t('admin.theme_logo_change_button') || 'Change'}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logoUrl')}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Favicon Upload */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <label className="block text-base font-bold text-gray-900 mb-1">
                        {t('admin.theme_logo_favicon_label') || 'Favicon'}
                      </label>
                      <p className="text-sm text-gray-500">
                        {t('admin.theme_logo_favicon_hint') ||
                          'Browser tab icon. Recommended size: 32x32px (ICO/PNG).'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white border border-gray-200 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-xs font-medium overflow-hidden relative">
                        {settings.theme.faviconUrl ? (
                          <Image src={settings.theme.faviconUrl} alt="Favicon" fill className="object-contain" unoptimized />
                        ) : (
                          t('admin.theme_logo_favicon_placeholder') || '32x32'
                        )}
                        {uploading.faviconUrl && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs">
                            {t('admin.theme_logo_uploading') || 'Uploading...'}
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors shadow-sm">
                        {t('admin.theme_logo_change_button') || 'Change'}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'faviconUrl')}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Login Image */}
          {activeTab === 'login' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {t('admin.theme_login_section_title') || 'Login Image'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t('admin.theme_login_section_subtitle') ||
                    'Upload an image to display on the login page.'}
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <label className="block text-base font-bold text-gray-900 mb-1">
                      {t('admin.theme_login_label') || 'Login Page Image'}
                    </label>
                    <p className="text-sm text-gray-500">
                      {t('admin.theme_login_hint') ||
                        'Recommended size: 800x600px (JPG/PNG).'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-32 w-48 bg-white border border-gray-200 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-xs font-medium overflow-hidden relative">
                      {settings.theme.loginImageUrl ? (
                        <Image src={settings.theme.loginImageUrl} alt="Login Image" fill className="object-cover" unoptimized />
                      ) : (
                        t('admin.theme_logo_preview') || 'Preview'
                      )}
                      {uploading.loginImageUrl && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs">{t('admin.theme_logo_uploading') || 'Uploading...'}</div>
                      )}
                    </div>
                    <label className="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors shadow-sm">
                      {settings.theme.loginImageUrl
                        ? t('admin.theme_login_upload_button_change') || 'Change'
                        : t('admin.theme_login_upload_button_upload') || 'Upload'}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'loginImageUrl')}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Website Colors */}
          {activeTab === 'colors' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {t('admin.theme_colors_section_title') || 'Website Colors'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t('admin.theme_colors_section_subtitle') ||
                    'Customize the color scheme of your website.'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_header_background') || 'Header Background'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.headerBackground || '#ffffff'}
                      onChange={(e) => handleInputChange('colors', 'headerBackground', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.headerBackground || '#ffffff'}
                      onChange={(e) => handleInputChange('colors', 'headerBackground', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_header_text') || 'Header Text'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.headerText || '#000000'}
                      onChange={(e) => handleInputChange('colors', 'headerText', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.headerText || '#000000'}
                      onChange={(e) => handleInputChange('colors', 'headerText', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_footer_background') || 'Footer Background'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.footerBackground || '#1f2937'}
                      onChange={(e) => handleInputChange('colors', 'footerBackground', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.footerBackground || '#1f2937'}
                      onChange={(e) => handleInputChange('colors', 'footerBackground', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_footer_text') || 'Footer Text'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.footerText || '#ffffff'}
                      onChange={(e) => handleInputChange('colors', 'footerText', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.footerText || '#ffffff'}
                      onChange={(e) => handleInputChange('colors', 'footerText', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_primary_button') || 'Primary Button'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.primaryButton || '#000000'}
                      onChange={(e) => handleInputChange('colors', 'primaryButton', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.primaryButton || '#000000'}
                      onChange={(e) => handleInputChange('colors', 'primaryButton', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_primary_button_text') ||
                      'Primary Button Text'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.primaryButtonText || '#ffffff'}
                      onChange={(e) => handleInputChange('colors', 'primaryButtonText', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.primaryButtonText || '#ffffff'}
                      onChange={(e) => handleInputChange('colors', 'primaryButtonText', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_secondary_button') || 'Secondary Button'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.secondaryButton || '#f3f4f6'}
                      onChange={(e) => handleInputChange('colors', 'secondaryButton', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.secondaryButton || '#f3f4f6'}
                      onChange={(e) => handleInputChange('colors', 'secondaryButton', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_colors_secondary_button_text') ||
                      'Secondary Button Text'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.theme.colors?.secondaryButtonText || '#000000'}
                      onChange={(e) => handleInputChange('colors', 'secondaryButtonText', e.target.value)}
                      className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.theme.colors?.secondaryButtonText || '#000000'}
                      onChange={(e) => handleInputChange('colors', 'secondaryButtonText', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Website Fonts */}
          {activeTab === 'fonts' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {t('admin.theme_fonts_section_title') || 'Website Fonts'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t('admin.theme_fonts_section_subtitle') ||
                    'Choose fonts for headings and body text.'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_fonts_heading_label') || 'Heading Font'}
                  </label>
                  <select 
                    value={settings.theme.fonts?.heading || 'Inter'}
                    onChange={(e) => handleInputChange('fonts', 'heading', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                  >
                    {fontOptions.map(font => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('admin.theme_fonts_body_label') || 'Body Font'}
                  </label>
                  <select 
                    value={settings.theme.fonts?.body || 'Inter'}
                    onChange={(e) => handleInputChange('fonts', 'body', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                  >
                    {fontOptions.map(font => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Top Bar */}
          {activeTab === 'topbar' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {t('admin.theme_topbar_section_title') || 'Top Bar'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t('admin.theme_topbar_section_subtitle') ||
                    'Configure the promotional banner at the top of your website.'}
                </p>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center p-4 border border-gray-200 rounded-lg">
                  <input 
                    type="checkbox" 
                    checked={settings.theme.topBar?.enabled || false}
                    onChange={(e) => handleInputChange('topBar', 'enabled', e.target.checked)}
                    className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black" 
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">
                      {t('admin.theme_topbar_enabled_label') || 'Enable Top Bar'}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {t('admin.theme_topbar_enabled_hint') ||
                        'Show promotional message at the top of the website'}
                    </span>
                  </div>
                </div>

                {settings.theme.topBar?.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('admin.theme_topbar_message_label') || 'Message Text'}
                      </label>
                      <input 
                        type="text" 
                        value={settings.theme.topBar?.text || ''}
                        onChange={(e) => handleInputChange('topBar', 'text', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder={
                        t('admin.theme_topbar_message_placeholder') ||
                        `FREE SHIPPING ON ORDERS OVER ${defaultCurrency?.symbol || ''} 5000`
                      }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('admin.theme_topbar_background_label') || 'Background Color'}
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={settings.theme.topBar?.backgroundColor || '#000000'}
                            onChange={(e) => handleInputChange('topBar', 'backgroundColor', e.target.value)}
                            className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                          />
                          <input 
                            type="text" 
                            value={settings.theme.topBar?.backgroundColor || '#000000'}
                            onChange={(e) => handleInputChange('topBar', 'backgroundColor', e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('admin.theme_topbar_text_label') || 'Text Color'}
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={settings.theme.topBar?.textColor || '#ffffff'}
                            onChange={(e) => handleInputChange('topBar', 'textColor', e.target.value)}
                            className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                          />
                          <input 
                            type="text" 
                            value={settings.theme.topBar?.textColor || '#ffffff'}
                            onChange={(e) => handleInputChange('topBar', 'textColor', e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Payment Methods */}
          {activeTab === 'payment' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('admin.theme_payment_methods_title') || 'Payment Methods'}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  {t('admin.theme_payment_methods_subtitle') || 'Add payment method icons that will be displayed in the footer'}
                </p>

                {/* Add New Payment Method */}
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    {t('admin.theme_payment_add_new') || 'Add New Payment Method'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.theme_payment_name') || 'Payment Method Name'}
                      </label>
                      <input
                        type="text"
                        id="newPaymentName"
                        placeholder={t('admin.theme_payment_name_placeholder') || 'e.g., Visa, Mastercard, PayPal'}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.theme_payment_image') || 'Payment Method Image'}
                      </label>
                      <input
                        type="file"
                        id="newPaymentImage"
                        accept="image/*"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const nameInput = document.getElementById('newPaymentName') as HTMLInputElement;
                      const imageInput = document.getElementById('newPaymentImage') as HTMLInputElement;
                      const name = nameInput?.value.trim();
                      const imageFile = imageInput?.files?.[0];

                      if (!name) {
                        alert(t('admin.theme_payment_name_required') || 'Please enter payment method name');
                        return;
                      }
                      if (!imageFile) {
                        alert(t('admin.theme_payment_image_required') || 'Please select an image');
                        return;
                      }

                      // Check if demo mode is enabled
                      if (settings.demoMode) {
                        alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                        return;
                      }
                      try {
                        setUploading((prev) => ({ ...prev, 'newPayment': true }));
                        
                        const imageUrl = await handleFileUpload(imageFile, 'payment-methods');
                        
                        const newPaymentMethod: PaymentMethod = {
                          id: Date.now().toString(),
                          name,
                          imageUrl,
                          order: (settings.theme.paymentMethods?.length || 0) + 1,
                        };
                        const updatedSettings = {
                          ...settings,
                          theme: {
                            ...settings.theme,
                            paymentMethods: [...(settings.theme.paymentMethods || []), newPaymentMethod],
                          },
                        };
                        setSettings(updatedSettings);
                        
                        // Save to Firestore immediately
                        await updateSettings(updatedSettings);

                        nameInput.value = '';
                        imageInput.value = '';
                        alert(t('admin.theme_payment_added') || 'Payment method added successfully!');
                      } catch {
                        alert(t('admin.theme_payment_add_failed') || 'Failed to add payment method.');
                      } finally {
                        setUploading((prev) => ({ ...prev, 'newPayment': false }));
                      }
                    }}
                    disabled={uploading['newPayment']}
                    className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading['newPayment'] ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('admin.common.uploading') || 'Uploading...'}
                      </>
                    ) : (
                      t('admin.theme_payment_add_button') || 'Add Payment Method'
                    )}
                  </button>
                </div>

                {/* Existing Payment Methods */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {t('admin.theme_payment_existing') || 'Existing Payment Methods'}
                  </h3>
                  {settings.theme.paymentMethods && settings.theme.paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {settings.theme.paymentMethods.map((method) => (
                        <div key={method.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-white">
                          <div className="flex-shrink-0">
                            {method.imageUrl ? (
                              <Image
                                src={method.imageUrl}
                                alt={method.name}
                                width={60}
                                height={40}
                                className="object-contain rounded border border-gray-200 bg-white p-2"
                              />
                            ) : (
                              <div className="w-[60px] h-[40px] border border-gray-200 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{method.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{method.imageUrl}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                // Check if demo mode is enabled
                                if (settings.demoMode) {
                                  alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                                  return;
                                }
                                const newName = prompt(t('admin.theme_payment_edit_name') || 'Enter new name:', method.name);
                                if (newName && newName.trim()) {
                                  try {
                                    const updatedSettings = {
                                      ...settings,
                                      theme: {
                                        ...settings.theme,
                                        paymentMethods: settings.theme.paymentMethods?.map((pm) =>
                                          pm.id === method.id ? { ...pm, name: newName.trim() } : pm
                                        ),
                                      },
                                    };
                                    setSettings(updatedSettings);
                                    await updateSettings(updatedSettings);
                                  } catch {
                                    alert(t('admin.theme_payment_add_failed') || 'Failed to update payment method');
                                  }
                                }
                              }}
                              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                            >
                              {t('admin.common.edit') || 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const fileInput = document.createElement('input');
                                fileInput.type = 'file';
                                fileInput.accept = 'image/*';
                                fileInput.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) {
                                    // Check if demo mode is enabled
                                    if (settings.demoMode) {
                                      alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                                      return;
                                    }
                                    try {
                                      setUploading((prev) => ({ ...prev, [`payment-${method.id}`]: true }));
                                      const imageUrl = await handleFileUpload(file, 'payment-methods');
                                      const updatedSettings = {
                                        ...settings,
                                        theme: {
                                          ...settings.theme,
                                          paymentMethods: settings.theme.paymentMethods?.map((pm) =>
                                            pm.id === method.id ? { ...pm, imageUrl } : pm
                                          ),
                                        },
                                      };
                                      setSettings(updatedSettings);
                                      await updateSettings(updatedSettings);
                                    } catch {
                                      alert(t('admin.theme_payment_image_update_failed') || 'Failed to update image');
                                    } finally {
                                      setUploading((prev) => ({ ...prev, [`payment-${method.id}`]: false }));
                                    }
                                  }
                                };
                                fileInput.click();
                              }}
                              disabled={uploading[`payment-${method.id}`]}
                              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              {uploading[`payment-${method.id}`] ? (
                                t('admin.common.uploading') || 'Uploading...'
                              ) : (
                                t('admin.theme_payment_change_image') || 'Change Image'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                // Check if demo mode is enabled
                                if (settings.demoMode) {
                                  alert(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                                  return;
                                }
                                if (confirm(t('admin.theme_payment_delete_confirm') || `Are you sure you want to delete ${method.name}?`)) {
                                  try {
                                    const updatedSettings = {
                                      ...settings,
                                      theme: {
                                        ...settings.theme,
                                        paymentMethods: settings.theme.paymentMethods?.filter((pm) => pm.id !== method.id),
                                      },
                                    };
                                    setSettings(updatedSettings);
                                    await updateSettings(updatedSettings);
                                  } catch {
                                    alert(t('admin.theme_payment_add_failed') || 'Failed to delete payment method');
                                  }
                                }
                              }}
                              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                            >
                              {t('admin.common.delete') || 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      {t('admin.theme_payment_no_methods') || 'No payment methods added yet. Add one above to get started.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 sm:mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={fetchSettings}
              className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
              disabled={saving}
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`w-full sm:w-auto px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Theme Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePage;

