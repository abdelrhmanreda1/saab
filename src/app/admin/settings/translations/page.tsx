'use client';

import React, { useState, useEffect } from 'react';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import {
  getAllTranslations,
  createTranslation,
  updateTranslation,
  deleteTranslation,
  bulkCreateTranslations,
} from '@/lib/firestore/translations_db';
import { Language } from '@/lib/firestore/internationalization';
import { Translation, DEFAULT_TRANSLATION_KEYS } from '@/lib/firestore/translations';
import { useLanguage } from '@/context/LanguageContext';
import arabicPack from '@/data/translations/ar.json';

const TranslationsPage = () => {
  const { t } = useLanguage();
  const normalizeCode = (code?: string | null) => String(code || '').trim().toLowerCase();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState<Translation | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    namespace: 'common',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [isImportingJson, setIsImportingJson] = useState(false);

  useEffect(() => {
    fetchLanguages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLanguage) {
      fetchTranslations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]);

  const fetchLanguages = async () => {
    try {
      const data = await getAllLanguages(false); // Get all languages, not just active
      setLanguages(data);
      if (data.length > 0 && !selectedLanguage) {
        setSelectedLanguage(normalizeCode(data[0].code));
      }
    } catch {
      // Failed to fetch languages
      alert(
        t('admin.translations_languages_load_failed') ||
          'Failed to load languages. Please check if languages are added in Settings > Languages'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTranslations = async () => {
    if (!selectedLanguage) return;
    try {
      const data = await getAllTranslations(normalizeCode(selectedLanguage));
      setTranslations(data);
    } catch {
      // Failed to fetch translations
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLanguage) {
      alert(t('admin.translations_select_language_first') || 'Please select a language first');
      return;
    }

    try {
      if (editingTranslation) {
        await updateTranslation(editingTranslation.id!, {
          key: formData.key,
          value: formData.value,
          namespace: formData.namespace,
        });
      } else {
        await createTranslation({
          key: formData.key,
          value: formData.value,
          languageCode: normalizeCode(selectedLanguage),
          namespace: formData.namespace,
        });
      }
      setShowForm(false);
      setEditingTranslation(null);
      resetForm();
      fetchTranslations();
    } catch {
      // Failed to save translation
      alert(t('admin.translations_save_failed') || 'Failed to save translation');
    }
  };

  const handleEdit = (translation: Translation) => {
    setEditingTranslation(translation);
    setFormData({
      key: translation.key,
      value: translation.value,
      namespace: translation.namespace || 'common',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm(
        t('admin.translations_delete_confirm') ||
          'Are you sure you want to delete this translation?'
      )
    ) {
      try {
        await deleteTranslation(id);
        fetchTranslations();
      } catch {
        // Failed to delete translation
        alert(t('admin.translations_delete_failed') || 'Failed to delete translation');
      }
    }
  };

  const handleBulkImport = async () => {
    if (!selectedLanguage) {
      alert(t('admin.translations_select_language_first') || 'Please select a language first');
      return;
    }

    const translationsToImport = Object.entries(DEFAULT_TRANSLATION_KEYS).map(([key, value]) => ({
      key,
      value,
      languageCode: normalizeCode(selectedLanguage),
      namespace: key.split('.')[0] || 'common',
    }));

    try {
      await bulkCreateTranslations(translationsToImport);
      alert(
        t('admin.translations_import_success') || 'Default translations imported successfully!'
      );
      fetchTranslations();
    } catch {
      // Failed to import translations
      alert(t('admin.translations_import_failed') || 'Failed to import translations');
    }
  };

  const handleImportArabicPack = async () => {
    try {
      // Always import into Arabic languageCode = 'ar' (prevents accidentally importing into EN)
      const targetLanguageCode = 'ar';
      if (selectedLanguage !== targetLanguageCode) {
        setSelectedLanguage(targetLanguageCode);
      }

      const existingTranslations = await getAllTranslations(targetLanguageCode);

      // Upsert only the keys present in the Arabic pack (fast + safe)
      const existingMap = new Map<string, Translation>();
      existingTranslations.forEach(tr => existingMap.set(tr.key, tr));

      const entries = Object.entries(arabicPack as Record<string, string>);
      await Promise.all(entries.map(async ([key, value]) => {
        const existing = existingMap.get(key);
        if (existing?.id) {
          await updateTranslation(existing.id, {
            key,
            value,
            namespace: key.split('.')[0] || 'common',
          });
          return;
        }
        await createTranslation({
          key,
          value,
          languageCode: targetLanguageCode,
          namespace: key.split('.')[0] || 'common',
        });
      }));

      alert(t('admin.translations_import_success') || 'Translations imported successfully!');
      fetchTranslations();
    } catch {
      alert(t('admin.translations_import_failed') || 'Failed to import translations');
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      value: '',
      namespace: 'common',
    });
  };

  const filteredTranslations = translations.filter(t =>
    t.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allDefaultKeys = Object.keys(DEFAULT_TRANSLATION_KEYS);
  const existingKeySet = new Set(translations.map(tr => tr.key));
  const missingKeys = allDefaultKeys.filter(k => !existingKeySet.has(k));
  const missingCount = missingKeys.length;
  const totalCount = allDefaultKeys.length;
  const progressPercent = totalCount > 0 ? Math.round(((totalCount - missingCount) / totalCount) * 100) : 0;

  const displayedTranslations = showMissingOnly
    ? filteredTranslations.filter(tr => !tr.value || tr.value.trim() === '' || tr.value.trim() === tr.key)
    : filteredTranslations;

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportMissingJson = () => {
    // Export missing keys with EN fallback text to translate in bulk externally
    const payload: Record<string, string> = {};
    missingKeys.forEach((key) => {
      payload[key] = String((DEFAULT_TRANSLATION_KEYS as Record<string, string>)[key] ?? key);
    });
    downloadJson(`translations_missing_${selectedLanguage || 'lang'}.json`, payload);
  };

  const handleExportFullJson = () => {
    // Export full defaults (EN) as base, useful for first-time full translation projects
    downloadJson(`translations_full_defaults_en.json`, DEFAULT_TRANSLATION_KEYS);
  };

  const handleImportJsonFile = async (file: File) => {
    if (!selectedLanguage) {
      alert(t('admin.translations_select_language_first') || 'Please select a language first');
      return;
    }
    setIsImportingJson(true);
    try {
      const raw = await file.text();
      const json = JSON.parse(raw) as Record<string, unknown>;

      const existingMap = new Map<string, Translation>();
      translations.forEach(tr => existingMap.set(tr.key, tr));

      const entries = Object.entries(json)
        .filter(([key, value]) => typeof key === 'string' && typeof value === 'string' && key.trim() && (value as string).trim());

      // Import sequentially to avoid rate limits
      for (const [key, value] of entries) {
        const val = String(value).trim();
        const existing = existingMap.get(key);
        if (existing?.id) {
          await updateTranslation(existing.id, {
            key,
            value: val,
            namespace: key.split('.')[0] || 'common',
          });
        } else {
          await createTranslation({
            key,
            value: val,
            languageCode: selectedLanguage,
            namespace: key.split('.')[0] || 'common',
          });
        }
      }

      alert(t('admin.translations_import_success') || 'Translations imported successfully!');
      fetchTranslations();
    } catch {
      alert(t('admin.translations_import_failed') || 'Failed to import translations');
    } finally {
      setIsImportingJson(false);
    }
  };

  // const namespaces = Array.from(new Set(translations.map(t => t.namespace || 'common'))); // Currently unused but may be needed for future filtering

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
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.translations_title') || 'Translations'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.translations_subtitle') || 'Manage translations for all languages'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(normalizeCode(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
            disabled={languages.length === 0}
          >
            <option value="">
              {languages.length === 0
                ? t('admin.translations_select_language_placeholder_no_languages') ||
                  'No languages available - Add languages first'
                : t('admin.translations_select_language_placeholder') || 'Select Language'}
            </option>
            {languages.map(lang => (
              <option key={lang.id || lang.code} value={normalizeCode(lang.code)}>
                {lang.flag ? `${lang.flag} ` : ''}{lang.nativeName} ({lang.name}) {!lang.isActive ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
              setEditingTranslation(null);
            }}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold"
            disabled={!selectedLanguage}
          >
            {t('admin.translations_add_button') || 'Add Translation'}
          </button>
          <button
            onClick={handleBulkImport}
            className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold"
            disabled={!selectedLanguage}
          >
            {t('admin.translations_import_defaults_button') || 'Import Defaults'}
          </button>
          <button
            onClick={handleImportArabicPack}
            className="bg-amber-50 text-amber-900 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors text-sm font-semibold"
            disabled={!selectedLanguage}
            title="Import Arabic UI pack"
          >
            {t('admin.translations_import_arabic_pack') || 'استيراد حزمة الواجهة العربية'}
          </button>
          <button
            onClick={handleExportMissingJson}
            className="bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
            disabled={!selectedLanguage}
            title={t('admin.translations_export_missing_json_title') || 'Export missing keys as JSON to translate in bulk'}
          >
            {t('admin.translations_export_missing_json') || 'Export Missing JSON'}
          </button>
          <button
            onClick={handleExportFullJson}
            className="bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
            title={t('admin.translations_export_full_defaults_title') || 'Export full EN defaults'}
          >
            {t('admin.translations_export_full_defaults_en') || 'Export Full Defaults (EN)'}
          </button>
          <label className={`bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold cursor-pointer ${!selectedLanguage || isImportingJson ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {isImportingJson
              ? (t('admin.translations_import_json_loading') || 'Importing...')
              : (t('admin.translations_import_json') || 'Import JSON')}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              disabled={!selectedLanguage || isImportingJson}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleImportJsonFile(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {selectedLanguage && (
        <>
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600">
                Coverage: {progressPercent}% ({totalCount - missingCount}/{totalCount})
              </span>
              <span className="text-xs text-gray-500">
                Missing: <span className="font-semibold text-red-600">{missingCount}</span>
              </span>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showMissingOnly}
                  onChange={(e) => setShowMissingOnly(e.target.checked)}
                />
                Missing only
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Tip: Export missing JSON → translate it in Google Sheets → Import JSON.
            </p>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder={
                t('admin.translations_search_placeholder') || 'Search translations...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {displayedTranslations.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <p className="text-base sm:text-lg font-medium mb-2">
                  {translations.length === 0
                    ? t('admin.translations_empty_no_translations') ||
                      'No translations found. Click "Import Defaults" to get started.'
                    : t('admin.translations_empty_no_match') ||
                      'No translations match your search.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.translations_table_key') || 'Key'}</th>
                        <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.translations_table_translation') || 'Translation'}</th>
                        <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.translations_table_namespace') || 'Namespace'}</th>
                        <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">{t('admin.translations_table_actions') || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {displayedTranslations.map((translation) => (
                        <tr key={translation.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{translation.key}</td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{translation.value}</td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{translation.namespace || 'common'}</td>
                          <td className="px-4 sm:px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleEdit(translation)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {t('admin.translations_edit_button') || 'Edit'}
                            </button>
                            <button
                              onClick={() => handleDelete(translation.id!)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              {t('admin.translations_delete_button') || 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-200">
                  {displayedTranslations.map((translation) => (
                    <div key={translation.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">{translation.key}</h3>
                        <p className="text-xs text-gray-600 mb-2">{translation.value}</p>
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                          {translation.namespace || 'common'}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleEdit(translation)}
                          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          {t('admin.translations_edit_button') || 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(translation.id!)}
                          className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          {t('admin.translations_delete_button') || 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingTranslation
                ? t('admin.translations_modal_title_edit') || 'Edit Translation'
                : t('admin.translations_modal_title_add') || 'Add Translation'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.translations_field_key_label') || 'Key'}
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={
                    t('admin.translations_field_key_placeholder') ||
                    'e.g., products.add_to_cart'
                  }
                  required
                  disabled={!!editingTranslation}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.translations_field_translation_label') || 'Translation'}
                </label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                  placeholder={
                    t('admin.translations_field_translation_placeholder') ||
                    'Enter translated text'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.translations_field_namespace_label') || 'Namespace'}
                </label>
                <select
                  value={formData.namespace}
                  onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="common">
                    {t('admin.translations_namespace_common') || 'Common'}
                  </option>
                  <option value="products">
                    {t('admin.translations_namespace_products') || 'Products'}
                  </option>
                  <option value="cart">
                    {t('admin.translations_namespace_cart') || 'Cart'}
                  </option>
                  <option value="checkout">
                    {t('admin.translations_namespace_checkout') || 'Checkout'}
                  </option>
                  <option value="nav">
                    {t('admin.translations_namespace_nav') || 'Navigation'}
                  </option>
                  <option value="footer">
                    {t('admin.translations_namespace_footer') || 'Footer'}
                  </option>
                  <option value="admin">
                    {t('admin.translations_namespace_admin') || 'Admin'}
                  </option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTranslation(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('admin.translations_cancel_button') || t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTranslation
                    ? t('admin.translations_update_button') ||
                      t('common.update') ||
                      'Update'
                    : t('admin.translations_create_button') ||
                      t('common.create') ||
                      'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationsPage;

