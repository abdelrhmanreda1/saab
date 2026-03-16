'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSettings, updateSettings } from '@/lib/firestore/settings_db';
import {
  defaultSettings,
  normalizeGoldPricingSettings,
  Settings,
} from '@/lib/firestore/settings';
import Switch from '@/components/Switch';
import { useLanguage } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { getCountries } from '@/lib/firestore/geography_db';
import { Country } from '@/lib/firestore/geography';

const SettingsPage = () => {
  const { t } = useLanguage();
  const { settings: appSettings } = useSettings();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingGoldPrice, setRefreshingGoldPrice] = useState(false);
  const [testingSMTP, setTestingSMTP] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogType, setDialogType] = useState<'success' | 'error'>('success');

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
        setSettings({
          ...defaultSettings,
          ...data,
          goldPricing: normalizeGoldPricingSettings(data.goldPricing),
        });
      }
    } catch {
      // Failed to fetch settings
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

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const countriesData = await getCountries();
        setCountries(countriesData);
      } catch {
        // Failed to fetch countries
        setCountries([]);
      }
    };
    fetchCountries();
  }, []);

  const handleSave = async () => {
    // Check if demo mode is enabled
    if (appSettings?.demoMode) {
      setDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings cannot be saved in demo mode.');
      setDialogType('error');
      setShowDialog(true);
      return;
    }

    setSaving(true);
    try {
      await updateSettings(settings);
      setDialogMessage(t('admin.settings.save_success') || 'Settings saved successfully!');
      setDialogType('success');
      setShowDialog(true);
    } catch {
      // Failed to save settings
      setDialogMessage(t('admin.settings.save_failed') || 'Failed to save settings');
      setDialogType('error');
      setShowDialog(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshGoldPrice = async () => {
    setRefreshingGoldPrice(true);
    try {
      const response = await fetch('/api/gold-price?refresh=1');
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to refresh gold price');
      }

      await fetchSettings();
      setDialogMessage(
        `Gold price updated: ${result.pricePerGram} ${result.currency || 'SAR'} / gram`
      );
      setDialogType('success');
      setShowDialog(true);
    } catch (error) {
      setDialogMessage(error instanceof Error ? error.message : 'Failed to refresh gold price');
      setDialogType('error');
      setShowDialog(true);
    } finally {
      setRefreshingGoldPrice(false);
    }
  };

  const handleInputChange = (
    section: keyof Settings,
    field: string,
    value: unknown
  ) => {
    setSettings((prev) => {
      if (section === 'seo') {
        return {
          ...prev,
          seo: {
            ...(prev.seo || {}),
            [field]: value,
          } as Settings['seo'],
        };
      }
      if (section === 'payment') {
        return {
          ...prev,
          payment: {
            ...(prev.payment || {}),
            [field]: value,
          } as Settings['payment'],
        };
      }
      if (section === 'emailNotifications') {
        return {
          ...prev,
          emailNotifications: {
            ...(prev.emailNotifications || {}),
            [field]: value,
          } as Settings['emailNotifications'],
        };
      }
      if (section === 'site') {
        const prevSite = prev.site || defaultSettings.site;
        const nextSite = {
          ...prevSite,
          [field]: value,
        } as Settings['site'];

        // Ensure at least one login option (phone / google / email) remains enabled
        if (
          field === 'enablePhoneLogin' ||
          field === 'enableGoogleLogin' ||
          field === 'enableEmailLogin'
        ) {
          const phoneEnabled = nextSite.enablePhoneLogin !== false;
          const googleEnabled = nextSite.enableGoogleLogin !== false;
          const emailEnabled = nextSite.enableEmailLogin !== false;

          if (!phoneEnabled && !googleEnabled && !emailEnabled) {
            setDialogMessage(
              t('admin.settings_site_login_options_error') ||
                'At least one login option (Phone, Google, or Email) must be enabled.'
            );
            setDialogType('error');
            setShowDialog(true);
            return prev; // Block change
          }
        }

        return {
          ...prev,
          site: nextSite,
        };
      }

      const currentSection = prev[section];
      return {
        ...prev,
        [section]: {
          ...(currentSection as unknown as Record<string, unknown>),
          [field]: value,
        },
      };
    });
  };


  const tabs = [
    { id: 'company', label: t('admin.settings_tab_company') || 'Company' },
    { id: 'site', label: t('admin.settings_tab_site') || 'Site Configuration' },
    { id: 'seo', label: t('admin.settings_tab_seo') || 'SEO Settings' },
    { id: 'smtp', label: t('admin.settings_tab_smtp') || 'SMTP' },
    {
      id: 'emailNotifications',
      label: t('admin.settings_tab_email_notifications') || 'Email Notifications',
    },
    { id: 'social', label: t('admin.settings_tab_social') || 'Social Media' },
    { id: 'goldPricing', label: 'Gold Pricing' },
    { id: 'features', label: t('admin.settings_tab_features') || 'Features' },
    { id: 'pages', label: t('admin.settings_tab_pages') || 'Pages' },
    { id: 'geography', label: t('admin.settings_tab_geography') || 'Geography' },
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
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          {t('admin.settings') || 'Settings'}
        </h1>
        <p className="text-gray-500 text-sm">{t('admin.settings_subtitle') || 'Manage your store settings and configuration'}</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Mobile Tabs - Scrollable */}
          <div className="md:hidden overflow-x-auto border-b border-gray-200">
            <div className="flex min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-xs transition-all focus:outline-none ${
                    activeTab === tab.id
                      ? 'border-gray-900 text-gray-900 bg-gray-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden md:flex border-b border-gray-200 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-all focus:outline-none ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900 bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            {/* Company Settings */}
            {activeTab === 'company' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {t('admin.settings_company_title') || 'Company Information'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {t('admin.settings_company_subtitle') ||
                        'Enter your business details to be displayed on invoices and contact pages.'}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_name') || 'Company Name'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.name || ''}
                      onChange={(e) => handleInputChange('company', 'name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="e.g. Pardah" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_email') || 'Email Address'}
                    </label>
                    <input 
                      type="email" 
                      value={settings.company.email || ''}
                      onChange={(e) => handleInputChange('company', 'email', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="contact@company.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_phone') || 'Phone Number'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.phone || ''}
                      onChange={(e) => handleInputChange('company', 'phone', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="+92 300 1234567" 
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_website') || 'Website URL'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.website || ''}
                      onChange={(e) => handleInputChange('company', 'website', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="https://www.pardah.com" 
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_company_website_hint', {
                        example: settings.company.website || 'https://example.com',
                      }) ||
                        `This URL will be used for generating canonical URLs on product pages (e.g., ${
                          settings.company.website || 'https://example.com'
                        }/products/product-slug)`}
                    </p>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_address') || 'Address'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.address || ''}
                      onChange={(e) => handleInputChange('company', 'address', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="Street address, building number, etc." 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_city') || 'City'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.city || ''}
                      onChange={(e) => handleInputChange('company', 'city', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_state') || 'State/Province'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.state || ''}
                      onChange={(e) => handleInputChange('company', 'state', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_country_code') || 'Country Code'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.countryCode || ''}
                      onChange={(e) => handleInputChange('company', 'countryCode', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_company_zip') || 'Zip Code'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.company.zipCode || ''}
                      onChange={(e) => handleInputChange('company', 'zipCode', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'seo' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {t('admin.settings_seo_title') || 'SEO Settings'}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {t('admin.settings_seo_subtitle') ||
                      'Configure search engine optimization settings for your store.'}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_site_title') || 'Site Title'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.siteTitle || ''}
                      onChange={(e) => handleInputChange('seo', 'siteTitle', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="Pardah - Elegant Abayas & Fashion" 
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_site_description') || 'Site Description'}
                    </label>
                    <textarea 
                      value={settings.seo?.siteDescription || ''}
                      onChange={(e) => handleInputChange('seo', 'siteDescription', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all h-24 resize-none" 
                      placeholder="Discover the latest collection of elegant abayas..."
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_keywords') || 'Keywords (comma-separated)'}
                    </label>
                    <input 
                      type="text" 
                      value={Array.isArray(settings.seo?.siteKeywords) ? settings.seo.siteKeywords.join(', ') : ''}
                      onChange={(e) => handleInputChange('seo', 'siteKeywords', e.target.value.split(',').map(k => k.trim()).filter(k => k))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="abaya, modest fashion, islamic clothing" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_og_site_name') || 'Open Graph Site Name'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.ogSiteName || ''}
                      onChange={(e) => handleInputChange('seo', 'ogSiteName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="Pardah" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_og_locale') || 'Open Graph Locale'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.ogLocale || ''}
                      onChange={(e) => handleInputChange('seo', 'ogLocale', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="en_US" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_twitter_card') || 'Twitter Card Type'}
                    </label>
                    <select 
                      value={settings.seo?.twitterCard || 'summary_large_image'}
                      onChange={(e) => handleInputChange('seo', 'twitterCard', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                    >
                      <option value="summary">{t('admin.settings_seo_twitter_summary') || 'Summary'}</option>
                      <option value="summary_large_image">
                        {t('admin.settings_seo_twitter_summary_large') || 'Summary Large Image'}
                      </option>
                      <option value="app">{t('admin.settings_seo_twitter_app') || 'App'}</option>
                      <option value="player">
                        {t('admin.settings_seo_twitter_player') || 'Player'}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_org_name') || 'Organization Name'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.organizationName || ''}
                      onChange={(e) => handleInputChange('seo', 'organizationName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="Pardah" 
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_org_url') || 'Organization URL'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.organizationUrl || ''}
                      onChange={(e) => handleInputChange('seo', 'organizationUrl', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="https://www.pardah.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_ga_id') || 'Google Analytics ID'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.googleAnalyticsId || ''}
                      onChange={(e) => handleInputChange('seo', 'googleAnalyticsId', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="G-XXXXXXXXXX" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_gtm_id') || 'Google Tag Manager ID'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.googleTagManagerId || ''}
                      onChange={(e) => handleInputChange('seo', 'googleTagManagerId', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="GTM-XXXXXXX" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_fb_pixel') || 'Facebook Pixel ID'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.facebookPixelId || ''}
                      onChange={(e) => handleInputChange('seo', 'facebookPixelId', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="123456789012345" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_google_verification') || 'Google Verification Code'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.googleVerificationCode || ''}
                      onChange={(e) => handleInputChange('seo', 'googleVerificationCode', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="Verification code from Google Search Console" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_seo_bing_verification') || 'Bing Verification Code'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo?.bingVerificationCode || ''}
                      onChange={(e) => handleInputChange('seo', 'bingVerificationCode', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="Verification code from Bing Webmaster Tools" 
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <Switch
                      label={t('admin.settings_seo_sitemap') || 'Enable Sitemap'}
                      checked={settings.seo?.sitemapEnabled ?? true}
                      onChange={(e) =>
                        handleInputChange('seo', 'sitemapEnabled', e.target.checked)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'geography' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {t('admin.settings_geography_title') || 'Geography Settings'}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {t('admin.settings_geography_subtitle') ||
                      'Configure geographical settings for your store.'}
                  </p>
                </div>
                <Switch
                  label={t('admin.settings_geography_countries') || 'Countries'}
                  checked={settings.geography.countries}
                  onChange={(e) =>
                    handleInputChange('geography', 'countries', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_geography_states') || 'States'}
                  checked={settings.geography.states}
                  onChange={(e) =>
                    handleInputChange('geography', 'states', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_geography_cities') || 'Cities'}
                  checked={settings.geography.cities}
                  onChange={(e) =>
                    handleInputChange('geography', 'cities', e.target.checked)
                  }
                />
              </div>
            )}

            {activeTab === 'pages' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {t('admin.settings_pages_title') || 'Pages Settings'}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {t('admin.settings_pages_subtitle') ||
                      'Enable or disable various informational pages on your site.'}
                  </p>
                </div>
                <Switch
                  label={t('admin.settings_pages_about') || 'About Us'}
                  checked={settings.pages.aboutUs}
                  onChange={(e) =>
                    handleInputChange('pages', 'aboutUs', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_privacy') || 'Privacy Policy'}
                  checked={settings.pages.privacyPolicy}
                  onChange={(e) =>
                    handleInputChange('pages', 'privacyPolicy', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_terms') || 'Terms of Service'}
                  checked={settings.pages.termsOfService}
                  onChange={(e) =>
                    handleInputChange('pages', 'termsOfService', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_shipping_returns') || 'Shipping & Returns'}
                  checked={settings.pages.shippingReturns}
                  onChange={(e) =>
                    handleInputChange(
                      'pages',
                      'shippingReturns',
                      e.target.checked
                    )
                  }
                />
                <Switch
                  label={t('admin.settings_pages_size_guide') || 'Size Guide'}
                  checked={settings.pages.sizeGuide}
                  onChange={(e) =>
                    handleInputChange('pages', 'sizeGuide', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_store_locator') || 'Store Locator'}
                  checked={settings.pages.storeLocator}
                  onChange={(e) =>
                    handleInputChange('pages', 'storeLocator', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_careers') || 'Careers'}
                  checked={settings.pages.careers}
                  onChange={(e) =>
                    handleInputChange('pages', 'careers', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_faqs') || 'FAQs'}
                  checked={settings.pages.faqs}
                  onChange={(e) =>
                    handleInputChange('pages', 'faqs', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_pages_contact') || 'Contact Us'}
                  checked={settings.pages.contactUs}
                  onChange={(e) =>
                    handleInputChange('pages', 'contactUs', e.target.checked)
                  }
                />
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {t('admin.settings_features_title') || 'Features Settings'}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {t('admin.settings_features_subtitle') ||
                      'Control the visibility and functionality of various features across your store.'}
                  </p>
                </div>
                <Switch
                  label={t('admin.settings_features_category') || 'Category'}
                  checked={settings.features.category}
                  onChange={(e) =>
                    handleInputChange('features', 'category', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_brands') || 'Brands'}
                  checked={settings.features.brands}
                  onChange={(e) =>
                    handleInputChange('features', 'brands', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_collections') || 'Collections'}
                  checked={settings.features.collections}
                  onChange={(e) =>
                    handleInputChange('features', 'collections', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_size') || 'Size'}
                  checked={settings.features.size}
                  onChange={(e) =>
                    handleInputChange('features', 'size', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_colors') || 'Colors'}
                  checked={settings.features.colors}
                  onChange={(e) =>
                    handleInputChange('features', 'colors', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_banners') || 'Banners'}
                  checked={settings.features.banners}
                  onChange={(e) =>
                    handleInputChange('features', 'banners', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_coupons') || 'Coupons'}
                  checked={settings.features.coupons}
                  onChange={(e) =>
                    handleInputChange('features', 'coupons', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_email_marketing') || 'Email Marketing'}
                  checked={settings.features.emailMarketing}
                  onChange={(e) =>
                    handleInputChange(
                      'features',
                      'emailMarketing',
                      e.target.checked
                    )
                  }
                />
                <Switch
                  label={t('admin.settings_features_notifications') || 'Notifications'}
                  checked={settings.features.notifications}
                  onChange={(e) =>
                    handleInputChange(
                      'features',
                      'notifications',
                      e.target.checked
                    )
                  }
                />
                <Switch
                  label={t('admin.settings_features_blog') || 'Blog'}
                  checked={settings.features.blog}
                  onChange={(e) =>
                    handleInputChange('features', 'blog', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_wishlist') || 'Wishlist'}
                  checked={settings.features.wishlist}
                  onChange={(e) =>
                    handleInputChange('features', 'wishlist', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_product_reviews') || 'Product Reviews'}
                  checked={settings.features.productReviews}
                  onChange={(e) =>
                    handleInputChange('features', 'productReviews', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_product_bundles') || 'Product Bundles'}
                  checked={settings.features.productBundles}
                  onChange={(e) =>
                    handleInputChange('features', 'productBundles', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_product_templates') || 'Product Templates'}
                  checked={settings.features.productTemplates}
                  onChange={(e) =>
                    handleInputChange('features', 'productTemplates', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_recently_viewed') || 'Recently Viewed'}
                  checked={settings.features.recentlyViewed}
                  onChange={(e) =>
                    handleInputChange('features', 'recentlyViewed', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_product_recommendations') || 'Product Recommendations'}
                  checked={settings.features.productRecommendations}
                  onChange={(e) =>
                    handleInputChange('features', 'productRecommendations', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_import_export') || 'Import/Export'}
                  checked={settings.features.importExport}
                  onChange={(e) =>
                    handleInputChange('features', 'importExport', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_abandoned_carts') || 'Abandoned Carts'}
                  checked={settings.features.abandonedCarts}
                  onChange={(e) =>
                    handleInputChange('features', 'abandonedCarts', e.target.checked)
                  }
                />
                <Switch
                  label={t('admin.settings_features_customer_segmentation') || 'Customer Segmentation'}
                  checked={settings.features.customerSegmentation}
                  onChange={(e) =>
                    handleInputChange('features', 'customerSegmentation', e.target.checked)
                  }
                />
              </div>
            )}

            {/* Site Settings */}
            {activeTab === 'site' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {t('admin.settings_site_title') || 'Site Configuration'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {t('admin.settings_site_subtitle') ||
                        'Manage general site settings, localization, and features.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_site_date_format') || 'Date Format'}
                    </label>
                    <select 
                      value={settings.site.dateFormat || 'DD-MM-YYYY'}
                      onChange={(e) => handleInputChange('site', 'dateFormat', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                      <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_site_time_format') || 'Time Format'}
                    </label>
                    <select 
                      value={settings.site.timeFormat || '12 Hour'}
                      onChange={(e) => handleInputChange('site', 'timeFormat', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="12 Hour">12 Hour</option>
                      <option value="24 Hour">24 Hour</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_site_timezone') || 'Default Timezone'}
                    </label>
                    <select 
                      value={settings.site.timezone || 'Asia/Karachi'}
                      onChange={(e) => handleInputChange('site', 'timezone', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                    >
                      {/* UTC */}
                      <option value="UTC">UTC</option>

                      {/* Africa */}
                      <option value="Africa/Cairo">Africa/Cairo</option>
                      <option value="Africa/Johannesburg">Africa/Johannesburg</option>
                      <option value="Africa/Lagos">Africa/Lagos</option>
                      <option value="Africa/Nairobi">Africa/Nairobi</option>

                      {/* Americas */}
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="America/Denver">America/Denver (MST)</option>
                      <option value="America/Chicago">America/Chicago (CST)</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                      <option value="America/Mexico_City">America/Mexico_City</option>
                      <option value="America/Toronto">America/Toronto</option>
                      <option value="America/Vancouver">America/Vancouver</option>

                      {/* Europe */}
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Europe/Berlin">Europe/Berlin</option>
                      <option value="Europe/Madrid">Europe/Madrid</option>
                      <option value="Europe/Rome">Europe/Rome</option>
                      <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                      <option value="Europe/Stockholm">Europe/Stockholm</option>
                      <option value="Europe/Istanbul">Europe/Istanbul</option>
                      <option value="Europe/Moscow">Europe/Moscow</option>

                      {/* Middle East / Asia */}
                      <option value="Asia/Dubai">Asia/Dubai</option>
                      <option value="Asia/Riyadh">Asia/Riyadh</option>
                      <option value="Asia/Tehran">Asia/Tehran</option>
                      <option value="Asia/Karachi">Asia/Karachi</option>
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                      <option value="Asia/Dhaka">Asia/Dhaka</option>
                      <option value="Asia/Bangkok">Asia/Bangkok</option>
                      <option value="Asia/Singapore">Asia/Singapore</option>
                      <option value="Asia/Hong_Kong">Asia/Hong_Kong</option>
                      <option value="Asia/Shanghai">Asia/Shanghai</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Asia/Seoul">Asia/Seoul</option>
                      <option value="Asia/Jakarta">Asia/Jakarta</option>
                      <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur</option>

                      {/* Oceania */}
                      <option value="Australia/Sydney">Australia/Sydney</option>
                      <option value="Australia/Melbourne">Australia/Melbourne</option>
                      <option value="Pacific/Auckland">Pacific/Auckland</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_site_default_country') || 'Default Country'}
                    </label>
                    <select 
                      value={settings.site.defaultCountry || 'PK'}
                      onChange={(e) => handleInputChange('site', 'defaultCountry', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                    >
                      {countries.length > 0 ? (
                        countries
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((country) => (
                            <option key={country.id} value={country.isoCode}>
                              {country.name} ({country.isoCode})
                            </option>
                          ))
                      ) : (
                        <option value="PK">Pakistan (PK)</option>
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_site_default_country_hint') || 'This country will be used as default for phone number inputs across the site.'}
                    </p>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_site_copyright') || 'Copyright Text'}
                    </label>
                    <input 
                      type="text" 
                      value={settings.site.copyrightText || ''}
                      onChange={(e) => handleInputChange('site', 'copyrightText', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                  </div>


                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_site_google_maps_key') || 'Google Maps API Key'}
                    </label>
                    <input 
                      type="text" 
                      value={appSettings?.demoMode && settings.site.googleMapsApiKey 
                        ? '*'.repeat(Math.min(settings.site.googleMapsApiKey.length, 40))
                        : (settings.site.googleMapsApiKey || '')}
                      onChange={(e) => handleInputChange('site', 'googleMapsApiKey', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                      placeholder="AIzaSy..."
                      disabled={appSettings?.demoMode}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_site_google_maps_hint') ||
                        'Required for Store Locator feature. Get your API key from Google Cloud Console.'}
                    </p>
                  </div>

                   <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-6 mt-2">
                      <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('admin.settings_feature_toggles') || 'Feature Toggles'}</h4>
                      <div className="space-y-4">
                          <label className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={settings.site.enableLanguageSwitcher}
                                onChange={(e) => handleInputChange('site', 'enableLanguageSwitcher', e.target.checked)}
                                className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black" 
                              />
                              <div className="ml-3">
                              <span className="block text-sm font-medium text-gray-900">
                                {t('admin.settings_site_language_switcher') || 'Language Switcher'}
                              </span>
                              <span className="block text-sm text-gray-500">
                                {t('admin.settings_site_language_switcher_hint') ||
                                  'Enable users to switch between languages on the frontend.'}
                              </span>
                              </div>
                          </label>
                          
                          <label className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={settings.site.enablePhoneVerification ?? false}
                                onChange={(e) => handleInputChange('site', 'enablePhoneVerification', e.target.checked)}
                                className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black" 
                              />
                              <div className="ml-3">
                                <span className="block text-sm font-medium text-gray-900">
                                  {t('admin.settings_site_phone_verification') || 'Phone Verification'}
                                </span>
                                <span className="block text-sm text-gray-500">
                                  {t('admin.settings_site_phone_verification_hint') ||
                                    'Require users to verify their phone number during checkout or signup.'}
                                </span>
                              </div>
                          </label>

                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                              {t('admin.settings_site_login_options') || 'Login Options'}
                            </h3>
                            
                            <label className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={true}
                                disabled
                                className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black" 
                              />
                              <div className="ml-3">
                                <span className="block text-sm font-medium text-gray-900">
                                  {t('admin.settings_site_phone_login') || 'Phone Login'}
                                </span>
                                <span className="block text-sm text-gray-500">
                                  Phone-only authentication is active for this storefront.
                                </span>
                              </div>
                            </label>
                          </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* SMTP Settings */}
            {activeTab === 'smtp' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {t('admin.settings_smtp_title') || 'SMTP Email Configuration'}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {t('admin.settings_smtp_subtitle') ||
                        'Configure your email server settings for sending transactional emails.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_host') || 'Mail Host'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={settings.smtp.host || ''}
                      onChange={(e) => handleInputChange('smtp', 'host', e.target.value)}
                      placeholder="smtp.gmail.com" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_smtp_host_hint') ||
                        'e.g., smtp.gmail.com, smtp.mail.yahoo.com'}
                    </p>
                  </div>

                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_port') || 'Mail Port'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={settings.smtp.port || ''}
                      onChange={(e) => handleInputChange('smtp', 'port', e.target.value)}
                      placeholder="587" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_smtp_port_hint') ||
                        'Common ports: 587 (TLS), 465 (SSL), 25 (None)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_username') || 'Mail Username'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={settings.smtp.username || ''}
                      onChange={(e) => handleInputChange('smtp', 'username', e.target.value)}
                      placeholder="your-email@example.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                  </div>

                  <div>
                    <label className="block text.sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_password') || 'Mail Password'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="password" 
                      value={appSettings?.demoMode && settings.smtp.password 
                        ? '*'.repeat(Math.min(settings.smtp.password.length, 20))
                        : (settings.smtp.password || '')}
                      onChange={(e) => handleInputChange('smtp', 'password', e.target.value)}
                      placeholder="Your email password or app password"
                      disabled={appSettings?.demoMode}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_smtp_password_hint') ||
                        'For Gmail, use App Password instead of regular password'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_from_name') || 'Mail From Name'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={settings.smtp.fromName || ''}
                      onChange={(e) => handleInputChange('smtp', 'fromName', e.target.value)}
                      placeholder="Pardah Support" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_smtp_from_name_hint') ||
                        "Display name shown in recipient's inbox"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_from_email') || 'Mail From Email'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="email" 
                      value={settings.smtp.fromEmail || ''}
                      onChange={(e) => handleInputChange('smtp', 'fromEmail', e.target.value)}
                      placeholder="no-reply@pardah.com" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_smtp_from_email_hint') ||
                        'Must match your SMTP account email'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_smtp_encryption') || 'Mail Encryption'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={settings.smtp.encryption}
                      onChange={(e) => handleInputChange('smtp', 'encryption', e.target.value as 'tls' | 'ssl' | 'none')}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="tls">{t('admin.settings_smtp_tls') || 'TLS (Recommended)'}</option>
                      <option value="ssl">{t('admin.settings_smtp_ssl') || 'SSL'}</option>
                      <option value="none">{t('admin.settings_smtp_none') || 'None'}</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings_smtp_encryption_hint') ||
                        'TLS for port 587, SSL for port 465'}
                    </p>
                  </div>
                </div>

                {/* Test SMTP Section */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">
                    {t('admin.settings_smtp_test_title') || 'Test SMTP Configuration'}
                  </h4>
                  
                  <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('admin.settings_smtp_test_email') || 'Test Email Address'}
                      </label>
                      <div className="flex gap-3">
                        <input 
                          type="email" 
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                          placeholder={t('admin.settings_smtp_test_email_placeholder') || 'test@example.com'}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!testEmailAddress) {
                              setDialogMessage(
                                t('admin.settings_smtp_test_email_required') ||
                                  'Please enter a test email address'
                              );
                              setDialogType('error');
                              setShowDialog(true);
                              return;
                            }
                            
                            setTestingSMTP(true);
                            setSmtpTestResult(null);
                            
                            try {
                              const response = await fetch('/api/test-smtp', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  smtp: settings.smtp,
                                  testEmail: testEmailAddress,
                                }),
                              });
                              
                              const result = await response.json();
                              
                              if (result.success) {
                                setSmtpTestResult({
                                  success: true,
                                  message:
                                    t('admin.settings_smtp_test_success', {
                                      email: testEmailAddress,
                                    }) ||
                                    `Test email sent successfully to ${testEmailAddress}! Please check your inbox.`
                                });
                              } else {
                                setSmtpTestResult({
                                  success: false,
                                  message:
                                    result.error ||
                                    t('admin.settings_smtp_test_failed') ||
                                    'Failed to send test email. Please check your SMTP settings.'
                                });
                              }
                            } catch (error) {
                              setSmtpTestResult({
                                success: false,
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : t('admin.settings_smtp_test_error') ||
                                      'An error occurred while testing SMTP',
                              });
                            } finally {
                              setTestingSMTP(false);
                            }
                          }}
                          disabled={testingSMTP || !settings.smtp.host || !settings.smtp.port || !settings.smtp.username}
                          className="px-6 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {testingSMTP
                            ? t('admin.settings_smtp_test_sending') || 'Sending...'
                            : t('admin.settings_smtp_test_send') || 'Send Test Email'}
                        </button>
                      </div>
                    </div>

                    {smtpTestResult && (
                      <div className={`p-4 rounded-lg ${
                        smtpTestResult.success 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-start gap-3">
                          {smtpTestResult.success ? (
                            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <p
                            className={`text-sm font-medium ${
                            smtpTestResult.success ? 'text-green-800' : 'text-red-800'
                          }`}
                          >
                            {smtpTestResult.message}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="text-sm font-semibold text-blue-900 mb-2">
                        {t('admin.settings_smtp_common_title') || 'Common SMTP Settings:'}
                      </h5>
                      <div className="text-xs text-blue-800 space-y-1">
                        <p>
                          {t('admin.settings_smtp_common_gmail') ||
                            'Gmail: smtp.gmail.com, Port: 587, TLS, Use App Password'}
                        </p>
                        <p>
                          {t('admin.settings_smtp_common_yahoo') ||
                            'Yahoo: smtp.mail.yahoo.com, Port: 587, TLS'}
                        </p>
                        <p>
                          {t('admin.settings_smtp_common_outlook') ||
                            'Outlook: smtp-mail.outlook.com, Port: 587, TLS'}
                        </p>
                        <p>
                          {t('admin.settings_smtp_common_custom') ||
                            'Custom: Check with your email provider'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email Notifications */}
            {activeTab === 'emailNotifications' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {t('admin.settings_email_title') || 'Email Notification Settings'}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {t('admin.settings_email_subtitle') ||
                      'Configure automated email notifications for customers and admins.'}
                  </p>
                </div>

                {/* Customer Email Notifications */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-6">
                    {t('admin.settings_email_customer_title') || 'Customer Email Notifications'}
                  </h4>
                  
                  <div className="space-y-6">
                    {/* Order Placed */}
                    <div className="border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-base font-semibold text-gray-900">
                            {t('admin.settings_email_customer_order_placed') || 'Order Placed Email'}
                          </h5>
                          <p className="text-sm text-gray-500 mt-1">
                            {t('admin.settings_email_customer_order_placed_hint') ||
                              'Send confirmation email when customer places an order'}
                          </p>
                        </div>
                        <Switch
                          label=""
                          checked={settings.emailNotifications?.customerOrderPlaced ?? true}
                          onChange={(e) => handleInputChange('emailNotifications', 'customerOrderPlaced', e.target.checked)}
                        />
                      </div>
                      {settings.emailNotifications?.customerOrderPlaced && (
                        <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('admin.settings_email_subject') || 'Email Subject'}
                            </label>
                            <input
                              type="text"
                              value={settings.emailNotifications?.customerOrderPlacedSubject || 'Order Confirmation - Order #{orderId}'}
                              onChange={(e) => handleInputChange('emailNotifications', 'customerOrderPlacedSubject', e.target.value)}
                              placeholder="Order Confirmation - Order #{orderId}"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('admin.settings_email_variables_order_placed') ||
                                'Available variables: {orderId}, {customerName}, {orderTotal}'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('admin.settings_email_template') || 'Email Template (HTML)'}
                            </label>
                            <textarea
                              value={settings.emailNotifications?.customerOrderPlacedTemplate || ''}
                              onChange={(e) => handleInputChange('emailNotifications', 'customerOrderPlacedTemplate', e.target.value)}
                              placeholder="Enter HTML email template..."
                              rows={8}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('admin.settings_email_variables_order_placed_template') ||
                                'Leave empty to use default template. Available variables: {orderId}, {customerName}, {orderTotal}, {orderItems}, {shippingAddress}'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Order Status Update */}
                    <div className="border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-base font-semibold text-gray-900">
                            {t('admin.settings_email_status_update') ||
                              'Order Status Update Email'}
                          </h5>
                          <p className="text-sm text-gray-500 mt-1">
                            {t('admin.settings_email_status_update_hint') ||
                              'Send email when order status changes (processing, shipped, etc.)'}
                          </p>
                        </div>
                        <Switch
                          label=""
                          checked={settings.emailNotifications?.customerOrderStatusUpdate ?? true}
                          onChange={(e) => handleInputChange('emailNotifications', 'customerOrderStatusUpdate', e.target.checked)}
                        />
                      </div>
                      {settings.emailNotifications?.customerOrderStatusUpdate && (
                        <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('admin.settings_email_subject') || 'Email Subject'}
                            </label>
                            <input
                              type="text"
                              value={settings.emailNotifications?.customerOrderStatusUpdateSubject || 'Order Status Update - Order #{orderId}'}
                              onChange={(e) => handleInputChange('emailNotifications', 'customerOrderStatusUpdateSubject', e.target.value)}
                              placeholder="Order Status Update - Order #{orderId}"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('admin.settings_email_variables_status_update') ||
                                'Available variables: {orderId}, {customerName}, {orderStatus}'}
                            </p>
                          </div>
                          <div>
                            <label className="block text.sm font-semibold text-gray-700 mb-2">
                              {t('admin.settings_email_template') || 'Email Template (HTML)'}
                            </label>
                            <textarea
                              value={settings.emailNotifications?.customerOrderStatusUpdateTemplate || ''}
                              onChange={(e) => handleInputChange('emailNotifications', 'customerOrderStatusUpdateTemplate', e.target.value)}
                              placeholder="Enter HTML email template..."
                              rows={8}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('admin.settings_email_variables_status_update_template') ||
                                'Leave empty to use default template. Available variables: {orderId}, {customerName}, {orderStatus}, {trackingNumber}'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Order Delivered */}
                    <div className="border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-base font-semibold text-gray-900">
                            {t('admin.settings_email_delivered') || 'Order Delivered Email'}
                          </h5>
                          <p className="text-sm text-gray-500 mt-1">
                            {t('admin.settings_email_delivered_hint') ||
                              'Send email when order is delivered'}
                          </p>
                        </div>
                        <Switch
                          label=""
                          checked={settings.emailNotifications?.customerOrderDelivered ?? true}
                          onChange={(e) => handleInputChange('emailNotifications', 'customerOrderDelivered', e.target.checked)}
                        />
                      </div>
                      {settings.emailNotifications?.customerOrderDelivered && (
                        <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('admin.settings_email_subject') || 'Email Subject'}
                            </label>
                            <input
                              type="text"
                              value={settings.emailNotifications?.customerOrderDeliveredSubject || 'Your Order Has Been Delivered - Order #{orderId}'}
                              onChange={(e) => handleInputChange('emailNotifications', 'customerOrderDeliveredSubject', e.target.value)}
                              placeholder="Your Order Has Been Delivered - Order #{orderId}"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('admin.settings_email_variables_delivered') ||
                                'Available variables: {orderId}, {customerName}'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('admin.settings_email_template') || 'Email Template (HTML)'}
                            </label>
                            <textarea
                              value={settings.emailNotifications?.customerOrderDeliveredTemplate || ''}
                              onChange={(e) => handleInputChange('emailNotifications', 'customerOrderDeliveredTemplate', e.target.value)}
                              placeholder="Enter HTML email template..."
                              rows={8}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('admin.settings_email_variables_delivered_template') ||
                                'Leave empty to use default template. Available variables: {orderId}, {customerName}, {deliveryDate}'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Email Notifications */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-6">
                    {t('admin.settings_email_admin_title') || 'Admin Email Notifications'}
                  </h4>
                  
                  <div className="border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h5 className="text-base font-semibold text-gray-900">
                          {t('admin.settings_email_admin_new_order') || 'New Order Notification'}
                        </h5>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('admin.settings_email_admin_new_order_hint') ||
                            'Send email to admin when a new order is placed'}
                        </p>
                      </div>
                      <Switch
                        label=""
                        checked={settings.emailNotifications?.adminNewOrder ?? true}
                        onChange={(e) => handleInputChange('emailNotifications', 'adminNewOrder', e.target.checked)}
                      />
                    </div>
                    {settings.emailNotifications?.adminNewOrder && (
                      <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('admin.settings_email_admin_addresses') || 'Admin Email Addresses'}
                          </label>
                          <input
                            type="text"
                            value={settings.emailNotifications?.adminNewOrderEmails?.join(', ') || ''}
                            onChange={(e) => {
                              const emails = e.target.value.split(',').map(email => email.trim()).filter(email => email);
                              handleInputChange('emailNotifications', 'adminNewOrderEmails', emails);
                            }}
                            placeholder="admin@example.com, manager@example.com"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {t('admin.settings_email_admin_addresses_hint') ||
                              'Enter comma-separated email addresses to receive new order notifications'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('admin.settings_email_subject') || 'Email Subject'}
                          </label>
                          <input
                            type="text"
                            value={settings.emailNotifications?.adminNewOrderSubject || 'New Order Received - Order #{orderId}'}
                            onChange={(e) => handleInputChange('emailNotifications', 'adminNewOrderSubject', e.target.value)}
                            placeholder="New Order Received - Order #{orderId}"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {t('admin.settings_email_variables_admin_new_order') ||
                              'Available variables: {orderId}, {customerName}, {orderTotal}'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('admin.settings_email_template') || 'Email Template (HTML)'}
                          </label>
                          <textarea
                            value={settings.emailNotifications?.adminNewOrderTemplate || ''}
                            onChange={(e) => handleInputChange('emailNotifications', 'adminNewOrderTemplate', e.target.value)}
                            placeholder="Enter HTML email template..."
                            rows={8}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono text-sm"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {t('admin.settings_email_variables_admin_new_order_template') ||
                              'Leave empty to use default template. Available variables: {orderId}, {customerName}, {customerEmail}, {orderTotal}, {orderItems}, {shippingAddress}, {paymentMethod}'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'goldPricing' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Gold Pricing</h3>
                  <p className="text-gray-500 text-sm">
                    Control the gold pricing provider, refresh interval, cache, default margin, and tax used for gold-priced products.
                  </p>
                </div>

                {(() => {
                  const goldProvider = settings.goldPricing?.provider || 'manual';
                  const isManualProvider = goldProvider === 'manual';
                  const isApiProvider = goldProvider === 'goldpricez';

                  return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="md:col-span-2">
                    <Switch
                      label="Enable Gold Pricing"
                      checked={settings.goldPricing?.enabled ?? false}
                      onChange={(e) => handleInputChange('goldPricing', 'enabled', e.target.checked)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Provider</label>
                    <select
                      value={settings.goldPricing?.provider || 'manual'}
                      onChange={(e) => handleInputChange('goldPricing', 'provider', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                    >
                      <option value="manual">Manual</option>
                      <option value="goldpricez">goldpricez API</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                      {isManualProvider
                        ? 'The store will use the manual price per gram entered below.'
                        : 'The store will use the cached gold price fetched from the API URL below.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Refresh Interval (seconds)</label>
                    <input
                      type="number"
                      value={settings.goldPricing?.refreshIntervalSeconds ?? 60}
                      onChange={(e) => handleInputChange('goldPricing', 'refreshIntervalSeconds', parseInt(e.target.value, 10) || 60)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                      min="1"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Used only when the provider is API-based.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">API URL</label>
                    <input
                      type="text"
                      value={settings.goldPricing?.apiUrl || ''}
                      onChange={(e) => handleInputChange('goldPricing', 'apiUrl', e.target.value)}
                      disabled={isManualProvider}
                      className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                        isManualProvider
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent'
                      }`}
                      placeholder="https://goldpricez.com/api/rates/currency/sar/measure/gram"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {isManualProvider
                        ? 'Disabled because Manual provider is selected.'
                        : 'Used only when the provider is set to goldpricez API.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Manual Price Per Gram</label>
                    <input
                      type="number"
                      value={settings.goldPricing?.manualPricePerGram ?? 0}
                      onChange={(e) => handleInputChange('goldPricing', 'manualPricePerGram', parseFloat(e.target.value) || 0)}
                      disabled={isApiProvider}
                      className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                        isApiProvider
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent'
                      }`}
                      min="0"
                      step="0.01"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {isApiProvider
                        ? 'Disabled because API provider is selected.'
                        : 'This value is used directly as the gold price per gram.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Default Margin Type</label>
                    <select
                      value={settings.goldPricing?.defaultMarginType || 'fixed'}
                      onChange={(e) => handleInputChange('goldPricing', 'defaultMarginType', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                      {(settings.goldPricing?.defaultMarginType || 'fixed') === 'fixed'
                        ? 'Fixed Amount adds a constant value to the calculated gold base price. Example: if the base price is 500 SAR and the margin value is 50, the price becomes 550 SAR before tax.'
                        : 'Percentage adds a percentage on top of the calculated gold base price. Example: if the base price is 500 SAR and the margin value is 10, the price becomes 550 SAR before tax.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Default Margin Value</label>
                    <input
                      type="number"
                      value={settings.goldPricing?.defaultMarginValue ?? 0}
                      onChange={(e) => handleInputChange('goldPricing', 'defaultMarginValue', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                      min="0"
                      step="0.01"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {(settings.goldPricing?.defaultMarginType || 'fixed') === 'fixed'
                        ? 'Enter the amount in SAR to add on top of the gold base price.'
                        : 'Enter the percentage to add on top of the gold base price.'}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Tax Rate By Karat (%)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(['24K', '22K', '21K', '18K'] as const).map((karat) => (
                        <div key={karat}>
                          <label className="block text-xs font-medium text-gray-600 mb-2">{karat}</label>
                          <input
                            type="number"
                            value={settings.goldPricing?.karatTaxRates?.[karat] ?? 0}
                            onChange={(e) =>
                              handleInputChange('goldPricing', 'karatTaxRates', {
                                ...normalizeGoldPricingSettings(settings.goldPricing).karatTaxRates,
                                [karat]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Tax is applied after the gold base price and margin are added together. Each karat can have its own tax rate.
                    </p>
                  </div>

                  <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Cached Gold Rate</p>
                        <p className="text-xs text-amber-800 mt-1">
                          {settings.goldPricing?.cache?.pricePerGram ?? 0} {settings.goldPricing?.cache?.currency || 'SAR'} / gram
                        </p>
                        <p className="text-xs text-amber-800 mt-1">
                          Last fetched: {settings.goldPricing?.cache?.fetchedAt || 'Not fetched yet'}
                        </p>
                        <p className="text-xs text-amber-800 mt-1">
                          {isManualProvider
                            ? 'This cached value is informational only while Manual provider is active.'
                            : 'This cached value is the effective source used for gold-priced products.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshGoldPrice}
                        disabled={refreshingGoldPrice || isManualProvider}
                        className="px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
                      >
                        {refreshingGoldPrice ? 'Refreshing...' : isManualProvider ? 'API Disabled in Manual Mode' : 'Refresh Gold Price'}
                      </button>
                    </div>
                  </div>
                </div>
                  );
                })()}
              </div>
            )}

            {/* Social Media */}
            {activeTab === 'social' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {t('admin.settings_social_title') || 'Social Media Links'}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {t('admin.settings_social_subtitle') ||
                        'Connect your social media profiles to display in the footer.'}
                    </p>
                </div>

                <div className="space-y-4 md:space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_social_facebook') || 'Facebook URL'}
                    </label>
                    <div className="flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center px-3 sm:px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs sm:text-sm font-medium">
                        facebook.com/
                      </span>
                      <input 
                        type="text" 
                        value={settings.social.facebook || ''}
                        onChange={(e) => handleInputChange('social', 'facebook', e.target.value)}
                        className="flex-1 block w-full px-3 sm:px-4 py-2.5 rounded-none rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_social_instagram') || 'Instagram URL'}
                    </label>
                    <div className="flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center px-3 sm:px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs sm:text-sm font-medium">
                        instagram.com/
                      </span>
                      <input 
                        type="text" 
                        value={settings.social.instagram || ''}
                        onChange={(e) => handleInputChange('social', 'instagram', e.target.value)}
                        className="flex-1 block w-full px-3 sm:px-4 py-2.5 rounded-none rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_social_twitter') || 'X (Twitter) URL'}
                    </label>
                    <div className="flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center px-3 sm:px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs sm:text-sm font-medium">
                        x.com/
                      </span>
                      <input 
                        type="text" 
                        value={settings.social.twitter || ''}
                        onChange={(e) => handleInputChange('social', 'twitter', e.target.value)}
                        className="flex-1 block w-full px-3 sm:px-4 py-2.5 rounded-none rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.settings_social_youtube') || 'YouTube URL'}
                    </label>
                    <div className="flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center px-3 sm:px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs sm:text-sm font-medium">
                        youtube.com/
                      </span>
                      <input 
                        type="text" 
                        value={settings.social.youtube || ''}
                        onChange={(e) => handleInputChange('social', 'youtube', e.target.value)}
                        className="flex-1 block w-full px-3 sm:px-4 py-2.5 rounded-none rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 sm:mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
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
      </div>

      {/* Success/Error Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              {dialogType === 'success' ? (
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : (
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <h3 className={`text-lg font-semibold mb-1 ${dialogType === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                  {dialogType === 'success' ? (t('admin.common.success') || 'Success') : (t('admin.common.error') || 'Error')}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {dialogMessage}
                </p>
                <button
                  onClick={() => setShowDialog(false)}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    dialogType === 'success'
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {t('admin.common.ok') || 'OK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
