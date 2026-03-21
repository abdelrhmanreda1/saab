'use client';

import React, { useState, useEffect } from 'react';
import { getStates, addState, updateState, deleteState, getCountries } from '@/lib/firestore/geography_db';
import { State, Country } from '@/lib/firestore/geography';
import { useSettings } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import Dialog from '@/components/ui/Dialog';

const StatesPage = () => {
  const { settings } = useSettings();
  const { t } = useLanguage();
  const [states, setStates] = useState<State[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState<Partial<State>>({
    name: '',
    countryId: '',
    code: '',
    status: 'active'
  });

  const fetchStates = React.useCallback(async () => {
    setLoading(true);
    const data = await getStates(selectedCountryFilter || undefined);
    
    // Join with country name manually if needed, or rely on stored countryName
    // Let's ensure we display country name correctly.
    const enrichedData = data.map(state => {
       const country = countries.find(c => c.id === state.countryId);
       return { ...state, countryName: country?.name || state.countryName || 'Unknown' };
    });

    setStates(enrichedData);
    setLoading(false);
  }, [selectedCountryFilter, countries]);

  const fetchData = React.useCallback(async () => {
    const countriesData = await getCountries();
    setCountries(countriesData);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (countries.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStates();
    }
  }, [selectedCountryFilter, fetchStates, countries.length]);

  // Check if states feature is enabled
  if (!settings?.geography?.states) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">{t('admin.geography_states_not_available') || 'States Not Available'}</h1>
          <p className="text-gray-500 mb-6">{t('admin.geography_feature_disabled') || 'This feature is currently disabled in Geography Settings.'}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings?.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const selectedCountry = countries.find(c => c.id === formData.countryId);
      const dataToSave = {
        ...formData,
        countryName: selectedCountry?.name
      };

      if (editingId) {
        await updateState(editingId, dataToSave);
      } else {
        await addState(dataToSave as State);
      }
      setIsModalOpen(false);
      resetForm();
      fetchStates();
      setInfoDialogMessage(editingId ? (t('admin.geography_states_update_success') || 'State updated successfully!') : (t('admin.geography_states_create_success') || 'State created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Error saving state
      setInfoDialogMessage(t('admin.geography_states_save_failed') || 'Failed to save state');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleEdit = (state: State) => {
    setEditingId(state.id!);
    setFormData({
      name: state.name,
      countryId: state.countryId,
      code: state.code,
      status: state.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Check if demo mode is enabled
    if (settings?.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.geography_states_delete_confirm') || 'Are you sure you want to delete this state?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteState(id);
        fetchStates();
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.geography_states_delete_success') || 'State deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.geography_states_delete_failed') || 'Failed to delete state');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (settings?.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    const count = selectedIds.size;
    setConfirmDialogMessage(t('admin.geography_states_batch_delete_confirm', { count: count.toString() }) || `Are you sure you want to delete ${count} state(s)?`);
    setConfirmDialogAction(() => async () => {
      try {
        const deletePromises = Array.from(selectedIds).map(id => deleteState(id));
        await Promise.all(deletePromises);
        fetchStates();
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.geography_states_batch_delete_success', { count: count.toString() }) || `${count} state(s) deleted successfully!`);
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.geography_states_batch_delete_failed') || 'Failed to delete states.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedStates.map(state => state.id!).filter(Boolean) as string[];
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
  const totalPages = Math.ceil(states.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStates = states.slice(startIndex, endIndex);
  const isAllSelected = paginatedStates.length > 0 && paginatedStates.every(state => state.id && selectedIds.has(state.id));
  const isSomeSelected = paginatedStates.some(state => state.id && selectedIds.has(state.id));

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      countryId: '',
      code: '',
      status: 'active'
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.geography_states') || 'States / Provinces'}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.geography_states_subtitle') || 'Manage state and province information'}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <select
            value={selectedCountryFilter}
            onChange={(e) => setSelectedCountryFilter(e.target.value)}
            className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="">{t('admin.geography_all_countries') || 'All Countries'}</option>
            {countries.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('admin.geography_states_add') || 'Add State'}
          </button>
        </div>
      </div>

      {/* Batch Actions & Items Per Page */}
      {states.length > 0 && (
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

      {/* Desktop Table View */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {states.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.geography_states_empty') || 'No states found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.geography_states_empty_message') || 'Get started by adding your first state'}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
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
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.geography_table_name') || 'Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.geography_table_code') || 'Code'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.geography_table_country') || 'Country'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.geography_table_status') || 'Status'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">{t('admin.geography_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedStates.map((state) => (
                    <tr key={state.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(state.id!) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={state.id ? selectedIds.has(state.id) : false}
                          onChange={(e) => state.id && handleSelectItem(state.id, e.target.checked)}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">{state.name}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{state.code}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {countries.find(c => c.id === state.countryId)?.name || state.countryName || (t('admin.geography_unknown') || 'Unknown')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                          state.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {state.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(state)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('admin.common.edit') || t('common.edit') || 'Edit'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(state.id!)}
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
              {paginatedStates.map((state) => (
                <div key={state.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(state.id!) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={state.id ? selectedIds.has(state.id) : false}
                      onChange={(e) => state.id && handleSelectItem(state.id, e.target.checked)}
                      className="w-4 h-4 mt-1 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <div className="flex items-start justify-between flex-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{state.name}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>{t('admin.geography_table_code') || 'Code'}: {state.code}</p>
                        <p>{t('admin.geography_table_country') || 'Country'}: {countries.find(c => c.id === state.countryId)?.name || state.countryName || (t('admin.geography_unknown') || 'Unknown')}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                      state.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {state.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(state)}
                      className="p-2.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('admin.common.edit') || t('common.edit') || 'Edit'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(state.id!)}
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
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, states.length)} {t('admin.common.of') || 'of'} {states.length} {t('admin.common.results') || 'results'}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingId ? (t('admin.geography_states_edit') || 'Edit State') : (t('admin.geography_states_add_new') || 'Add New State')}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.geography_form_country') || 'Country'}</label>
                <select 
                  required
                  value={formData.countryId}
                  onChange={(e) => setFormData({...formData, countryId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
                >
                  <option value="">{t('admin.geography_form_select_country') || 'Select Country'}</option>
                  {countries.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.geography_form_state_name') || 'State Name'}</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="e.g. Punjab"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.geography_form_state_code') || 'State Code'}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    placeholder="e.g. PB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.geography_form_status') || 'Status'}</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
                  >
                    <option value="active">{t('admin.geography_status_active') || 'Active'}</option>
                    <option value="inactive">{t('admin.geography_status_inactive') || 'Inactive'}</option>
                  </select>
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
                  {editingId ? (t('admin.geography_states_update') || 'Update State') : (t('admin.geography_states_add') || 'Add State')}
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

export default StatesPage;
