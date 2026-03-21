'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Banner, BannerTranslation } from '@/lib/firestore/banners';
import { addBanner, updateBanner, getBanner } from '@/lib/firestore/banners_db';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '../ui/Dialog';
import { useLanguage } from '@/context/LanguageContext';
import { Timestamp } from 'firebase/firestore';
import { optimizeImageForUpload } from '@/lib/utils/client-image';

interface BannerFormProps {
  bannerId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const BannerForm: React.FC<BannerFormProps> = ({ bannerId, onSuccess, onCancel }) => {
  const isEditMode = !!bannerId;

  const [banner, setBanner] = useState<Partial<Banner>>({
    title: '',
    subtitle: '',
    titleColor: '#FFFFFF',
    subtitleColor: '#F3F4F6',
    imageUrl: '',
    linkTo: '',
    deviceType: 'both',
    isActive: true,
    order: 0,
  });
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const { t } = useLanguage();

  const normalizeCode = (code?: string | null) => String(code || '').trim().toLowerCase();
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<'ar' | 'en'>('ar');

  const selectedLabel = useMemo(() => (selectedLanguageCode === 'ar' ? 'AR' : 'EN'), [selectedLanguageCode]);

  const getTranslation = (code: string, source: Partial<Banner>) => {
    const translations = source.translations || [];
    return translations.find(tr => normalizeCode(tr.languageCode) === normalizeCode(code)) || null;
  };

  const upsertTranslation = (code: string, patch: Partial<BannerTranslation>) => {
    setBanner(prev => {
      const translations = [...(prev.translations || [])];
      const idx = translations.findIndex(tr => normalizeCode(tr.languageCode) === normalizeCode(code));
      const next: BannerTranslation = {
        languageCode: normalizeCode(code) || code,
        ...(idx >= 0 ? translations[idx] : {}),
        ...patch,
        updatedAt: Timestamp.now(),
      };
      if (idx >= 0) translations[idx] = next;
      else translations.push(next);
      return { ...prev, translations };
    });
  };

  const localizedTitle = useMemo(() => {
    const tr = getTranslation(selectedLanguageCode, banner);
    // Back-compat: if there are no translations yet, treat root title/subtitle as English
    if (!tr && selectedLanguageCode === 'en') return String(banner.title || '');
    return String(tr?.title || '');
  }, [banner, selectedLanguageCode]);

  const localizedSubtitle = useMemo(() => {
    const tr = getTranslation(selectedLanguageCode, banner);
    if (!tr && selectedLanguageCode === 'en') return String(banner.subtitle || '');
    return String(tr?.subtitle || '');
  }, [banner, selectedLanguageCode]);

  useEffect(() => {
    if (isEditMode && bannerId) {
      setLoading(true);
      getBanner(bannerId).then(fetched => {
        if (fetched) {
          // Ensure we always have a translations array for the UI.
          const hasTranslations = Array.isArray(fetched.translations) && fetched.translations.length > 0;
          const seeded: Partial<Banner> = hasTranslations
            ? fetched
            : {
                ...fetched,
                translations: [
                  {
                    languageCode: 'en',
                    title: fetched.title || '',
                    subtitle: fetched.subtitle || '',
                    updatedAt: fetched.updatedAt,
                  },
                ],
              };
          setBanner(seeded);
        }
      }).finally(() => setLoading(false));
    }
  }, [bannerId, isEditMode]);

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
      let imageUrl = banner.imageUrl;

      if (imageFile) {
        const optimizedImage = await optimizeImageForUpload(imageFile, { maxWidth: 1600, maxHeight: 900, quality: 0.8 });
        const storageRef = ref(storage, `banners/${Date.now()}_${optimizedImage.name}`);
        const uploadResult = await uploadBytes(storageRef, optimizedImage, {
          contentType: optimizedImage.type,
        });
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      const bannerData = { ...banner, imageUrl };

      // Keep root title/subtitle as English for backward compatibility.
      const englishTr = getTranslation('en', bannerData) || null;
      const nextBannerData: Partial<Banner> = {
        ...bannerData,
        title: (englishTr?.title ?? bannerData.title ?? '') as string,
        subtitle: (englishTr?.subtitle ?? bannerData.subtitle ?? '') as string,
        translations: (bannerData.translations || []) as BannerTranslation[],
      };

      if (isEditMode && bannerId) {
        await updateBanner(bannerId, nextBannerData);
      } else {
        await addBanner(nextBannerData as Omit<Banner, 'id'>);
      }
      setInfoDialogMessage(isEditMode ? (t('admin.banners_update_success') || 'Banner updated successfully!') : (t('admin.banners_create_success') || 'Banner created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      // Failed to save banner
      setInfoDialogMessage(t('admin.banners_save_failed') || 'Failed to save banner.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setBanner(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value)
    }));
  };

  const handleLocalizedTextChange = (field: 'title' | 'subtitle', value: string) => {
    upsertTranslation(selectedLanguageCode, { [field]: value } as Partial<BannerTranslation>);
    // Also keep English root fields in sync for legacy reads when editing EN.
    if (selectedLanguageCode === 'en') {
      setBanner(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {isEditMode
          ? `${t('common.edit') || 'Edit'} ${t('admin.banners') || 'Banners'}`
          : `${t('common.add') || 'Add'} ${t('admin.banners') || 'Banners'}`}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.banners_form_image_label') || 'Banner Image'}</label>
          
          {/* Recommended Size Info */}
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">{t('admin.banners_recommended_sizes_title') || 'Recommended Banner Sizes:'}</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <strong>{t('admin.banners_device_desktop_label') || 'Desktop'}:</strong> 1280 x 600px</li>
              <li>• <strong>{t('admin.banners_device_mobile_label') || 'Mobile'}:</strong> 750 x 500px (3:2 ratio)</li>
              <li>• <strong>{t('admin.banners_device_both_label') || 'Both Devices'}:</strong> 1280 x 600px ({t('admin.banners_size_note') || 'will be optimized for mobile'})</li>
            </ul>
            <p className="text-xs text-blue-700 mt-2">{t('admin.banners_supported_formats_hint') || 'Supported formats: SVG, PNG, JPG, GIF (Max file size: 5MB)'}</p>
          </div>
          
          <div className="flex flex-col gap-4">
             {(imagePreview || banner.imageUrl) && (
                <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <Image 
                    src={imagePreview || banner.imageUrl || '/placeholder.png'} 
                    alt={t('admin.banners_preview_alt') || 'Banner Preview'}  
                    fill
                    className="object-cover"
                  />
                </div>
             )}

             <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file-banner" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">{t('admin.upload_click_to_upload') || 'Click to upload'}</span> {t('admin.upload_or_drag_drop') || 'or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">{t('admin.banners_upload_file_types') || 'SVG, PNG, JPG or GIF'}</p>
                    </div>
                    <input id="dropzone-file-banner" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
            </div>
            
            <div className="text-xs text-gray-400">
                {t('admin.upload_or_enter_url_manually') || 'Or enter URL manually:'}
                <input
                  type="text"
                  name="imageUrl"
                  value={banner.imageUrl}
                  onChange={handleChange}
                  placeholder={t('admin.banners_image_url_placeholder') || 'https://example.com/banner.jpg'}
                  className="mt-1 w-full px-3 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-gray-400 outline-none"
                />
             </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">
                {t('admin.banners_translations_title') || 'Banner translations'}
              </div>
              <div className="text-xs text-gray-500">
                {t('admin.banners_translations_hint') || 'Enter title/subtitle per language.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLanguageCode('ar')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  selectedLanguageCode === 'ar'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                AR
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguageCode('en')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  selectedLanguageCode === 'en'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                EN
              </button>
              <span className="ml-2 text-xs font-semibold text-gray-500">{selectedLabel}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                {t('admin.banners_table_title') || 'Title'} ({selectedLanguageCode.toUpperCase()})
              </label>
              <input
                type="text"
                value={localizedTitle}
                onChange={(e) => handleLocalizedTextChange('title', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                {t('admin.banners_table_subtitle') || 'Subtitle'} ({selectedLanguageCode.toUpperCase()})
              </label>
              <input
                type="text"
                value={localizedSubtitle}
                onChange={(e) => handleLocalizedTextChange('subtitle', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.banners_title_color_label') || 'Title Color'}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="titleColor"
                value={banner.titleColor || '#FFFFFF'}
                onChange={handleChange}
                className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                name="titleColor"
                value={banner.titleColor || '#FFFFFF'}
                onChange={handleChange}
                placeholder="#FFFFFF"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.banners_subtitle_color_label') || 'Subtitle Color'}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="subtitleColor"
                value={banner.subtitleColor || '#F3F4F6'}
                onChange={handleChange}
                className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                name="subtitleColor"
                value={banner.subtitleColor || '#F3F4F6'}
                onChange={handleChange}
                placeholder="#F3F4F6"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.banners_link_label') || 'Link To (URL or Path)'}</label>
          <input
            type="text"
            name="linkTo"
            value={banner.linkTo}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder={t('admin.banners_link_placeholder') || '/shop/new-arrivals'}
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.banners_table_device_type') || 'Device Type'}</label>
          <select
            name="deviceType"
            value={banner.deviceType || 'both'}
            onChange={(e) => setBanner({ ...banner, deviceType: e.target.value as 'desktop' | 'mobile' | 'both' })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="both">{t('admin.banners_device_both_option') || 'Both (Desktop & Mobile)'}</option>
            <option value="desktop">{t('admin.banners_device_desktop_option') || 'Desktop Only'}</option>
            <option value="mobile">{t('admin.banners_device_mobile_option') || 'Mobile Only'}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('admin.banners_device_help') || 'Select which devices this banner should appear on'}</p>
        </div>

        <div>
           <label className="inline-flex items-center cursor-pointer">
             <input
                type="checkbox"
                name="isActive"
                checked={banner.isActive}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-green-600 rounded focus:ring-green-500"
             />
             <span className="ml-2 text-gray-700 font-medium">{t('admin.banners_active_label') || t('admin.coupons_active_label') || 'Active'}</span>
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
            {loading ? (t('common.saving') || 'Saving...') : (t('admin.banners_save_button') || 'Save Banner')}
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

export default BannerForm;
