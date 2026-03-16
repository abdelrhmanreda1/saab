'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllContactSubmissions, updateContactSubmission } from '@/lib/firestore/contact_db';
import { ContactSubmission } from '@/lib/firestore/contact_db';
import { useLanguage } from '@/context/LanguageContext';

const ContactPage = () => {
  const [, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'replied' | 'archived'>('all');
  const { t } = useLanguage();

  const loadSubmissions = useCallback(async () => {
    try {
      const allSubmissions = await getAllContactSubmissions();
      setSubmissions(allSubmissions);
    } catch {
      // Error loading contact submissions
      alert(t('admin.contact_submissions_load_failed'));
    }
  }, [t]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadSubmissions();
      } else {
        window.location.href = '/login?returnUrl=/admin/customers/contact';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadSubmissions]);

  const handleStatusChange = async (id: string, status: 'new' | 'read' | 'replied' | 'archived') => {
    try {
      await updateContactSubmission(id, { status });
      await loadSubmissions();
      if (selectedSubmission?.id === id) {
        setSelectedSubmission(prev => prev ? { ...prev, status } : null);
      }
    } catch {
      // Error updating submission status
      alert(t('admin.contact_submissions_update_failed'));
    }
  };

  const filteredSubmissions = filter === 'all' 
    ? submissions 
    : submissions.filter(s => s.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'read': return 'bg-yellow-100 text-yellow-800';
      case 'replied': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
          {t('admin.contact_submissions_title')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('admin.contact_submissions_subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Submissions List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">
                {t('admin.contact_submissions_list_title')}
              </h2>
              <span className="text-xs text-gray-500">
                {t('admin.contact_submissions_list_count', {
                  count: filteredSubmissions.length.toString(),
                })}
              </span>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'new' | 'read' | 'replied' | 'archived')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            >
              <option value="all">{t('admin.contact_submissions_filter_all')}</option>
              <option value="new">{t('admin.contact_submissions_filter_new')}</option>
              <option value="read">{t('admin.contact_submissions_filter_read')}</option>
              <option value="replied">
                {t('admin.contact_submissions_filter_replied')}
              </option>
              <option value="archived">
                {t('admin.contact_submissions_filter_archived')}
              </option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>{t('admin.contact_submissions_none')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <button
                    key={submission.id}
                    onClick={() => setSelectedSubmission(submission)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedSubmission?.id === submission.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {submission.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {submission.email}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-900 truncate mt-1">{submission.subject}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {submission.createdAt && typeof submission.createdAt.toDate === 'function'
                        ? new Date(submission.createdAt.toDate()).toLocaleString()
                        : t('admin.contact_submissions_created_unknown')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submission Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-150px)] sm:max-h-[calc(100vh-200px)]">
          {selectedSubmission ? (
            <>
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                      {selectedSubmission.subject}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {t('admin.contact_submissions_details_from', {
                        name: selectedSubmission.name,
                        email: selectedSubmission.email,
                      })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedSubmission.createdAt && typeof selectedSubmission.createdAt.toDate === 'function'
                        ? new Date(selectedSubmission.createdAt.toDate()).toLocaleString()
                        : t('admin.contact_submissions_created_unknown')}
                    </p>
                  </div>
                  <select
                    value={selectedSubmission.status}
                    onChange={(e) => handleStatusChange(selectedSubmission.id!, e.target.value as 'new' | 'read' | 'replied' | 'archived')}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  >
                    <option value="new">{t('admin.contact_submissions_filter_new')}</option>
                    <option value="read">{t('admin.contact_submissions_filter_read')}</option>
                    <option value="replied">
                      {t('admin.contact_submissions_filter_replied')}
                    </option>
                    <option value="archived">
                      {t('admin.contact_submissions_filter_archived')}
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="prose max-w-none">
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedSubmission.message}</p>
                </div>
              </div>
              <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
                <a
                  href={`mailto:${selectedSubmission.email}?subject=Re: ${selectedSubmission.subject}`}
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-colors w-full sm:w-auto justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {t('admin.contact_submissions_reply_email')}
                </a>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-16 h-16 mx-auto mb-4 text-gray-400"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p>{t('admin.contact_submissions_select_prompt')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPage;

