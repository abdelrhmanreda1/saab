'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const EmailMarketingPage = () => {
  const { t } = useLanguage();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recipientGroup, setRecipientGroup] = useState('all');
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setSending(true);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setInfoDialogMessage(t('admin.email_marketing_send_success') || `Email "${subject}" sent to ${recipientGroup} users!`);
    setInfoDialogType('success');
    setShowInfoDialog(true);
    setSending(false);
    setSubject('');
    setMessage('');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.email_marketing_title') || 'Email Marketing'}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.email_marketing_subtitle') || 'Send newsletters and updates to your customers.'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSend} className="p-4 sm:p-6 space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.email_marketing_recipients') || 'Recipients'}</label>
            <select
              value={recipientGroup}
              onChange={(e) => setRecipientGroup(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
            >
              <option value="all">{t('admin.email_marketing_recipients_all') || 'All Customers'}</option>
              <option value="subscribers">{t('admin.email_marketing_recipients_subscribers') || 'Newsletter Subscribers'}</option>
              <option value="active">{t('admin.email_marketing_recipients_active') || 'Active Customers (Last 30 Days)'}</option>
              <option value="inactive">{t('admin.email_marketing_recipients_inactive') || 'Inactive Customers'}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.email_marketing_subject') || 'Subject Line'}</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              placeholder="e.g. New Collection Arrival!"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.email_marketing_message') || 'Message Content'}</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none resize-none"
              placeholder="Write your email content here..."
            ></textarea>
            <p className="text-xs text-gray-500 mt-2">{t('admin.email_marketing_html_hint') || 'HTML is supported for formatting.'}</p>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className={`px-6 sm:px-8 py-2.5 sm:py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all flex items-center gap-2 text-sm sm:text-base ${sending ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('admin.email_marketing_sending') || 'Sending...'}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  {t('admin.email_marketing_send_button') || 'Send Campaign'}
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* History Section (Placeholder) */}
      <div className="mt-8 sm:mt-10">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">{t('admin.email_marketing_recent_campaigns') || 'Recent Campaigns'}</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-700">{t('admin.email_marketing_table_subject') || 'Subject'}</th>
                  <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-700">{t('admin.email_marketing_table_recipients') || 'Recipients'}</th>
                  <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-700">{t('admin.email_marketing_table_sent_date') || 'Sent Date'}</th>
                  <th className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-700">{t('admin.email_marketing_table_status') || 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">Summer Sale Announcement</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">All Customers</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">May 15, 2024</td>
                  <td className="px-4 sm:px-6 py-4 text-sm"><span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-md text-xs font-semibold">Sent</span></td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">Welcome to Pardah</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">New Subscribers</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">Automated</td>
                  <td className="px-4 sm:px-6 py-4 text-sm"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-semibold">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-200">
            <div className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Summer Sale Announcement</h4>
                <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-md text-xs font-semibold">Sent</span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">Recipients:</span> All Customers</p>
                <p><span className="font-medium">Sent Date:</span> May 15, 2024</p>
              </div>
            </div>
            <div className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Welcome to Pardah</h4>
                <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-semibold">Active</span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">Recipients:</span> New Subscribers</p>
                <p><span className="font-medium">Sent Date:</span> Automated</p>
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default EmailMarketingPage;
