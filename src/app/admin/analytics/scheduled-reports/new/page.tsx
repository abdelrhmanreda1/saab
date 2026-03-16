'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { addScheduledReport, getAllCustomReportTemplates } from '@/lib/firestore/analytics_db';
import { ScheduledReport, CustomReportTemplate } from '@/lib/firestore/analytics';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';

const NewScheduledReportPage = () => {
  const { t } = useLanguage();
  const router = useRouter();
  const auth = getAuth(app);
  const user = auth.currentUser;

  const [templates, setTemplates] = useState<CustomReportTemplate[]>([]);
  const [formData, setFormData] = useState({
    templateId: '',
    templateName: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly' | 'custom',
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recipients: [] as string[],
    recipientEmail: '',
    format: 'pdf' as 'pdf' | 'excel' | 'csv' | 'html',
    enabled: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await getAllCustomReportTemplates();
        setTemplates(data);
      } catch {
        // Error loading templates
      }
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!formData.templateId) return;

    const template = templates.find(t => t.id === formData.templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        templateName: template.name,
      }));
    }
  }, [formData.templateId, templates]);

  const handleAddRecipient = () => {
    if (formData.recipientEmail && !formData.recipients.includes(formData.recipientEmail)) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, formData.recipientEmail],
        recipientEmail: '',
      });
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(e => e !== email),
    });
  };

  const calculateNextRun = React.useCallback((): Date => {
    const now = new Date();
    const [hours, minutes] = formData.time.split(':').map(Number);
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    if (formData.frequency === 'daily') {
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (formData.frequency === 'weekly') {
      const currentDay = now.getDay();
      const targetDay = formData.dayOfWeek;
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      nextRun.setDate(now.getDate() + (daysUntilTarget || 7));
    } else if (formData.frequency === 'monthly') {
      nextRun.setDate(formData.dayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
    }

    return nextRun;
  }, [formData.dayOfMonth, formData.dayOfWeek, formData.frequency, formData.time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert(t('admin.scheduled_reports_error_login_required') || 'You must be logged in to schedule a report.');
      return;
    }

    if (!formData.templateId) {
      alert(t('admin.scheduled_reports_error_no_template') || 'Please select a report template.');
      return;
    }

    if (formData.recipients.length === 0) {
      alert(t('admin.scheduled_reports_error_no_recipients') || 'Please add at least one recipient email.');
      return;
    }

    setLoading(true);
    try {
      const nextRun = calculateNextRun();
      const report: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt'> = {
        templateId: formData.templateId,
        templateName: formData.templateName,
        schedule: {
          frequency: formData.frequency,
          ...(formData.frequency === 'weekly' && { dayOfWeek: formData.dayOfWeek }),
          ...(formData.frequency === 'monthly' && { dayOfMonth: formData.dayOfMonth }),
          time: formData.time,
          timezone: formData.timezone,
        },
        recipients: formData.recipients,
        format: formData.format,
        enabled: formData.enabled,
        nextRun: Timestamp.fromDate(nextRun),
        createdBy: user.uid,
      };

      await addScheduledReport(report);
      router.push('/admin/analytics/scheduled-reports');
    } catch {
      // Error creating scheduled report
      alert(t('admin.scheduled_reports_error_create_failed') || 'Failed to schedule report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_create_title') || 'Schedule New Report'}</h1>
        <p className="text-gray-500 text-sm">{t('admin.scheduled_reports_create_subtitle') || 'Automate report generation and email delivery'}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Template Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_template') || 'Report Template'} *</label>
          <select
            value={formData.templateId}
            onChange={(e) => {
              const template = templates.find(t => t.id === e.target.value);
              setFormData({
                ...formData,
                templateId: e.target.value,
                templateName: template?.name || '',
              });
            }}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          >
            <option value="">{t('admin.scheduled_reports_placeholder_template') || 'Select a template...'}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {t('admin.scheduled_reports_hint_no_templates') || 'No templates available. Create one first.'} <a href="/admin/analytics/custom-reports/new" className="text-blue-600 hover:underline">{t('admin.create_first_template') || 'Create one first'}</a>.
            </p>
          )}
        </div>

        {/* Schedule Frequency */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_frequency') || 'Frequency'} *</label>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value as ScheduledReport['schedule']['frequency'] })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          >
            <option value="daily">{t('admin.scheduled_reports_option_frequency_daily') || 'Daily'}</option>
            <option value="weekly">{t('admin.scheduled_reports_option_frequency_weekly') || 'Weekly'}</option>
            <option value="monthly">{t('admin.scheduled_reports_option_frequency_monthly') || 'Monthly'}</option>
          </select>
        </div>

        {/* Day of Week (for weekly) */}
        {formData.frequency === 'weekly' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_day_of_week') || 'Day of Week'} *</label>
            <select
              value={formData.dayOfWeek}
              onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            >
              <option value={0}>{t('admin.scheduled_reports_option_day_sunday') || 'Sunday'}</option>
              <option value={1}>{t('admin.scheduled_reports_option_day_monday') || 'Monday'}</option>
              <option value={2}>{t('admin.scheduled_reports_option_day_tuesday') || 'Tuesday'}</option>
              <option value={3}>{t('admin.scheduled_reports_option_day_wednesday') || 'Wednesday'}</option>
              <option value={4}>{t('admin.scheduled_reports_option_day_thursday') || 'Thursday'}</option>
              <option value={5}>{t('admin.scheduled_reports_option_day_friday') || 'Friday'}</option>
              <option value={6}>{t('admin.scheduled_reports_option_day_saturday') || 'Saturday'}</option>
            </select>
          </div>
        )}

        {/* Day of Month (for monthly) */}
        {formData.frequency === 'monthly' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_day_of_month') || 'Day of Month'} *</label>
            <select
              value={formData.dayOfMonth}
              onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_time') || 'Time'} *</label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_timezone') || 'Timezone'} *</label>
          <input
            type="text"
            value={formData.timezone}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">{t('admin.scheduled_reports_hint_timezone') || 'Using your system timezone'}</p>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_format') || 'Report Format'} *</label>
          <select
            value={formData.format}
            onChange={(e) => setFormData({ ...formData, format: e.target.value as ScheduledReport['format'] })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          >
            <option value="pdf">{t('admin.scheduled_reports_option_format_pdf') || 'PDF'}</option>
            <option value="excel">{t('admin.scheduled_reports_option_format_excel') || 'Excel'}</option>
            <option value="csv">{t('admin.scheduled_reports_option_format_csv') || 'CSV'}</option>
            <option value="html">{t('admin.scheduled_reports_option_format_html') || 'HTML'}</option>
          </select>
        </div>

        {/* Recipients */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">{t('admin.scheduled_reports_field_recipients') || 'Recipients'} *</label>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              value={formData.recipientEmail}
              onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRecipient();
                }
              }}
              placeholder={t('admin.scheduled_reports_placeholder_email') || 'Enter email address'}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
            <button
              type="button"
              onClick={handleAddRecipient}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {t('admin.scheduled_reports_button_add') || 'Add'}
            </button>
          </div>
          {formData.recipients.length > 0 && (
            <div className="space-y-2">
              {formData.recipients.map((email) => (
                <div key={email} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(email)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    {t('admin.scheduled_reports_button_remove') || 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {formData.recipients.length === 0 && (
            <p className="text-sm text-red-600 mt-1">{t('admin.scheduled_reports_error_no_recipients') || 'Please add at least one recipient'}</p>
          )}
        </div>

        {/* Enabled */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
            {t('admin.scheduled_reports_field_enabled') || 'Enable this scheduled report'}
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('admin.scheduled_reports_button_cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={loading || !formData.templateId || formData.recipients.length === 0}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (t('admin.scheduled_reports_button_scheduling') || 'Scheduling...') : (t('admin.scheduled_reports_button_schedule') || 'Schedule Report')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewScheduledReportPage;

