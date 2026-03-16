'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getAllScheduledReports, updateScheduledReport, deleteScheduledReport } from '@/lib/firestore/analytics_db';
import { ScheduledReport } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

const ScheduledReportsPage = () => {
  const { t } = useLanguage();
  const [, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const data = await getAllScheduledReports();
          setReports(data);
        } catch {
          // Error fetching scheduled reports
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await updateScheduledReport(id, { enabled: !currentStatus });
      setReports(reports.map(r => r.id === id ? { ...r, enabled: !currentStatus } : r));
    } catch {
      // Error updating report
      alert(t('admin.scheduled_reports_update_failed') || 'Failed to update report.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.scheduled_reports_delete_confirm') || 'Are you sure you want to delete this scheduled report?')) return;
    try {
      await deleteScheduledReport(id);
      setReports(reports.filter(r => r.id !== id));
    } catch {
      // Error deleting report
      alert(t('admin.scheduled_reports_delete_failed') || 'Failed to delete report.');
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.scheduled_reports') || 'Scheduled Reports'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.scheduled_reports_subtitle') || 'Manage automated report schedules'}</p>
        </div>
        <Link
          href="/admin/analytics/scheduled-reports/new"
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-sm text-center"
        >
          {t('admin.scheduled_reports_new_button') || 'Schedule New Report'}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.scheduled_reports_empty') || 'No scheduled reports found.'}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_report_name') || 'Report Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_schedule') || 'Schedule'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_recipients') || 'Recipients'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_format') || 'Format'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_status') || 'Status'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_last_run') || 'Last Run'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_next_run') || 'Next Run'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.scheduled_reports_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{report.templateName}</td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600 capitalize">
                        {report.schedule.frequency}
                        {report.schedule.dayOfWeek !== undefined && ` (Day ${report.schedule.dayOfWeek})`}
                        {report.schedule.dayOfMonth !== undefined && ` (Day ${report.schedule.dayOfMonth})`}
                        {' '}at {report.schedule.time}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600">{t('admin.scheduled_reports_recipients_count', { count: report.recipients.length }) || `${report.recipients.length} recipients`}</td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600 uppercase">{report.format}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          report.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
                        }`}>
                          {report.enabled ? (t('admin.scheduled_reports_status_enabled') || 'Enabled') : (t('admin.scheduled_reports_status_disabled') || 'Disabled')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600">
                        {report.lastRun 
                          ? new Date(report.lastRun.seconds * 1000).toLocaleString()
                          : (t('admin.scheduled_reports_last_run_never') || 'Never')
                        }
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600">
                        {report.nextRun 
                          ? new Date(report.nextRun.seconds * 1000).toLocaleString()
                          : (t('admin.scheduled_reports_next_run_dash') || '-')
                        }
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => report.id && handleToggle(report.id, report.enabled)}
                            className={`text-xs font-medium ${
                              report.enabled ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {report.enabled ? (t('admin.scheduled_reports_action_disable') || 'Disable') : (t('admin.scheduled_reports_action_enable') || 'Enable')}
                          </button>
                          <Link
                            href={`/admin/analytics/scheduled-reports/edit/${report.id}`}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            {t('admin.edit') || 'Edit'}
                          </Link>
                          <button
                            onClick={() => report.id && handleDelete(report.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            {t('admin.delete') || 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {reports.map((report) => (
                <div key={report.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{report.templateName}</h3>
                      <p className="text-xs text-gray-500 mb-1">
                        {report.schedule.frequency}
                        {report.schedule.dayOfWeek !== undefined && ` (Day ${report.schedule.dayOfWeek})`}
                        {report.schedule.dayOfMonth !== undefined && ` (Day ${report.schedule.dayOfMonth})`}
                        {' '}at {report.schedule.time}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ml-3 ${
                      report.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
                    }`}>
                      {report.enabled ? (t('admin.scheduled_reports_status_enabled') || 'Enabled') : (t('admin.scheduled_reports_status_disabled') || 'Disabled')}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 mb-3">
                    <p><span className="font-medium">{t('admin.scheduled_reports_table_recipients') || 'Recipients'}:</span> {report.recipients.length}</p>
                    <p><span className="font-medium">{t('admin.scheduled_reports_table_format') || 'Format'}:</span> {report.format.toUpperCase()}</p>
                    <p><span className="font-medium">{t('admin.scheduled_reports_table_last_run') || 'Last Run'}:</span> {report.lastRun ? new Date(report.lastRun.seconds * 1000).toLocaleString() : (t('admin.scheduled_reports_last_run_never') || 'Never')}</p>
                    <p><span className="font-medium">{t('admin.scheduled_reports_table_next_run') || 'Next Run'}:</span> {report.nextRun ? new Date(report.nextRun.seconds * 1000).toLocaleString() : (t('admin.scheduled_reports_next_run_dash') || '-')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => report.id && handleToggle(report.id, report.enabled)}
                      className={`px-3 py-2 rounded-md text-xs font-medium ${
                        report.enabled ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      } transition-colors`}
                    >
                      {report.enabled ? (t('admin.scheduled_reports_action_disable') || 'Disable') : (t('admin.scheduled_reports_action_enable') || 'Enable')}
                    </button>
                    <Link
                      href={`/admin/analytics/scheduled-reports/edit/${report.id}`}
                      className="px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      {t('admin.edit') || 'Edit'}
                    </Link>
                    <button
                      onClick={() => report.id && handleDelete(report.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-md text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('admin.delete') || 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduledReportsPage;

