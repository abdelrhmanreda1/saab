'use client';

import React, { useEffect, useState } from 'react';
import { getAllUsers, addUser, updateUser, blockUser, deleteUser, UserProfile } from '@/lib/firestore/users_db';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';
import { useSettings } from '@/context/SettingsContext';
import 'react-phone-number-input/style.css';
import { Value } from 'react-phone-number-input';
import type { Country as PhoneCountry } from 'react-phone-number-input';
import dynamic from 'next/dynamic';

const PhoneInput = dynamic(() => import('react-phone-number-input'), { ssr: false });

const CustomerList = () => {
  const { t } = useLanguage();
  const { settings: contextSettings } = useSettings();
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phoneNumber: '' as Value | undefined,
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const fetchedCustomers = await getAllUsers(); 
        // Filter out admin users - only show customers
        setCustomers(fetchedCustomers.filter(user => user.role !== 'admin'));
      } catch {
        setInfoDialogMessage(t('admin.customers_fetch_failed') || 'Failed to fetch customers.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
    fetchSettings();
  }, [t]);

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

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      displayName: '',
      email: '',
      phoneNumber: undefined,
    });
    setIsModalOpen(true);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber as Value | undefined,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({
      displayName: '',
      email: '',
      phoneNumber: undefined,
    });
  };

  const handlePhoneChange = (value: Value | undefined) => {
    setFormData({ ...formData, phoneNumber: value });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const userData: Omit<UserProfile, 'uid' | 'createdAt'> = {
        displayName: formData.displayName,
        email: formData.email,
        phoneNumber: formData.phoneNumber as string || '',
        role: 'customer',
      };
      if (editingUser) {
        await updateUser(editingUser.uid, userData);
      } else {
        await addUser(userData);
      }
      // Refresh customer list
      const updatedCustomers = await getAllUsers();
      setCustomers(updatedCustomers.filter(user => user.role !== 'admin'));
      handleCloseModal();
      setInfoDialogMessage(editingUser ? (t('admin.customers_update_success') || 'User updated successfully!') : (t('admin.customers_create_success') || 'User created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      setInfoDialogMessage(t('admin.customers_save_failed') || 'Failed to save user.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleBlockToggle = async (user: UserProfile) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await blockUser(user.uid, !user.isBlocked);
      // Refresh customer list
      const updatedCustomers = await getAllUsers();
      setCustomers(updatedCustomers);
      setInfoDialogMessage(user.isBlocked ? (t('admin.customers_unblock_success') || 'User unblocked successfully!') : (t('admin.customers_block_success') || 'User blocked successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      setInfoDialogMessage(t('admin.customers_block_toggle_failed') || 'Failed to toggle block status.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.customers_delete_confirm') || 'Are you sure you want to delete this user?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteUser(uid);
        // Refresh customer list
        const updatedCustomers = await getAllUsers();
        setCustomers(updatedCustomers.filter(user => user.role !== 'admin'));
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.customers_delete_success') || 'User deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.customers_delete_failed') || 'Failed to delete user.');
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
    setConfirmDialogMessage(t('admin.customers_batch_delete_confirm', { count: count.toString() }) || `Are you sure you want to delete ${count} customer(s)?`);
    setConfirmDialogAction(() => async () => {
      try {
        const deletePromises = Array.from(selectedIds).map(uid => deleteUser(uid));
        await Promise.all(deletePromises);
        const updatedCustomers = await getAllUsers();
        setCustomers(updatedCustomers.filter(user => user.role !== 'admin'));
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.customers_batch_delete_success', { count: count.toString() }) || `${count} customer(s) deleted successfully!`);
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.customers_batch_delete_failed') || 'Failed to delete customers.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedCustomers.map(customer => customer.uid).filter(Boolean) as string[];
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (uid: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(uid);
    } else {
      newSelected.delete(uid);
    }
    setSelectedIds(newSelected);
  };

  // Pagination logic
  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = customers.slice(startIndex, endIndex);
  const isAllSelected = paginatedCustomers.length > 0 && paginatedCustomers.every(customer => customer.uid && selectedIds.has(customer.uid));
  const isSomeSelected = paginatedCustomers.some(customer => customer.uid && selectedIds.has(customer.uid));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.customers_page_title')}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.customers_subtitle') || 'Manage your customers and user accounts'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/customers/segmentation"
            className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm font-semibold"
          >
            {t('admin.customer_segmentation')}
          </Link>
          <Link
            href="/admin/customers/tags"
            className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-semibold"
          >
            {t('admin.customer_tags')}
          </Link>
          <Link
            href="/admin/customers/import-export"
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-semibold"
          >
            {t('admin.customers_import_export')}
          </Link>
          <button
            className="px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs sm:text-sm font-semibold"
            onClick={handleAddUser}
          >
            {t('admin.customers_add_new_user')}
          </button>
        </div>
      </div>

      {/* Batch Actions & Items Per Page */}
      {customers.length > 0 && (
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
        {customers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.customers_empty')}</p>
            <p className="text-sm text-gray-400">{t('admin.customers_empty_message') || 'Get started by adding your first customer'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
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
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customers_table_name') || 'Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customers_table_email') || 'Email'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customers_table_phone') || 'Phone'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customers_table_role') || 'Role'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customers_table_joined') || 'Joined'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customers_table_status') || 'Status'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">{t('admin.customers_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedCustomers.map((customer) => (
                    <tr key={customer.uid} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(customer.uid) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={customer.uid ? selectedIds.has(customer.uid) : false}
                          onChange={(e) => customer.uid && handleSelectItem(customer.uid, e.target.checked)}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                        {customer.displayName || t('common.not_available')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {settings.demoMode ? '************' : customer.email}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {settings.demoMode ? '************' : (customer.phoneNumber || t('common.not_available'))}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                          customer.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {customer.role === 'admin' ? t('admin.customers_role_admin') : t('admin.customers_role_customer')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {customer.createdAt?.toDate
                          ? customer.createdAt.toDate().toLocaleDateString()
                          : t('admin.customers_joined_na')}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                          customer.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {customer.isBlocked ? t('admin.customers_status_blocked') : t('admin.customers_status_active')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/customers/${customer.uid}`}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('common.view') || 'View'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <button
                            className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            onClick={() => handleEditUser(customer)}
                            title={t('admin.common.edit') || t('common.edit') || 'Edit'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            className={`p-2 rounded-lg transition-colors ${
                              customer.isBlocked 
                                ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                                : 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
                            }`}
                            onClick={() => handleBlockToggle(customer)}
                            title={customer.isBlocked ? t('admin.customers_unblock') : t('admin.customers_block')}
                          >
                            {customer.isBlocked ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            )}
                          </button>
                          <button
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => handleDeleteUser(customer.uid)}
                            title={t('admin.common.delete') || 'Delete'}
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
              {paginatedCustomers.map((customer) => (
                <div key={customer.uid} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(customer.uid) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={customer.uid ? selectedIds.has(customer.uid) : false}
                      onChange={(e) => customer.uid && handleSelectItem(customer.uid, e.target.checked)}
                      className="w-4 h-4 mt-1 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {customer.displayName || t('common.not_available')}
                      </h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p className="truncate">{settings.demoMode ? '************' : customer.email}</p>
                        <p>{t('admin.customers_table_phone') || 'Phone'}: {settings.demoMode ? '************' : (customer.phoneNumber || t('common.not_available'))}</p>
                        <p>{t('admin.customers_table_joined') || 'Joined'}: {customer.createdAt?.toDate
                          ? customer.createdAt.toDate().toLocaleDateString()
                          : t('admin.customers_joined_na')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                      customer.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {customer.role === 'admin' ? t('admin.customers_role_admin') : t('admin.customers_role_customer')}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                      customer.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {customer.isBlocked ? t('admin.customers_status_blocked') : t('admin.customers_status_active')}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                    <Link
                      href={`/admin/customers/${customer.uid}`}
                      className="p-2.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('common.view') || 'View'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                    <button
                      className="p-2.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                      onClick={() => handleEditUser(customer)}
                      title={t('admin.common.edit') || t('common.edit') || 'Edit'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      className={`p-2.5 rounded-lg transition-colors ${
                        customer.isBlocked 
                          ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                          : 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
                      }`}
                      onClick={() => handleBlockToggle(customer)}
                      title={customer.isBlocked ? t('admin.customers_unblock') : t('admin.customers_block')}
                    >
                      {customer.isBlocked ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="p-2.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      onClick={() => handleDeleteUser(customer.uid)}
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
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, customers.length)} {t('admin.common.of') || 'of'} {customers.length} {t('admin.common.results') || 'results'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingUser
                  ? t('admin.customers_modal_title_edit')
                  : t('admin.customers_modal_title_add')}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="displayName" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.customers_modal_display_name') || 'Display Name'}
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  placeholder={t('admin.customers_modal_display_name_placeholder') || 'Enter display name'}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.customers_modal_email') || 'Email'} *
                </label>
                {settings.demoMode ? (
                  <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    ************
                  </div>
                ) : (
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder={t('admin.customers_modal_email_placeholder') || 'Enter email address'}
                  />
                )}
              </div>
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.customers_modal_phone') || 'Phone Number'}
                </label>
                {settings.demoMode ? (
                  <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    ************
                  </div>
                ) : (
                  <div className="phone-input-container">
                    <PhoneInput
                      international
                      defaultCountry={(contextSettings?.site?.defaultCountry as PhoneCountry) || ("PK" as PhoneCountry)}
                      value={formData.phoneNumber}
                      onChange={handlePhoneChange}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 sm:px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  {t('admin.customers_modal_cancel') || t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold"
                >
                  {t('admin.customers_modal_save') || t('common.save') || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom styles for PhoneInput */}
      <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .PhoneInputCountry {
          position: relative;
          align-self: stretch;
          display: flex;
          align-items: center;
          padding-right: 0.5rem;
          margin-right: 0.5rem;
          border-right: 1px solid #e5e7eb;
        }
        .PhoneInputCountryIcon {
          width: 1.5rem;
          height: 1rem;
          box-shadow: 0 0 1px rgba(0,0,0,0.5);
        }
        .PhoneInputCountrySelect {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          z-index: 1;
          border: 0;
          opacity: 0;
          cursor: pointer;
        }
        .PhoneInputInput {
          flex: 1;
          min-width: 0;
          background-color: transparent;
          border: none;
          padding: 0;
          font-size: 1rem;
          line-height: 1.5rem;
          color: #111827;
        }
        .PhoneInputInput:focus {
          outline: none;
        }
        .phone-input-container {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.625rem 1rem;
          transition: all 0.2s;
        }
        .phone-input-container:focus-within {
          border-color: #000;
          ring: 1px solid #000;
          box-shadow: 0 0 0 1px #000;
        }
      `}</style>

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

export default CustomerList;
