'use client';

import React, { useState, useEffect } from 'react';
import { getPageBySlug } from '@/lib/firestore/pages_db';
import { Page, PageContentTranslation } from '@/lib/firestore/pages';
import { useLanguage } from '../../context/LanguageContext';
import { addJobApplication } from '@/lib/firestore/job_applications_db';
import { useToast } from '@/components/Toast';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { validateEmail, validateName, validateRequired } from '@/lib/utils/validation';

interface JobItem {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  isActive: boolean;
}

const CareersPage = () => {
  const { t, currentLanguage } = useLanguage();
  const { showError } = useToast();
  const [, setPage] = useState<Page | null>(null);
  const [translation, setTranslation] = useState<PageContentTranslation | null>(null);
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationData, setApplicationData] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    coverLetter: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        const pageData = await getPageBySlug('careers');
        setPage(pageData);
        
        if (pageData) {
          const translations = pageData.translations || [];
          const langCode = currentLanguage?.code || 'en';
          const pageTranslation = translations.find(t => t.languageCode === langCode)
            || translations.find(t => t.languageCode === 'en')
            || translations[0];
          
          setTranslation(pageTranslation || null);
          
          if (pageTranslation?.content) {
            parseJobContent(pageTranslation.content);
          } else {
            setJobItems([]);
          }
        } else {
          setTranslation(null);
          setJobItems([]);
        }
      } catch {
        // Failed to load careers page
        setTranslation(null);
        setJobItems([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadPage();
  }, [currentLanguage]);

  const parseJobContent = (htmlContent: string) => {
    if (!htmlContent) {
      setJobItems([]);
      return;
    }
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const elements = Array.from(doc.body.children);
      const items: JobItem[] = [];
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.tagName.toLowerCase() === 'div' && element.getAttribute('data-job') === 'true') {
          const title = element.querySelector('[data-field="title"]')?.textContent?.trim() || '';
          const department = element.querySelector('[data-field="department"]')?.textContent?.replace('Department:', '').trim() || '';
          const location = element.querySelector('[data-field="location"]')?.textContent?.replace('Location:', '').trim() || '';
          const type = element.querySelector('[data-field="type"]')?.textContent?.replace('Type:', '').trim() || 'Full-time';
          const description = element.querySelector('[data-field="description"]')?.innerHTML || '';
          const requirements = element.querySelector('[data-field="requirements"]')?.innerHTML || '';
          const isActive = element.getAttribute('data-active') !== 'false';
          
          if (title && isActive) {
            items.push({ title, department, location, type, description, requirements, isActive });
          }
        }
      }
      
      setJobItems(items);
    } catch {
      // Failed to parse job content
      setJobItems([]);
    }
  };

  const handleApplyClick = (job: JobItem) => {
    setSelectedJob(job);
    setShowApplicationForm(true);
    setApplicationData({
      applicantName: '',
      applicantEmail: '',
      applicantPhone: '',
      coverLetter: '',
    });
    setResumeFile(null);
    setSubmitted(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    // Validate form
    const newErrors: Record<string, string> = {};
    
    const nameResult = validateName(applicationData.applicantName);
    if (!nameResult.isValid) newErrors.applicantName = nameResult.error || 'Name is required';
    
    const emailResult = validateEmail(applicationData.applicantEmail);
    if (!emailResult.isValid) newErrors.applicantEmail = emailResult.error || 'Email is required';
    
    const coverLetterResult = validateRequired(applicationData.coverLetter, 'Cover letter');
    if (!coverLetterResult.isValid) newErrors.coverLetter = coverLetterResult.error || 'Cover letter is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ applicantName: true, applicantEmail: true, coverLetter: true });
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      let resumeUrl = '';
      
      // Upload resume if provided
      if (resumeFile) {
        const sanitizedFileName = resumeFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `job_applications/${Date.now()}_${sanitizedFileName}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, resumeFile);
        resumeUrl = await getDownloadURL(storageRef);
      }

      await addJobApplication({
        jobTitle: selectedJob.title,
        applicantName: applicationData.applicantName,
        applicantEmail: applicationData.applicantEmail,
        applicantPhone: applicationData.applicantPhone || undefined,
        coverLetter: applicationData.coverLetter,
        resumeUrl: resumeUrl || undefined,
      });

      setSubmitted(true);
      setTimeout(() => {
      setShowApplicationForm(false);
      setSelectedJob(null);
      setSubmitted(false);
      setTouched({});
      setErrors({});
    }, 3000);
    } catch {
      // Failed to submit application
      showError(t('careers.submit_failed') || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-2 w-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const activeJobs = jobItems.filter(job => job.isActive);

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {translation?.title || 'Careers'}
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            Join our team and help us redefine modesty with elegance and grace.
          </p>
        </div>
      </div>

      <div className="page-container">
        {activeJobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 01-.75-.75v-4.25m16.5 0a2.25 2.25 0 00-.75-1.663V7.5a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v4.987a2.25 2.25 0 00.75 1.663m16.5 0v.75a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25v-.75m16.5 0A2.25 2.25 0 0018 13.5H6a2.25 2.25 0 00-2.25 2.25v4.5A2.25 2.25 0 006 22.5h12a2.25 2.25 0 002.25-2.25v-4.5z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold mb-1 text-gray-900">No Open Positions</h2>
            <p className="text-xs text-gray-500">We don&apos;t have any open positions at the moment. Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeJobs.map((job, index) => (
              <div key={index} className="bg-white border border-gray-100 rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-gray-900 mb-2">{job.title}</h2>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        <span>{job.department}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{job.type}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyClick(job)}
                    className="mt-4 md:mt-0 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
                  >
                    Apply Now
                  </button>
                </div>

                {job.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Job Description</h3>
                    <div 
                      className="text-gray-600 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: job.description }}
                    />
                  </div>
                )}

                {job.requirements && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Requirements</h3>
                    <div 
                      className="text-gray-600 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: job.requirements }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Apply for {selectedJob.title}</h2>
                <button
                  onClick={() => {
                    setShowApplicationForm(false);
                    setSelectedJob(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {submitted ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Application Submitted!</h3>
                <p className="text-gray-600">Thank you for your interest. We&apos;ll review your application and get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={applicationData.applicantName}
                    onChange={(e) => {
                      setApplicationData({ ...applicationData, applicantName: e.target.value });
                      if (errors.applicantName) setErrors({ ...errors, applicantName: '' });
                    }}
                    onBlur={() => {
                      setTouched({ ...touched, applicantName: true });
                      const result = validateName(applicationData.applicantName);
                      if (!result.isValid) {
                        setErrors({ ...errors, applicantName: result.error || '' });
                      } else {
                        setErrors({ ...errors, applicantName: '' });
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none transition-all ${
                      touched.applicantName && errors.applicantName ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                    }`}
                  />
                  {touched.applicantName && errors.applicantName && (
                    <p className="mt-1 text-xs text-red-600">{errors.applicantName}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={applicationData.applicantEmail}
                      onChange={(e) => {
                        setApplicationData({ ...applicationData, applicantEmail: e.target.value });
                        if (errors.applicantEmail) setErrors({ ...errors, applicantEmail: '' });
                      }}
                      onBlur={() => {
                        setTouched({ ...touched, applicantEmail: true });
                        const result = validateEmail(applicationData.applicantEmail);
                        if (!result.isValid) {
                          setErrors({ ...errors, applicantEmail: result.error || '' });
                        } else {
                          setErrors({ ...errors, applicantEmail: '' });
                        }
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none transition-all ${
                        touched.applicantEmail && errors.applicantEmail ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                      }`}
                    />
                    {touched.applicantEmail && errors.applicantEmail && (
                      <p className="mt-1 text-xs text-red-600">{errors.applicantEmail}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={applicationData.applicantPhone}
                      onChange={(e) => setApplicationData({ ...applicationData, applicantPhone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Letter *</label>
                  <textarea
                    value={applicationData.coverLetter}
                    onChange={(e) => {
                      setApplicationData({ ...applicationData, coverLetter: e.target.value });
                      if (errors.coverLetter) setErrors({ ...errors, coverLetter: '' });
                    }}
                    onBlur={() => {
                      setTouched({ ...touched, coverLetter: true });
                      const result = validateRequired(applicationData.coverLetter, 'Cover letter');
                      if (!result.isValid) {
                        setErrors({ ...errors, coverLetter: result.error || '' });
                      } else {
                        setErrors({ ...errors, coverLetter: '' });
                      }
                    }}
                    rows={6}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none resize-none transition-all ${
                      touched.coverLetter && errors.coverLetter ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                    }`}
                    placeholder="Tell us why you're interested in this position..."
                  />
                  {touched.coverLetter && errors.coverLetter && (
                    <p className="mt-1 text-xs text-red-600">{errors.coverLetter}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Resume (PDF, DOC, DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  />
                  {resumeFile && (
                    <p className="text-sm text-gray-500 mt-2">Selected: {resumeFile.name}</p>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-black text-white rounded-lg font-heading font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {submitting && (
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowApplicationForm(false);
                      setSelectedJob(null);
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CareersPage;

