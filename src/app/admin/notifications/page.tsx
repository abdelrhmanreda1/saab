'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

const NotificationsPage = () => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('all');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    alert(t('admin.notifications_send_success', { title }) || `Notification "${title}" sent successfully!`);
    setSending(false);
    setTitle('');
    setBody('');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.notifications_title') || 'Push Notifications'}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.notifications_subtitle') || 'Send mobile app push notifications to your users.'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSend} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.notifications_field_target_platform') || 'Target Platform'}</label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
              >
                <option value="all">{t('admin.notifications_platform_all') || 'All Devices (iOS & Android)'}</option>
                <option value="ios">{t('admin.notifications_platform_ios') || 'iOS Only'}</option>
                <option value="android">{t('admin.notifications_platform_android') || 'Android Only'}</option>
              </select>
            </div>
            
            <div>
               {/* Placeholder for future segment targeting */}
               <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.notifications_field_target_audience') || 'Target Audience'}</label>
               <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white">
                 <option>{t('admin.notifications_audience_all') || 'All Users'}</option>
                 <option>{t('admin.notifications_audience_active_24h') || 'Active in last 24h'}</option>
                 <option>{t('admin.notifications_audience_abandoned_cart') || 'Abandoned Cart'}</option>
               </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.notifications_field_title') || 'Notification Title'}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              placeholder={t('admin.notifications_title_placeholder') || 'e.g. Flash Sale Alert! ⚡'}
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{t('admin.notifications_title_max', { count: title.length }) || `${title.length}/50 characters`}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.notifications_field_body') || 'Message Body'}</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
              placeholder={t('admin.notifications_body_placeholder') || 'Get 50% off on all abayas today only...'}
              maxLength={150}
            ></textarea>
            <p className="text-xs text-gray-500 mt-1 text-right">{t('admin.notifications_body_max', { count: body.length }) || `${body.length}/150 characters`}</p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t('admin.notifications_preview') || 'Preview'}</h4>
            <div className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm max-w-sm">
               <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-serif font-bold">P</div>
               <div>
                 <p className="font-bold text-sm text-gray-900">{title || (t('admin.notifications_preview_title') || 'Notification Title')}</p>
                 <p className="text-xs text-gray-600">{body || (t('admin.notifications_preview_body') || 'Notification message body will appear here...')}</p>
               </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className={`px-4 sm:px-8 py-2.5 sm:py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${sending ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('admin.notifications_sending') || 'Sending...'}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  {t('admin.notifications_send_button') || 'Send Push Notification'}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default NotificationsPage;
