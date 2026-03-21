'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAllLanguages, createLanguage, updateLanguage, deleteLanguage } from '@/lib/firestore/internationalization_db';
import { Language } from '@/lib/firestore/internationalization';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import Dialog from '@/components/ui/Dialog';

const LanguagesPage = () => {
  const { t } = useLanguage();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [flagImageFile, setFlagImageFile] = useState<File | null>(null);
  const [flagImagePreview, setFlagImagePreview] = useState<string | null>(null);
  const [uploadingFlag, setUploadingFlag] = useState(false);
  const flagFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    nativeName: '',
    isRTL: false,
    isActive: true,
    flag: '',
  });

  useEffect(() => {
    fetchLanguages();
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

  const fetchLanguages = async () => {
    try {
      const data = await getAllLanguages();
      setLanguages(data);
    } catch {
      // Failed to fetch languages
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
    setUploadingFlag(true);
    try {
      let flagUrl = formData.flag;

      // Upload flag image if file is selected
      if (flagImageFile) {
        try {
          const sanitizedFileName = flagImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `languages/flags/${Date.now()}_${sanitizedFileName}`;
          const storageRef = ref(storage, filePath);
          const uploadResult = await uploadBytes(storageRef, flagImageFile);
          flagUrl = await getDownloadURL(uploadResult.ref);
        } catch {
          setInfoDialogMessage(t('admin.languages_flag_upload_failed') || 'Failed to upload flag image.');
          setInfoDialogType('error');
          setShowInfoDialog(true);
          setUploadingFlag(false);
          return;
        }
      }

      const languageData = {
        ...formData,
        flag: flagUrl,
      };

      if (editingLanguage) {
        await updateLanguage(editingLanguage.id!, languageData);
      } else {
        await createLanguage(languageData);
      }
      setShowForm(false);
      setEditingLanguage(null);
      resetForm();
      fetchLanguages();
      setInfoDialogMessage(editingLanguage ? (t('admin.languages.update_success') || 'Language updated successfully!') : (t('admin.languages.create_success') || 'Language created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save language
      setInfoDialogMessage(t('admin.languages.save_failed') || 'Failed to save language');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setUploadingFlag(false);
    }
  };

  const handleEdit = (language: Language) => {
    setEditingLanguage(language);
    setFormData({
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      isRTL: language.isRTL,
      isActive: language.isActive,
      flag: language.flag || '',
    });
    // Reset image preview and file
    setFlagImageFile(null);
    setFlagImagePreview(null);
    if (flagFileInputRef.current) {
      flagFileInputRef.current.value = '';
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
    setConfirmDialogMessage(t('admin.languages.delete_confirm') || 'Are you sure you want to delete this language?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteLanguage(id);
        fetchLanguages();
        setInfoDialogMessage(t('admin.languages.delete_success') || 'Language deleted successfully.');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete language
        setInfoDialogMessage(t('admin.languages.delete_failed') || 'Failed to delete language');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      nativeName: '',
      isRTL: false,
      isActive: true,
      flag: '',
    });
    setFlagImageFile(null);
    setFlagImagePreview(null);
    if (flagFileInputRef.current) {
      flagFileInputRef.current.value = '';
    }
  };

  const handleFlagImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setInfoDialogMessage(t('admin.languages_flag_invalid_file') || 'Please select a valid image file.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        e.target.value = '';
        return;
      }
      setFlagImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setFlagImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFlagImage = () => {
    setFlagImageFile(null);
    setFlagImagePreview(null);
    if (flagFileInputRef.current) {
      flagFileInputRef.current.value = '';
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Languages</h1>
          <p className="text-gray-500 text-sm">Manage multiple languages for your store</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingLanguage(null);
            setShowForm(true);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          + New Language
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">{editingLanguage ? 'Edit' : 'Create'} Language</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.languages_field_code_label') || 'Language Code'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.languages_field_code_placeholder') || 'e.g., EN, UR, AR'
                  }
                  required
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.languages_field_name_label') || 'Language Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.languages_field_name_placeholder') || 'e.g., English'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.languages_field_native_name_label') || 'Native Name'}
                </label>
                <input
                  type="text"
                  value={formData.nativeName}
                  onChange={(e) =>
                    setFormData({ ...formData, nativeName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.languages_field_native_name_placeholder') ||
                    'e.g., English, اردو'
                  }
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.languages_field_flag_label') || 'Flag (Emoji, URL, or Image)'}
                </label>
                
                {/* Flag Preview */}
                {(flagImagePreview || (formData.flag && formData.flag.startsWith('http'))) && (
                  <div className="mb-3 relative inline-block">
                    <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {flagImagePreview ? (
                        <Image
                          src={flagImagePreview}
                          alt="Flag Preview"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : formData.flag.startsWith('http') ? (
                        <Image
                          src={formData.flag}
                          alt="Flag"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-3xl">{formData.flag}</span>
                      )}
                    </div>
                    {flagImagePreview && (
                      <button
                        type="button"
                        onClick={removeFlagImage}
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
                    htmlFor="flag-image-upload"
                    className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-6 h-6 mb-2 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="text-xs text-gray-500 text-center">
                        <span className="font-semibold">Click to upload flag image</span>
                      </p>
                      <p className="text-xs text-gray-400 text-center mt-1">PNG, JPG, SVG (MAX. 2MB)</p>
                    </div>
                    <input
                      id="flag-image-upload"
                      ref={flagFileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFlagImageChange}
                    />
                  </label>
                </div>

                {/* Text Input for Emoji or URL */}
                <div className="relative">
                  <input
                    type="text"
                    value={formData.flag}
                    onChange={(e) =>
                      setFormData({ ...formData, flag: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={
                      t('admin.languages_field_flag_placeholder') || '🇵🇰 or https://example.com/flag.png'
                    }
                    disabled={!!flagImageFile}
                  />
                  {flagImageFile && (
                    <p className="mt-1 text-xs text-gray-500">
                      {t('admin.languages_flag_image_selected') || 'Image selected. Upload will replace text input.'}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t('admin.languages_field_flag_hint') || 'Enter an emoji (🇵🇰), image URL, or upload an image above'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isRTL}
                  onChange={(e) =>
                    setFormData({ ...formData, isRTL: e.target.checked })
                  }
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.languages_field_is_rtl_label') ||
                    'Right-to-Left (RTL)'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin.languages_field_is_active_label') || 'Active'}
                </span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploadingFlag}
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFlag
                  ? (t('admin.languages_uploading') || 'Uploading...')
                  : editingLanguage
                  ? t('admin.languages_save_button_update') || 'Update Language'
                  : t('admin.languages_save_button_create') || 'Create Language'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingLanguage(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.languages_cancel_button') ||
                  t('common.cancel') ||
                  'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {languages.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">No languages found.</p>
            <p className="text-sm text-gray-400">Get started by adding your first language</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Flag</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Native Name</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">RTL</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {languages.map((language) => (
                    <tr key={language.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-2xl">
                        {language.flag ? (
                          language.flag.startsWith('http') ? (
                            <Image
                              src={language.flag}
                              alt={`${language.name} flag`}
                              width={32}
                              height={32}
                              className="w-8 h-8 object-cover rounded"
                              unoptimized
                            />
                          ) : (
                            <span className="text-2xl">{language.flag}</span>
                          )
                        ) : (
                          <span className="text-2xl">🌐</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{language.code}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{language.name}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{language.nativeName}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          language.isRTL ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {language.isRTL ? t('admin.languages_badge_rtl') || 'RTL' : t('admin.languages_badge_ltr') || 'LTR'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          language.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {language.isActive ? t('admin.languages_status_active') || 'Active' : t('admin.languages_status_inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(language)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(language.id!)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {languages.map((language) => (
                <div key={language.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {language.flag ? (
                        language.flag.startsWith('http') ? (
                          <Image
                            src={language.flag}
                            alt={`${language.name} flag`}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-cover rounded"
                            unoptimized
                          />
                        ) : (
                          <span className="text-2xl">{language.flag}</span>
                        )
                      ) : (
                        <span className="text-2xl">🌐</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">{language.name}</h3>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>Code: {language.code}</p>
                          <p>Native: {language.nativeName}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      language.isRTL ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {language.isRTL ? t('admin.languages_badge_rtl') || 'RTL' : t('admin.languages_badge_ltr') || 'LTR'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      language.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {language.isActive ? t('admin.languages_status_active') || 'Active' : t('admin.languages_status_inactive') || 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(language)}
                      className="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(language.id!)}
                      className="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Delete
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

export default LanguagesPage;

