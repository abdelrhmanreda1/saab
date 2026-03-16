'use client';

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { getAllPushCampaigns, createPushCampaign, updatePushCampaign, deletePushCampaign } from '@/lib/firestore/campaigns_db';
import { PushNotificationCampaign } from '@/lib/firestore/campaigns';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const PushCampaignsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<PushNotificationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<PushNotificationCampaign | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    body: '',
    imageUrl: '',
    linkUrl: '',
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
      const data = await getAllPushCampaigns();
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
        title: formData.title,
        body: formData.body,
        imageUrl: formData.imageUrl || undefined,
        linkUrl: formData.linkUrl || undefined,
        recipientType: formData.recipientType,
        segmentId: formData.recipientType === 'segment' ? formData.segmentId : undefined,
        recipientIds: formData.recipientType === 'custom' ? formData.recipientIds : undefined,
        scheduledAt: formData.scheduledAt ? Timestamp.fromDate(new Date(formData.scheduledAt)) : undefined,
        status: formData.scheduledAt ? 'scheduled' as const : 'draft' as const,
        createdBy: user.uid,
      };

      if (editingCampaign) {
        await updatePushCampaign(editingCampaign.id!, campaignData);
      } else {
        await createPushCampaign(campaignData);
      }

      setShowForm(false);
      setEditingCampaign(null);
      resetForm();
      fetchCampaigns();
      setInfoDialogMessage(editingCampaign ? (t('admin.push_campaigns_update_success') || 'Campaign updated successfully!') : (t('admin.push_campaigns_create_success') || 'Campaign created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save campaign
      setInfoDialogMessage(t('admin.push_campaigns_save_failed') || 'Failed to save campaign.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      body: '',
      imageUrl: '',
      linkUrl: '',
      recipientType: 'all',
      segmentId: '',
      recipientIds: [],
      scheduledAt: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.push_campaigns_delete_confirm') || 'Are you sure you want to delete this campaign?');
    setConfirmDialogAction(() => async () => {
      try {
        await deletePushCampaign(id);
        fetchCampaigns();
        setInfoDialogMessage(t('admin.push_campaigns_delete_success') || 'Campaign deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete campaign
        setInfoDialogMessage(t('admin.push_campaigns_delete_failed') || 'Failed to delete campaign.');
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.push_campaigns_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.push_campaigns_subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCampaign(null);
            resetForm();
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.push_campaigns_new_button')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            {editingCampaign
              ? t('admin.push_campaigns_form_title_edit')
              : t('admin.push_campaigns_form_title_new')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.push_campaigns_form_name_label')}
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
                {t('admin.push_campaigns_form_title_label')}
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.push_campaigns_form_body_label')}
              </label>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.push_campaigns_form_image_url_label')}
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.push_campaigns_form_link_url_label')}
                </label>
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.push_campaigns_form_recipient_type_label')}
              </label>
              <select
                value={formData.recipientType}
                onChange={(e) => setFormData({ ...formData, recipientType: e.target.value as 'all' | 'segment' | 'custom' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
              >
                <option value="all">
                  {t('admin.push_campaigns_recipient_all')}
                </option>
                <option value="segment">
                  {t('admin.push_campaigns_recipient_segment')}
                </option>
                <option value="custom">
                  {t('admin.push_campaigns_recipient_custom')}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.push_campaigns_schedule_label')}
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
                  ? t('admin.push_campaigns_form_submit_update')
                  : t('admin.push_campaigns_form_submit_create')}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">No push campaigns found.</p>
            <p className="text-sm text-gray-400">Create one to get started</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.push_campaigns_table_name')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.push_campaigns_table_title')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.push_campaigns_table_status')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.push_campaigns_table_sent')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.push_campaigns_table_opened')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.push_campaigns_table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{campaign.title}</td>
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
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{campaign.sentCount}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{campaign.openedCount}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setFormData({
                              name: campaign.name,
                              title: campaign.title,
                              body: campaign.body,
                              imageUrl: campaign.imageUrl || '',
                              linkUrl: campaign.linkUrl || '',
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
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{campaign.name}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-medium">Title:</span> {campaign.title}</p>
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
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditingCampaign(campaign);
                        setFormData({
                          name: campaign.name,
                          title: campaign.title,
                          body: campaign.body,
                          imageUrl: campaign.imageUrl || '',
                          linkUrl: campaign.linkUrl || '',
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

export default PushCampaignsPage;

