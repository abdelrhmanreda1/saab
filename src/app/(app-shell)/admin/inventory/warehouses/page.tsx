'use client';

import React, { useState, useEffect } from 'react';
import { getAllWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/lib/firestore/warehouses_db';
import { Warehouse } from '@/lib/firestore/warehouses';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const WarehousesPage = () => {
  const { t } = useLanguage();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    street: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    phone: '',
    email: '',
    managerName: '',
    isDefault: false,
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

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

  const fetchWarehouses = async () => {
    try {
      const data = await getAllWarehouses();
      setWarehouses(data);
    } catch {
      // Failed to fetch warehouses
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const warehouseData = {
        name: formData.name,
        code: formData.code,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          zipCode: formData.zipCode || undefined,
        },
        contact: {
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          managerName: formData.managerName || undefined,
        },
        isActive: true,
        isDefault: formData.isDefault,
      };

      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id!, warehouseData);
      } else {
        await createWarehouse(warehouseData);
      }

      setShowForm(false);
      setEditingWarehouse(null);
      resetForm();
      fetchWarehouses();
      setInfoDialogMessage(editingWarehouse ? (t('admin.inventory_warehouses_update_success') || 'Warehouse updated successfully!') : (t('admin.inventory_warehouses_create_success') || 'Warehouse created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save warehouse
      setInfoDialogMessage(t('admin.inventory_warehouses_save_failed') || 'Failed to save warehouse');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      street: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      phone: '',
      email: '',
      managerName: '',
      isDefault: false,
    });
  };

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.inventory_warehouses_delete_confirm') || 'Are you sure you want to delete this warehouse?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteWarehouse(id);
        fetchWarehouses();
        setInfoDialogMessage(t('admin.inventory_warehouses_delete_success') || 'Warehouse deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete warehouse
        setInfoDialogMessage(t('admin.inventory_warehouses_delete_failed') || 'Failed to delete warehouse.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.inventory_warehouses_title') || 'Warehouses'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.inventory_warehouses_subtitle') || 'Manage multiple warehouses and inventory locations'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingWarehouse(null);
            resetForm();
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.inventory_warehouses_new_button') || 'New Warehouse'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {editingWarehouse
              ? t('admin.inventory_warehouses_edit_title') || 'Edit Warehouse'
              : t('admin.inventory_warehouses_create_title') || 'New Warehouse'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_name') || 'Warehouse Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_code') || 'Warehouse Code'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                  placeholder={t('admin.inventory_warehouses_field_code_placeholder') || 'WH-001'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('admin.inventory_warehouses_field_street') || 'Street Address'}
              </label>
              <input
                type="text"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_city') || 'City'}
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_state') || 'State'}
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_country') || 'Country'}
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_phone') || 'Phone'}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_email') || 'Email'}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('admin.inventory_warehouses_field_manager') || 'Manager Name'}
                </label>
                <input
                  type="text"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
              />
              <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
                {t('admin.inventory_warehouses_field_is_default') || 'Set as default warehouse'}
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="px-4 sm:px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {editingWarehouse
                  ? t('admin.inventory_warehouses_update_button') || 'Update Warehouse'
                  : t('admin.inventory_warehouses_create_button') || 'Create Warehouse'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingWarehouse(null);
                }}
                className="px-4 sm:px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {warehouses.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.inventory_warehouses_empty_title') || 'No warehouses found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.inventory_warehouses_empty_message') || 'Get started by adding your first warehouse'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_warehouses_table_code') || 'Code'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_warehouses_table_name') || 'Name'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_warehouses_table_address') || 'Address'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_warehouses_table_contact') || 'Contact'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_warehouses_table_status') || 'Status'}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.inventory_warehouses_table_actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {warehouses.map((warehouse) => (
                    <tr key={warehouse.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{warehouse.code}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {warehouse.name}
                        {warehouse.isDefault && (
                          <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-semibold">
                            {t('admin.inventory_warehouses_badge_default') || 'Default'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {warehouse.address.street}, {warehouse.address.city}, {warehouse.address.state}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {warehouse.contact.phone || t('common.not_applicable') || 'N/A'} /{' '}
                        {warehouse.contact.email || t('common.not_applicable') || 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ${
                            warehouse.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {warehouse.isActive
                            ? t('admin.status_active') || 'Active'
                            : t('admin.status_inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingWarehouse(warehouse);
                              setFormData({
                                name: warehouse.name,
                                code: warehouse.code,
                                street: warehouse.address.street,
                                city: warehouse.address.city,
                                state: warehouse.address.state,
                                country: warehouse.address.country,
                                zipCode: warehouse.address.zipCode || '',
                                phone: warehouse.contact.phone || '',
                                email: warehouse.contact.email || '',
                                managerName: warehouse.contact.managerName || '',
                                isDefault: warehouse.isDefault,
                              });
                              setShowForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            {t('common.edit') || 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(warehouse.id!)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            {t('common.delete') || 'Delete'}
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
              {warehouses.map((warehouse) => (
                <div key={warehouse.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{warehouse.name}</h3>
                        {warehouse.isDefault && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                            {t('admin.inventory_warehouses_badge_default') || 'Default'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-medium mb-2">{warehouse.code}</p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>{warehouse.address.street}, {warehouse.address.city}</p>
                        <p>{warehouse.address.state}, {warehouse.address.country}</p>
                        <p>Phone: {warehouse.contact.phone || t('common.not_applicable') || 'N/A'}</p>
                        <p>Email: {warehouse.contact.email || t('common.not_applicable') || 'N/A'}</p>
                        {warehouse.contact.managerName && (
                          <p>Manager: {warehouse.contact.managerName}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md ml-3 ${
                        warehouse.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {warehouse.isActive
                        ? t('admin.status_active') || 'Active'
                        : t('admin.status_inactive') || 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditingWarehouse(warehouse);
                        setFormData({
                          name: warehouse.name,
                          code: warehouse.code,
                          street: warehouse.address.street,
                          city: warehouse.address.city,
                          state: warehouse.address.state,
                          country: warehouse.address.country,
                          zipCode: warehouse.address.zipCode || '',
                          phone: warehouse.contact.phone || '',
                          email: warehouse.contact.email || '',
                          managerName: warehouse.contact.managerName || '',
                          isDefault: warehouse.isDefault,
                        });
                        setShowForm(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('common.edit') || 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(warehouse.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('common.delete') || 'Delete'}
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

export default WarehousesPage;

