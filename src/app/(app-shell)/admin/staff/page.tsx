'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getAllStaffMembers, deleteStaffMember, updateStaffMember } from '@/lib/firestore/user_management_db';
import { StaffMember, AdminRole } from '@/lib/firestore/user_management';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const StaffPage = () => {
  const { t } = useLanguage();
  const [, setUser] = useState<User | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const fetchedStaff = await getAllStaffMembers();
          setStaffMembers(fetchedStaff);
        } catch {
          // Failed to fetch staff
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

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

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      await updateStaffMember(id, { isActive: !currentStatus });
      setStaffMembers(staffMembers.map(s => s.id === id ? { ...s, isActive: !currentStatus } : s));
      setInfoDialogMessage(t('admin.staff_update_success') || 'Staff member updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to update staff
      setInfoDialogMessage(t('admin.staff.update_failed') || 'Failed to update staff member.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.staff.delete_confirm') || 'Are you sure you want to delete this staff member?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteStaffMember(id);
        setStaffMembers(staffMembers.filter(s => s.id !== id));
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.staff_delete_success') || 'Staff member deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete staff
        setInfoDialogMessage(t('admin.staff.delete_failed') || 'Failed to delete staff member.');
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
    setConfirmDialogMessage(t('admin.staff_batch_delete_confirm', { count: count.toString() }) || `Are you sure you want to delete ${count} staff member(s)?`);
    setConfirmDialogAction(() => async () => {
      try {
        const deletePromises = Array.from(selectedIds).map(id => deleteStaffMember(id));
        await Promise.all(deletePromises);
        setStaffMembers(staffMembers.filter(staff => !selectedIds.has(staff.id!)));
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.staff_batch_delete_success', { count: count.toString() }) || `${count} staff member(s) deleted successfully!`);
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.staff_batch_delete_failed') || 'Failed to delete staff members.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedStaff.map(staff => staff.id!).filter(Boolean) as string[];
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
  const totalPages = Math.ceil(staffMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStaff = staffMembers.slice(startIndex, endIndex);
  const isAllSelected = paginatedStaff.length > 0 && paginatedStaff.every(staff => staff.id && selectedIds.has(staff.id));
  const isSomeSelected = paginatedStaff.some(staff => staff.id && selectedIds.has(staff.id));

  const getRoleBadgeColor = (role: AdminRole) => {
    switch (role) {
      case AdminRole.SuperAdmin:
        return 'bg-red-100 text-red-800';
      case AdminRole.Admin:
        return 'bg-purple-100 text-purple-800';
      case AdminRole.Manager:
        return 'bg-blue-100 text-blue-800';
      case AdminRole.Staff:
        return 'bg-green-100 text-green-800';
      case AdminRole.Viewer:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.staff_management') || 'Staff Management'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.staff_subtitle') || 'Manage your staff members and their permissions'}</p>
        </div>
        <Link
          href="/admin/staff/new"
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.add_staff_member') || 'Add Staff Member'}
        </Link>
      </div>

      {/* Batch Actions & Items Per Page */}
      {staffMembers.length > 0 && (
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

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {staffMembers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.staff_empty_title') || 'No staff members found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.staff_empty_message') || 'Add your first staff member to get started.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
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
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.staff_table_name') || 'Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.staff_table_email') || 'Email'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.staff_table_role') || 'Role'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.staff_table_status') || 'Status'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.staff_table_last_login') || 'Last Login'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.staff_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedStaff.map((staff) => (
                    <tr key={staff.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(staff.id!) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={staff.id ? selectedIds.has(staff.id) : false}
                          onChange={(e) => staff.id && handleSelectItem(staff.id, e.target.checked)}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="font-medium text-gray-900">{staff.displayName}</div>
                        {staff.phoneNumber && (
                          <div className="text-sm text-gray-500">{staff.phoneNumber}</div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-gray-600 text-sm">{staff.email}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${getRoleBadgeColor(staff.role)}`}>
                          {staff.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          staff.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {staff.isActive ? (t('admin.status_active') || 'Active') : (t('admin.status_inactive') || 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-gray-600 text-sm">
                        {staff.lastLoginAt 
                          ? new Date(staff.lastLoginAt.seconds * 1000).toLocaleDateString()
                          : (t('admin.staff_never_logged_in') || 'Never')
                        }
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/staff/edit/${staff.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('admin.common.edit') || 'Edit'}
                          </Link>
                          <button
                            onClick={() => handleToggleActive(staff.id!, staff.isActive)}
                            className={`text-sm font-medium ${
                              staff.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {staff.isActive ? (t('admin.staff_deactivate') || 'Deactivate') : (t('admin.staff_activate') || 'Activate')}
                          </button>
                          <button
                            onClick={() => handleDelete(staff.id!)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            {t('admin.common.delete') || 'Delete'}
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
              {paginatedStaff.map((staff) => (
                <div key={staff.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(staff.id!) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={staff.id ? selectedIds.has(staff.id) : false}
                      onChange={(e) => staff.id && handleSelectItem(staff.id, e.target.checked)}
                      className="w-4 h-4 mt-1 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <div className="flex items-start justify-between flex-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 mb-1">{staff.displayName}</div>
                      <div className="text-sm text-gray-500 truncate">{staff.email}</div>
                      {staff.phoneNumber && (
                        <div className="text-xs text-gray-400 mt-1">{staff.phoneNumber}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${getRoleBadgeColor(staff.role)}`}>
                        {staff.role.replace('_', ' ')}
                      </span>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        staff.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {staff.isActive ? (t('admin.status_active') || 'Active') : (t('admin.status_inactive') || 'Inactive')}
                      </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <span>{t('admin.staff_table_last_login') || 'Last Login'}:</span>
                    <span className="font-medium">
                      {staff.lastLoginAt 
                        ? new Date(staff.lastLoginAt.seconds * 1000).toLocaleDateString()
                        : (t('admin.staff_never_logged_in') || 'Never')
                      }
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <Link
                      href={`/admin/staff/edit/${staff.id}`}
                      className="flex-1 text-center px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.common.edit') || 'Edit'}
                    </Link>
                    <button
                      onClick={() => handleToggleActive(staff.id!, staff.isActive)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        staff.isActive 
                          ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' 
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {staff.isActive ? (t('admin.staff_deactivate') || 'Deactivate') : (t('admin.staff_activate') || 'Activate')}
                    </button>
                    <button
                      onClick={() => handleDelete(staff.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('admin.common.delete') || 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-700">
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, staffMembers.length)} {t('admin.common.of') || 'of'} {staffMembers.length} {t('admin.common.results') || 'results'}
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

export default StaffPage;

