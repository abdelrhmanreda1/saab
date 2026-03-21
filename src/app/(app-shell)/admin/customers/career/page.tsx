'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllJobApplications, updateJobApplication } from '@/lib/firestore/job_applications_db';
import { JobApplication } from '@/lib/firestore/job_applications_db';
import { useLanguage } from '@/context/LanguageContext';

const CareerPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired'>('all');
  const { t } = useLanguage();

  const loadApplications = useCallback(async () => {
    try {
      const allApplications = await getAllJobApplications();
      setApplications(allApplications);
    } catch {
      // Error loading job applications
      alert(t('admin.career_applications_load_failed'));
    }
  }, [t]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadApplications();
      } else {
        window.location.href = '/login?returnUrl=/admin/customers/career';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadApplications]);

  const handleStatusChange = async (id: string, status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired', notes?: string) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (notes) {
        updates.notes = notes;
      }
      updates.reviewedBy = user?.uid;
      updates.reviewedAt = new Date();
      await updateJobApplication(id, updates);
      await loadApplications();
      if (selectedApplication?.id === id) {
        setSelectedApplication(prev => prev ? { ...prev, status, ...updates } : null);
      }
    } catch {
      // Error updating application status
      alert(t('admin.career_applications_update_failed'));
    }
  };

  const filteredApplications = filter === 'all' 
    ? applications 
    : applications.filter(a => a.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      case 'shortlisted': return 'bg-purple-100 text-purple-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'hired': return 'bg-green-100 text-green-800';
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
          {t('admin.career_applications_title')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('admin.career_applications_subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Applications List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">
                {t('admin.career_applications_list_title')}
              </h2>
              <span className="text-xs text-gray-500">
                {t('admin.career_applications_list_count', {
                  count: filteredApplications.length.toString(),
                })}
              </span>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            >
              <option value="all">{t('admin.career_applications_filter_all')}</option>
              <option value="pending">
                {t('admin.career_applications_filter_pending')}
              </option>
              <option value="reviewed">
                {t('admin.career_applications_filter_reviewed')}
              </option>
              <option value="shortlisted">
                {t('admin.career_applications_filter_shortlisted')}
              </option>
              <option value="rejected">
                {t('admin.career_applications_filter_rejected')}
              </option>
              <option value="hired">
                {t('admin.career_applications_filter_hired')}
              </option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredApplications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>{t('admin.career_applications_none')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredApplications.map((application) => (
                  <button
                    key={application.id}
                    onClick={() => setSelectedApplication(application)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedApplication?.id === application.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {application.applicantName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {application.applicantEmail}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(application.status)}`}>
                        {application.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-900 truncate mt-1">{application.jobTitle}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {application.createdAt && typeof application.createdAt.toDate === 'function'
                        ? new Date(application.createdAt.toDate()).toLocaleString()
                        : t('admin.career_applications_created_unknown')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Application Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-150px)] sm:max-h-[calc(100vh-200px)]">
          {selectedApplication ? (
            <>
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                      {selectedApplication.jobTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {t('admin.career_applications_details_applicant', {
                        name: selectedApplication.applicantName,
                      })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('admin.career_applications_details_email', {
                        email: selectedApplication.applicantEmail,
                      })}
                      {selectedApplication.applicantPhone &&
                        ` | ${t('admin.career_applications_details_phone', {
                          phone: selectedApplication.applicantPhone,
                        })}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('admin.career_applications_details_applied', {
                        date:
                          selectedApplication.createdAt &&
                          typeof selectedApplication.createdAt.toDate === 'function'
                            ? new Date(
                                selectedApplication.createdAt.toDate()
                              ).toLocaleString()
                            : t('admin.career_applications_created_unknown'),
                      })}
                    </p>
                  </div>
                  <select
                    value={selectedApplication.status}
                    onChange={(e) => handleStatusChange(selectedApplication.id!, e.target.value as 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired')}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  >
                    <option value="pending">
                      {t('admin.career_applications_filter_pending')}
                    </option>
                    <option value="reviewed">
                      {t('admin.career_applications_filter_reviewed')}
                    </option>
                    <option value="shortlisted">
                      {t('admin.career_applications_filter_shortlisted')}
                    </option>
                    <option value="rejected">
                      {t('admin.career_applications_filter_rejected')}
                    </option>
                    <option value="hired">
                      {t('admin.career_applications_filter_hired')}
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">
                    {t('admin.career_applications_cover_letter')}
                  </h3>
                  <div className="prose max-w-none">
                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedApplication.coverLetter}</p>
                  </div>
                </div>
                {selectedApplication.resumeUrl && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">
                      {t('admin.career_applications_resume')}
                    </h3>
                    <a
                      href={selectedApplication.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      {t('admin.career_applications_view_resume')}
                    </a>
                  </div>
                )}
                {selectedApplication.notes && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">
                      {t('admin.career_applications_notes')}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedApplication.notes}</p>
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
                <a
                  href={`mailto:${selectedApplication.applicantEmail}?subject=Re: Application for ${selectedApplication.jobTitle}`}
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-colors w-full sm:w-auto justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {t('admin.career_applications_contact_applicant')}
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 01-.75-.75v-4.25m16.5 0a2.25 2.25 0 00-.75-1.663V7.5a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v4.987a2.25 2.25 0 00.75 1.663m16.5 0v.75a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25v-.75m16.5 0A2.25 2.25 0 0018 13.5H6a2.25 2.25 0 00-2.25 2.25v4.5A2.25 2.25 0 006 22.5h12a2.25 2.25 0 002.25-2.25v-4.5z" />
                </svg>
                <p>{t('admin.career_applications_select_prompt')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CareerPage;

