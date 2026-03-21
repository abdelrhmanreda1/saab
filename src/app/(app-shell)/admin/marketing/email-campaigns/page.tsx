'use client';

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { getAllEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign } from '@/lib/firestore/campaigns_db';
import { EmailCampaign } from '@/lib/firestore/campaigns';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const EmailCampaignsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
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
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    recipientType: 'all' as 'all' | 'segment' | 'custom',
    segmentId: '',
    recipientIds: [] as string[],
    scheduledAt: '',
  });

  useEffect(() => {
    fetchCampaigns();
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

  const fetchCampaigns = async () => {
    try {
      const data = await getAllEmailCampaigns();
      setCampaigns(data);
    } catch {
      // Failed to fetch campaigns
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      const campaignData = {
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        recipientType: formData.recipientType,
        segmentId: formData.recipientType === 'segment' ? formData.segmentId : undefined,
        recipientIds: formData.recipientType === 'custom' ? formData.recipientIds : undefined,
        scheduledAt: formData.scheduledAt ? Timestamp.fromDate(new Date(formData.scheduledAt)) : undefined,
        status: formData.scheduledAt ? 'scheduled' as const : 'draft' as const,
        createdBy: user.uid,
      };

      if (editingCampaign) {
        await updateEmailCampaign(editingCampaign.id!, campaignData);
      } else {
        await createEmailCampaign(campaignData);
      }

      setShowForm(false);
      setEditingCampaign(null);
      setFormData({
        name: '',
        subject: '',
        body: '',
        recipientType: 'all',
        segmentId: '',
        recipientIds: [],
        scheduledAt: '',
      });
      fetchCampaigns();
      setInfoDialogMessage(editingCampaign ? (t('admin.email_campaigns_update_success') || 'Campaign updated successfully!') : (t('admin.email_campaigns_create_success') || 'Campaign created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save campaign
      setInfoDialogMessage(t('admin.email_campaigns_save_failed') || 'Failed to save campaign.');
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
    setConfirmDialogMessage(t('admin.email_campaigns_delete_confirm') || 'Are you sure you want to delete this campaign?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteEmailCampaign(id);
        fetchCampaigns();
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.email_campaigns_delete_success') || 'Campaign deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete campaign
        setInfoDialogMessage(t('admin.email_campaigns_delete_failed') || 'Failed to delete campaign.');
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
    setConfirmDialogMessage(t('admin.email_campaigns_batch_delete_confirm', { count: count.toString() }) || `Are you sure you want to delete ${count} campaign(s)?`);
    setConfirmDialogAction(() => async () => {
      try {
        const deletePromises = Array.from(selectedIds).map(id => deleteEmailCampaign(id));
        await Promise.all(deletePromises);
        fetchCampaigns();
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.email_campaigns_batch_delete_success', { count: count.toString() }) || `${count} campaign(s) deleted successfully!`);
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.email_campaigns_batch_delete_failed') || 'Failed to delete campaigns.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedCampaigns.map(campaign => campaign.id!).filter(Boolean) as string[];
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
  const totalPages = Math.ceil(campaigns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCampaigns = campaigns.slice(startIndex, endIndex);
  const isAllSelected = paginatedCampaigns.length > 0 && paginatedCampaigns.every(campaign => campaign.id && selectedIds.has(campaign.id));
  const isSomeSelected = paginatedCampaigns.some(campaign => campaign.id && selectedIds.has(campaign.id));

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
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.email_campaigns_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.email_campaigns_subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCampaign(null);
            setFormData({
              name: '',
              subject: '',
              body: '',
              recipientType: 'all',
              segmentId: '',
              recipientIds: [],
              scheduledAt: '',
            });
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.email_campaigns_new_button')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {editingCampaign
              ? t('admin.email_campaigns_form_title_edit')
              : t('admin.email_campaigns_form_title_new')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.email_campaigns_form_name_label')}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.email_campaigns_form_subject_label')}
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.email_campaigns_form_body_label')}
              </label>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.email_campaigns_form_recipient_type_label')}
              </label>
              <select
                value={formData.recipientType}
                onChange={(e) => setFormData({ ...formData, recipientType: e.target.value as 'all' | 'segment' | 'custom' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
              >
                <option value="all">
                  {t('admin.email_campaigns_recipient_all')}
                </option>
                <option value="segment">
                  {t('admin.email_campaigns_recipient_segment')}
                </option>
                <option value="custom">
                  {t('admin.email_campaigns_recipient_custom')}
                </option>
              </select>
            </div>
            {formData.recipientType === 'segment' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.email_campaigns_segment_id_label')}
                </label>
                <input
                  type="text"
                  value={formData.segmentId}
                  onChange={(e) => setFormData({ ...formData, segmentId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  placeholder={t('admin.email_campaigns_segment_id_placeholder')}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.email_campaigns_schedule_label')}
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                {editingCampaign
                  ? t('admin.email_campaigns_form_submit_update')
                  : t('admin.email_campaigns_form_submit_create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingCampaign(null);
                }}
                className="bg-gray-100 text-gray-700 px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch Actions & Items Per Page */}
      {campaigns.length > 0 && (
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
        {campaigns.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">No email campaigns found.</p>
            <p className="text-sm text-gray-400">Create one to get started</p>
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
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_name')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_subject')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_status')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_recipients')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_sent')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_opened')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.email_campaigns_table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedCampaigns.map((campaign) => (
                    <tr key={campaign.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(campaign.id!) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={campaign.id ? selectedIds.has(campaign.id) : false}
                          onChange={(e) => campaign.id && handleSelectItem(campaign.id, e.target.checked)}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{campaign.subject}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          campaign.status === 'sent' ? 'bg-green-50 text-green-700' :
                          campaign.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                          campaign.status === 'sending' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {campaign.recipientType === 'all'
                          ? t('admin.email_campaigns_recipient_all')
                          : campaign.recipientType === 'segment'
                          ? t('admin.email_campaigns_recipient_segment')
                          : t('admin.email_campaigns_recipient_custom')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{campaign.sentCount}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{campaign.openedCount}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setFormData({
                              name: campaign.name,
                              subject: campaign.subject,
                              body: campaign.body,
                              recipientType: campaign.recipientType,
                              segmentId: campaign.segmentId || '',
                              recipientIds: campaign.recipientIds || [],
                              scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt.seconds * 1000).toISOString().slice(0, 16) : '',
                            });
                            setShowForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-4"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(campaign.id!)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedCampaigns.map((campaign) => (
                <div key={campaign.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(campaign.id!) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={campaign.id ? selectedIds.has(campaign.id) : false}
                      onChange={(e) => campaign.id && handleSelectItem(campaign.id, e.target.checked)}
                      className="w-4 h-4 mt-1 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <div className="flex items-start justify-between flex-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{campaign.name}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-medium">Subject:</span> {campaign.subject}</p>
                        <p><span className="font-medium">Recipients:</span> {campaign.recipientType === 'all'
                          ? t('admin.email_campaigns_recipient_all')
                          : campaign.recipientType === 'segment'
                          ? t('admin.email_campaigns_recipient_segment')
                          : t('admin.email_campaigns_recipient_custom')}</p>
                        <p><span className="font-medium">Sent:</span> {campaign.sentCount} | <span className="font-medium">Opened:</span> {campaign.openedCount}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                      campaign.status === 'sent' ? 'bg-green-50 text-green-700' :
                      campaign.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                      campaign.status === 'sending' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {campaign.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditingCampaign(campaign);
                        setFormData({
                          name: campaign.name,
                          subject: campaign.subject,
                          body: campaign.body,
                          recipientType: campaign.recipientType,
                          segmentId: campaign.segmentId || '',
                          recipientIds: campaign.recipientIds || [],
                          scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt.seconds * 1000).toISOString().slice(0, 16) : '',
                        });
                        setShowForm(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(campaign.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-700">
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, campaigns.length)} {t('admin.common.of') || 'of'} {campaigns.length} {t('admin.common.results') || 'results'}
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

export default EmailCampaignsPage;

