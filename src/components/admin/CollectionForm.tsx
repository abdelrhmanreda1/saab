'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Collection, CollectionTranslation } from '@/lib/firestore/collections';
import { addCollection, updateCollection, getCollection, getAllCollections } from '@/lib/firestore/collections_db';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { getCollectionSEO, createOrUpdateCollectionSEO } from '@/lib/firestore/seo_db';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import { Language } from '@/lib/firestore/internationalization';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { optimizeImageForUpload } from '@/lib/utils/client-image';
import Dialog from '@/components/ui/Dialog';

interface CollectionFormProps {
  collectionId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CollectionForm: React.FC<CollectionFormProps> = ({ collectionId, onSuccess, onCancel }) => {
  const isEditMode = !!collectionId;

  const initialCollectionState: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    parentCollection: undefined,
  };

  const [collection, setCollection] = useState<Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>>(initialCollectionState);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('en');
  const [translations, setTranslations] = useState<CollectionTranslation[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const baseEnglishRef = useRef<{ name: string; description: string }>({ name: '', description: '' });
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const { currentLanguage, t } = useLanguage();
  const [seoData, setSeoData] = useState({
    title: '',
    description: '',
    keywords: '',
    metaImage: '',
    canonicalUrl: '',
    noIndex: false,
    noFollow: false,
  });

  const upsertTranslation = (
    existingTranslations: CollectionTranslation[],
    languageCode: string,
    values: Pick<CollectionTranslation, 'name' | 'description'>
  ): CollectionTranslation[] => {
    const normalizedCode = String(languageCode || '').trim().toLowerCase();
    if (!normalizedCode) {
      return existingTranslations;
    }

    const nextTranslation: CollectionTranslation = {
      languageCode,
      name: values.name || '',
      description: values.description || '',
      updatedAt: Timestamp.now(),
    };

    const existingIndex = existingTranslations.findIndex(
      (translation) => String(translation.languageCode || '').trim().toLowerCase() === normalizedCode
    );

    if (existingIndex >= 0) {
      const updatedTranslations = [...existingTranslations];
      updatedTranslations[existingIndex] = nextTranslation;
      return updatedTranslations;
    }

    return [...existingTranslations, nextTranslation];
  };

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

  useEffect(() => {
    // Load languages
    getAllLanguages(false).then(setLanguages).catch(() => {
      // Failed to load languages
    });
    fetchSettings();
    const defaultLang = currentLanguage?.code || 'en';
    setSelectedLanguageCode(defaultLang);
    
    // Load all collections for parent selection
    getAllCollections().then(setAllCollections).catch(() => {
      // Failed to load collections
    });
    
    if (isEditMode && collectionId) {
      setLoading(true);
      Promise.all([
        getCollection(collectionId),
        getCollectionSEO(collectionId)
      ])
        .then(([fetchedCollection, fetchedSEO]) => {
          if (fetchedCollection) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, createdAt, updatedAt, ...rest } = fetchedCollection;
            setCollection(rest);
            baseEnglishRef.current = {
              name: rest.name || '',
              description: rest.description || '',
            };
            
            // Set translations
            const collectionTranslations = (fetchedCollection as Collection & { translations?: CollectionTranslation[] }).translations;
            if (collectionTranslations && collectionTranslations.length > 0) {
              setTranslations(collectionTranslations);
              const defaultLang = collectionTranslations.find((t: CollectionTranslation) => t.languageCode === currentLanguage?.code) 
                || collectionTranslations.find((t: CollectionTranslation) => t.languageCode === 'en')
                || collectionTranslations[0];
              if (defaultLang) {
                setSelectedLanguageCode(defaultLang.languageCode);
                setCollection(prev => ({
                  ...prev,
                  name: defaultLang.name || prev.name,
                  description: defaultLang.description || prev.description
                }));
              }
            }
          } else {
            setError('Collection not found.');
          }
          if (fetchedSEO) {
            setSeoData({
              title: fetchedSEO.title || '',
              description: fetchedSEO.description || '',
              keywords: fetchedSEO.keywords?.join(', ') || '',
              metaImage: fetchedSEO.metaImage || '',
              canonicalUrl: fetchedSEO.canonicalUrl || '',
              noIndex: fetchedSEO.noIndex || false,
              noFollow: fetchedSEO.noFollow || false,
            });
          }
        })
        .catch(() => {
          setError(t('admin.collections_load_failed') || 'Failed to load collection.');
          // Failed to load collection
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, collectionId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCollection(prev => ({ ...prev, [name]: value === '' ? undefined : value }));
    
    if (name === 'name' || name === 'description') {
      setTranslations((prev: CollectionTranslation[]) =>
        upsertTranslation(prev, selectedLanguageCode, {
          name: name === 'name' ? value : (collection.name || ''),
          description: name === 'description' ? value : (collection.description || ''),
        })
      );
    }
  };

  // Handle language change by persisting the current language values before switching.
  const handleLanguageChange = (languageCode: string) => {
    setTranslations((prev: CollectionTranslation[]) =>
      upsertTranslation(prev, selectedLanguageCode, {
        name: collection.name || '',
        description: collection.description || '',
      })
    );

    setSelectedLanguageCode(languageCode);
    const translation = translations.find((t: CollectionTranslation) => t.languageCode === languageCode);
    if (translation) {
      setCollection(prev => ({
        ...prev,
        name: translation.name || '',
        description: translation.description || ''
      }));
    } else {
      setCollection(prev => ({
        ...prev,
        name: '',
        description: ''
      }));
    }
  };

  // Get available parent collections (exclude current collection and its children to prevent circular references)
  const getAvailableParents = () => {
    if (!isEditMode || !collectionId) {
      return allCollections.filter(c => !c.parentCollection); // Only top-level collections
    }
    // In edit mode, exclude current collection and any collections that have this collection as parent (to prevent circular references)
    const excludeIds = new Set([collectionId]);
    // Find all collections that have current collection as parent (children)
    allCollections.forEach(c => {
      if (c.parentCollection === collectionId) {
        excludeIds.add(c.id);
      }
    });
    return allCollections.filter(c => !excludeIds.has(c.id) && !c.parentCollection);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let imageUrl = collection.imageUrl;

      if (imageFile) {
        const optimizedImage = await optimizeImageForUpload(imageFile, { maxWidth: 1400, maxHeight: 1400, quality: 0.8 });
        const storageRef = ref(storage, `collections/${Date.now()}_${optimizedImage.name}`);
        const uploadResult = await uploadBytes(storageRef, optimizedImage, {
          contentType: optimizedImage.type,
        });
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      const finalTranslations = upsertTranslation(
        [...translations],
        selectedLanguageCode,
        {
          name: collection.name || '',
          description: collection.description || '',
        }
      );

      const englishTranslation =
        String(selectedLanguageCode || '').trim().toLowerCase() === 'en'
          ? { name: collection.name || '', description: collection.description || '' }
          : finalTranslations.find(
              (translation) => String(translation.languageCode || '').trim().toLowerCase() === 'en'
            );

      const collectionData: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'> & {
        imageUrl?: string;
        translations?: CollectionTranslation[];
      } = {
        ...collection,
        name: englishTranslation?.name || baseEnglishRef.current.name || '',
        description: englishTranslation?.description || baseEnglishRef.current.description || '',
        imageUrl,
      };

      const localizedTranslations = finalTranslations.filter(
        (translation) =>
          String(translation.languageCode || '').trim().toLowerCase() !== 'en' &&
          Boolean(translation.name || translation.description)
      );

      if (localizedTranslations.length > 0) {
        collectionData.translations = localizedTranslations;
      }

      let savedCollectionId = collectionId;
      if (isEditMode && collectionId) {
        await updateCollection(collectionId, collectionData);
      } else {
        savedCollectionId = await addCollection(collectionData);
      }

      // Save SEO data
      if (savedCollectionId && (seoData.title || seoData.description || seoData.keywords || seoData.metaImage || seoData.canonicalUrl)) {
        await createOrUpdateCollectionSEO({
          collectionId: savedCollectionId,
          title: seoData.title || undefined,
          description: seoData.description || undefined,
          keywords: seoData.keywords ? seoData.keywords.split(',').map(k => k.trim()).filter(k => k) : undefined,
          metaImage: seoData.metaImage || undefined,
          canonicalUrl: seoData.canonicalUrl || undefined,
          noIndex: seoData.noIndex,
          noFollow: seoData.noFollow,
        });
      }

      onSuccess();
    } catch {
      setError(t('admin.collections_save_failed') || 'Failed to save collection.');
      // Failed to save collection
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode && !collection.name) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {t('common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-gray-900">
        {isEditMode
          ? `${t('common.edit') || 'Edit'} ${t('admin.collections') || 'Collections'}`
          : `${t('common.add') || 'Add'} ${t('admin.collections') || 'Collections'}`}
      </h2>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Language Selector */}
        {languages.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('admin.select_language') || 'Select Language'}
            </label>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang: Language) => {
                const hasTranslation = translations.some((t: CollectionTranslation) => t.languageCode === lang.code);
                const isSelected = selectedLanguageCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : hasTranslation
                        ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {lang.name} {lang.nativeName && `(${lang.nativeName})`}
                    {!hasTranslation && <span className="ml-1 sm:ml-2 text-xs">{t('admin.language_new_badge') || 'New'}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.collections_table_name') || t('common.name') || 'Name'}
            </label>
            <input
              type="text"
              name="name"
              value={collection.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.collections_table_slug') || 'Slug'}
            </label>
            <input
              type="text"
              name="slug"
              value={collection.slug}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            {t('admin.collections_table_description') || t('common.description') || 'Description'}
          </label>
          <textarea
            name="description"
            value={collection.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            {t('admin.collections_parent_optional') || 'Parent Collection (Optional)'}
          </label>
          <select
            name="parentCollection"
            value={collection.parentCollection || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all bg-white"
          >
            <option value="">{t('admin.collections_parent_none_top_level') || 'None (Top Level Collection)'}</option>
            {getAvailableParents().map((parentCol) => (
              <option key={parentCol.id} value={parentCol.id}>
                {parentCol.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('admin.collections_parent_help') || 'Select a parent collection to create a sub-collection'}</p>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            {t('admin.collections_image_label') || 'Collection Image'}
          </label>
          
          <div className="flex flex-col gap-4">
            {(imagePreview || collection.imageUrl) && (
                <div className="relative w-full max-w-xs h-40 sm:h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <Image 
                    src={imagePreview || collection.imageUrl || '/placeholder.png'} 
                    alt="Collection Preview"  
                    fill
                    className="object-cover"
                  />
                </div>
            )}
            
            <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file-collection" className="flex flex-col items-center justify-center w-full h-28 sm:h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-4 sm:pb-6 px-4">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-1 sm:mb-2 text-xs sm:text-sm text-gray-500 text-center">
                          <span className="font-semibold">
                            {t('admin.upload_click_to_upload') || 'Click to upload'}
                          </span>{' '}
                          {t('admin.upload_or_drag_drop') || 'or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500 text-center">
                          {t('admin.upload_file_types_hint') || 'SVG, PNG, JPG or GIF (MAX. 800x400px)'}
                        </p>
                    </div>
                    <input id="dropzone-file-collection" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
            </div>
            
            {/* Fallback URL input (optional, or hidden) */}
             <div className="text-xs text-gray-400">
                {t('admin.upload_or_enter_url_manually') || 'Or enter URL manually:'}
                <input
                  type="text"
                  name="imageUrl"
                  value={collection.imageUrl}
                  onChange={handleChange}
                  placeholder={t('admin.upload_url_placeholder') || 'https://example.com/image.jpg'}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
             </div>
          </div>
        </div>

        {/* SEO Configuration */}
        <div className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{t('admin.products_seo_configuration') || 'SEO Configuration'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_title') || 'Meta Title'}</label>
              <input
                type="text"
                value={seoData.title}
                onChange={(e) => setSeoData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={collection.name || (t('admin.collections_seo_meta_title_placeholder') || 'Collection meta title')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_description') || 'Meta Description'}</label>
              <textarea
                value={seoData.description}
                onChange={(e) => setSeoData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none h-24 resize-none"
                placeholder={t('admin.products_seo_meta_description_placeholder') || 'Brief description for search engines...'}
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_keywords_label') || 'Keywords (comma-separated)'}</label>
              <input
                type="text"
                value={seoData.keywords}
                onChange={(e) => setSeoData(prev => ({ ...prev, keywords: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.products_seo_keywords_placeholder') || 'keyword1, keyword2, keyword3'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_image_url') || 'Meta Image URL'}</label>
              <input
                type="text"
                value={seoData.metaImage}
                onChange={(e) => setSeoData(prev => ({ ...prev, metaImage: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.upload_url_placeholder') || 'https://example.com/image.jpg'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_canonical_url') || 'Canonical URL'}</label>
              <input
                type="text"
                value={seoData.canonicalUrl}
                onChange={(e) => setSeoData(prev => ({ ...prev, canonicalUrl: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.collections_seo_canonical_placeholder') || 'https://example.com/collection-url'}
              />
            </div>

            <div className="flex flex-wrap gap-4 sm:gap-6">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={seoData.noIndex}
                  onChange={(e) => setSeoData(prev => ({ ...prev, noIndex: e.target.checked }))}
                  className="h-4 w-4 sm:h-5 sm:w-5 border-gray-300 rounded focus:ring-gray-900 text-gray-900"
                />
                <span className="ml-2 text-sm text-gray-700">{t('admin.seo_no_index') || 'No Index'}</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={seoData.noFollow}
                  onChange={(e) => setSeoData(prev => ({ ...prev, noFollow: e.target.checked }))}
                  className="h-4 w-4 sm:h-5 sm:w-5 border-gray-300 rounded focus:ring-gray-900 text-gray-900"
                />
                <span className="ml-2 text-sm text-gray-700">{t('admin.seo_no_follow') || 'No Follow'}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 sm:gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            className="px-4 sm:px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('common.saving') || 'Saving...'}
              </>
            ) : (
              isEditMode ? (t('admin.collections_update_button') || 'Update Collection') : (t('admin.collections_create_button') || 'Create Collection')
            )}
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

export default CollectionForm;

