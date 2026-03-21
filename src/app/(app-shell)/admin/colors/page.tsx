'use client';

import React, { useState, useEffect } from 'react';
import { getColors, addColor, updateColor, deleteColor } from '@/lib/firestore/attributes_db';
import { Color, ColorTranslation } from '@/lib/firestore/attributes';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import { Language } from '@/lib/firestore/internationalization';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const ColorsPage = () => {
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('en');
  const [translations, setTranslations] = useState<ColorTranslation[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const { currentLanguage, t } = useLanguage();
  
  // Form State
  const [formData, setFormData] = useState<Partial<Color>>({
    name: '',
    hexCode: '#000000'
  });

  const fetchColors = React.useCallback(async () => {
    setLoading(true);
    const data = await getColors();
    setColors(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load languages
    getAllLanguages(false).then(setLanguages).catch(() => {
      // Error loading languages
    });
  }, []);

  useEffect(() => {
    // Fetch colors on mount and when fetchColors changes
    fetchColors();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    const defaultLang = currentLanguage?.code || 'en';
    if (defaultLang !== selectedLanguageCode) {
      setSelectedLanguageCode(defaultLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage?.code]);

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
      // Save current translation if editing a specific language
      const finalTranslations = [...translations];
      if (selectedLanguageCode !== 'en') {
        const existingIndex = finalTranslations.findIndex((t: ColorTranslation) => t.languageCode === selectedLanguageCode);
        const currentTranslation: ColorTranslation = {
          languageCode: selectedLanguageCode,
          name: formData.name || '',
          updatedAt: Timestamp.now()
        };
        if (existingIndex >= 0) {
          finalTranslations[existingIndex] = currentTranslation;
        } else {
          finalTranslations.push(currentTranslation);
        }
      }

      const colorData: Partial<Color> & { translations?: ColorTranslation[] } = { ...formData };
      if (finalTranslations.length > 0) {
        colorData.translations = finalTranslations;
      }

      if (editingId) {
        await updateColor(editingId, colorData);
      } else {
        await addColor(colorData as Color);
      }
      setIsModalOpen(false);
      resetForm();
      fetchColors();
      setInfoDialogMessage(editingId ? (t('admin.colors_update_success') || 'Color updated successfully!') : (t('admin.colors_create_success') || 'Color created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Error saving color
      setInfoDialogMessage(t('admin.colors_save_failed') || 'Failed to save color');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleEdit = (color: Color) => {
    setEditingId(color.id!);
    setFormData({
      name: color.name,
      hexCode: color.hexCode
    });
    
    // Load translations
    const colorTranslations = (color as Color & { translations?: ColorTranslation[] }).translations;
    if (colorTranslations && colorTranslations.length > 0) {
      setTranslations(colorTranslations);
      const defaultLang = colorTranslations.find((t: ColorTranslation) => t.languageCode === currentLanguage?.code) 
        || colorTranslations.find((t: ColorTranslation) => t.languageCode === 'en')
        || colorTranslations[0];
      if (defaultLang) {
        setSelectedLanguageCode(defaultLang.languageCode);
        setFormData(prev => ({
          ...prev,
          name: defaultLang.name || prev.name
        }));
      }
    } else {
      setTranslations([]);
      setSelectedLanguageCode(currentLanguage?.code || 'en');
    }
    
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.colors_delete_confirm') || 'Are you sure you want to delete this color?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteColor(id);
        fetchColors();
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.colors_delete_success') || 'Color deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.colors_delete_failed') || 'Failed to delete color');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    const count = selectedIds.size;
    setConfirmDialogMessage(t('admin.colors_batch_delete_confirm', { count: count.toString() }) || `Are you sure you want to delete ${count} color(s)?`);
    setConfirmDialogAction(() => async () => {
      try {
        const deletePromises = Array.from(selectedIds).map(id => deleteColor(id));
        await Promise.all(deletePromises);
        fetchColors();
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.colors_batch_delete_success', { count: count.toString() }) || `${count} color(s) deleted successfully!`);
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.colors_batch_delete_failed') || 'Failed to delete colors.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedColors.map(color => color.id!).filter(Boolean) as string[];
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Pagination logic
  const totalPages = Math.ceil(colors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedColors = colors.slice(startIndex, endIndex);
  const isAllSelected = paginatedColors.length > 0 && paginatedColors.every(color => color.id && selectedIds.has(color.id));
  const isSomeSelected = paginatedColors.some(color => color.id && selectedIds.has(color.id));

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      hexCode: '#000000'
    });
    setTranslations([]);
    setSelectedLanguageCode(currentLanguage?.code || 'en');
  };

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguageCode(languageCode);
    const translation = translations.find((t: ColorTranslation) => t.languageCode === languageCode);
    if (translation) {
      setFormData(prev => ({
        ...prev,
        name: translation.name || prev.name
      }));
    } else if (languageCode === 'en') {
      // Reset to default name when switching to English
      const color = colors.find(c => c.id === editingId);
      if (color) {
        setFormData(prev => ({
          ...prev,
          name: color.name
        }));
      }
    }
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
    
    // Update translation if editing a specific language
    if (selectedLanguageCode !== 'en') {
      setTranslations((prev: ColorTranslation[]) => {
        const existing = prev.find((t: ColorTranslation) => t.languageCode === selectedLanguageCode);
        if (existing) {
          return prev.map((t: ColorTranslation) => 
            t.languageCode === selectedLanguageCode 
              ? { ...t, name: value, updatedAt: Timestamp.now() }
              : t
          );
        } else {
          return [...prev, {
            languageCode: selectedLanguageCode,
            name: value,
            updatedAt: Timestamp.now()
          }];
        }
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.colors') || 'Colors'}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.colors_subtitle') || 'Manage product colors'}</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.colors_add_new') || 'Add Color'}
        </button>
      </div>

      {/* Batch Actions & Items Per Page */}
      {!loading && colors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  {t('admin.common.delete_selected') || 'Delete Selected'} ({selectedIds.size})
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {t('admin.common.clear_selection') || 'Clear Selection'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 font-medium">{t('admin.common.items_per_page') || 'Items per page'}:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">{t('admin.common.loading') || 'Loading...'}</div>
        ) : colors.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.colors_empty_title') || 'No colors found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.colors_empty_message') || 'Get started by creating your first color'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-600 w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = isSomeSelected && !isAllSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      />
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-600">{t('admin.colors_table_preview') || 'Preview'}</th>
                    <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-600">{t('admin.colors_table_name') || 'Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-600">{t('admin.colors_table_hex_code') || 'Hex Code'}</th>
                    <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-600 text-right">{t('admin.colors_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedColors.map((color) => (
                    <tr key={color.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(color.id!) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={color.id ? selectedIds.has(color.id) : false}
                          onChange={(e) => color.id && handleSelectItem(color.id, e.target.checked)}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div 
                          className="w-8 h-8 rounded-full border border-gray-200 shadow-sm"
                          style={{ backgroundColor: color.hexCode }}
                        ></div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">{color.name}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 font-mono uppercase">{color.hexCode}</td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(color)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('admin.common.edit') || t('common.edit') || 'Edit'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(color.id!)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('admin.common.delete') || t('common.delete') || 'Delete'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
              {paginatedColors.map((color) => (
                <div key={color.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(color.id!) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={color.id ? selectedIds.has(color.id) : false}
                      onChange={(e) => color.id && handleSelectItem(color.id, e.target.checked)}
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <div className="flex items-center gap-3 flex-1">
                      <div 
                        className="w-12 h-12 rounded-full border-2 border-gray-200 shadow-sm flex-shrink-0"
                        style={{ backgroundColor: color.hexCode }}
                      ></div>
                      <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{color.name}</h3>
                        <p className="text-xs text-gray-600 font-mono uppercase">{color.hexCode}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                    <button 
                      onClick={() => handleEdit(color)}
                      className="p-2.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('admin.common.edit') || t('common.edit') || 'Edit'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(color.id!)}
                      className="p-2.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('admin.common.delete') || t('common.delete') || 'Delete'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-700">
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, colors.length)} {t('admin.common.of') || 'of'} {colors.length} {t('admin.common.results') || 'results'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.previous') || 'Previous'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.next') || 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 sm:p-6 transform transition-all max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingId ? (t('admin.colors_edit_title') || 'Edit Color') : (t('admin.colors_add_title') || 'Add New Color')}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Language Selector */}
              {languages.length > 0 && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('admin.select_language') || 'Select Language'}</label>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang: Language) => {
                      const hasTranslation = translations.some((t: ColorTranslation) => t.languageCode === lang.code);
                      const isSelected = selectedLanguageCode === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleLanguageChange(lang.code)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-black text-white'
                              : hasTranslation
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {lang.name} {lang.nativeName && `(${lang.nativeName})`}
                          {!hasTranslation && <span className="ml-1 text-xs">{t('admin.new_translation') || '(New)'}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.colors_name_label') || 'Color Name'}</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder={t('admin.colors_name_placeholder') || "e.g. Navy Blue"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.colors_picker_label') || 'Color Picker'}</label>
                <div className="flex gap-4">
                  <input 
                    type="color" 
                    value={formData.hexCode}
                    onChange={(e) => setFormData({...formData, hexCode: e.target.value})}
                    className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                  />
                  <input 
                    type="text" 
                    required
                    value={formData.hexCode}
                    onChange={(e) => setFormData({...formData, hexCode: e.target.value})}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-mono"
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('admin.common.cancel') || 'Cancel'}
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {editingId ? (t('admin.colors_update_button') || 'Update Color') : (t('admin.colors_add_button') || 'Add Color')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default ColorsPage;
