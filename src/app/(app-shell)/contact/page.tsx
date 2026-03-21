'use client';

import React, { useState } from 'react';
import { addContactSubmission } from '@/lib/firestore/contact_db';
import { useSettings } from '../../context/SettingsContext';
import { validateEmail, validateName, validateRequired } from '@/lib/utils/validation';
import { useLanguage } from '@/context/LanguageContext';

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const ContactPage = () => {
  const { settings } = useSettings();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors({ ...errors, [name]: undefined });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTouched({ ...touched, [name]: true });
    
    // Validate on blur
    let error: string | undefined;
    if (name === 'name') {
      const result = validateName(value);
      if (!result.isValid) error = result.error;
    } else if (name === 'email') {
      const result = validateEmail(value);
      if (!result.isValid) error = result.error;
    } else if (name === 'subject') {
      const result = validateRequired(value, 'Subject');
      if (!result.isValid) error = result.error;
    } else if (name === 'message') {
      const result = validateRequired(value, 'Message');
      if (!result.isValid) error = result.error;
    }
    
    if (error) {
      setErrors({ ...errors, [name]: error });
    } else {
      setErrors({ ...errors, [name]: undefined });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors: FormErrors = {};
    const nameResult = validateName(formData.name);
    if (!nameResult.isValid) newErrors.name = nameResult.error;
    
    const emailResult = validateEmail(formData.email);
    if (!emailResult.isValid) newErrors.email = emailResult.error;
    
    const subjectResult = validateRequired(formData.subject, 'Subject');
    if (!subjectResult.isValid) newErrors.subject = subjectResult.error;
    
    const messageResult = validateRequired(formData.message, 'Message');
    if (!messageResult.isValid) newErrors.message = messageResult.error;
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ name: true, email: true, subject: true, message: true });
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      await addContactSubmission({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });
      setSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTouched({});
      setErrors({});
    } catch {
      // Failed to submit contact form
      setErrors({ message: t('contact.error_send_failed') || 'Failed to send message. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">{t('contact.title') || 'Contact Us'}</h1>
          <p className="text-sm text-gray-500">{t('contact.subtitle') || "Have questions or feedback? We'd love to hear from you."}</p>
        </div>
      </div>

      <div className="page-container max-w-5xl">
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Contact Info */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">{t('contact.get_in_touch') || 'Get in Touch'}</h2>
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              {t('contact.availability') || 'Our team is available Monday through Friday, 9am to 6pm to assist you with any inquiries regarding your order, our products, or general feedback.'}
            </p>

            <div className="space-y-4">
              {settings?.company?.email && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('contact.email') || 'Email'}</h3>
                    <p className="text-xs text-gray-500">{settings.company.email}</p>
                  </div>
                </div>
              )}

              {settings?.company?.phone && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('contact.phone') || 'Phone'}</h3>
                    <p className="text-xs text-gray-500">{settings.company.phone}</p>
                  </div>
                </div>
              )}

              {(settings?.company?.address || settings?.company?.city || settings?.company?.state || settings?.company?.countryCode) && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('contact.location') || 'Location'}</h3>
                    <p className="text-xs text-gray-500">
                      {settings.company.address && <>{settings.company.address}<br/></>}
                      {settings.company.city && `${settings.company.city}`}
                      {settings.company.city && settings.company.state && ', '}
                      {settings.company.state && `${settings.company.state}`}
                      {settings.company.zipCode && ` ${settings.company.zipCode}`}
                      {settings.company.countryCode && (settings.company.address || settings.company.city || settings.company.state) && <><br/>{settings.company.countryCode}</>}
                      {settings.company.countryCode && !settings.company.address && !settings.company.city && !settings.company.state && settings.company.countryCode}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white p-6 rounded-xl border border-gray-100">
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold mb-2">{t('contact.success_title') || 'Message Sent!'}</h3>
                <p className="text-xs text-gray-500">{t('contact.success_desc') || 'Thank you for contacting us. We will get back to you shortly.'}</p>
                <button onClick={() => setSubmitted(false)} className="mt-4 text-xs underline font-medium">{t('contact.send_another') || 'Send another message'}</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-700">{t('contact.name_label') || 'Name'}</label>
                        <input 
                            type="text" 
                            name="name" 
                            value={formData.name} 
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`w-full bg-gray-50 border rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-black outline-none transition-all ${
                              touched.name && errors.name ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-black'
                            }`}
                            placeholder={t('contact.name_placeholder') || 'Your Name'}
                        />
                        {touched.name && errors.name && (
                          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-700">{t('contact.email_label') || 'Email'}</label>
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`w-full bg-gray-50 border rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-black outline-none transition-all ${
                              touched.email && errors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-black'
                            }`}
                            placeholder={t('contact.email_placeholder') || 'your@email.com'}
                        />
                        {touched.email && errors.email && (
                          <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                        )}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-700">{t('contact.subject_label') || 'Subject'}</label>
                    <input 
                        type="text" 
                        name="subject" 
                        value={formData.subject} 
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`w-full bg-gray-50 border rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-black outline-none transition-all ${
                          touched.subject && errors.subject ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-black'
                        }`}
                        placeholder={t('contact.subject_placeholder') || 'How can we help?'}
                    />
                    {touched.subject && errors.subject && (
                      <p className="mt-1 text-xs text-red-600">{errors.subject}</p>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-700">{t('contact.message_label') || 'Message'}</label>
                    <textarea 
                        name="message" 
                        value={formData.message} 
                        onChange={handleChange}
                        onBlur={handleBlur}
                        rows={5} 
                        className={`w-full bg-gray-50 border rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-black outline-none transition-all resize-none ${
                          touched.message && errors.message ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-black'
                        }`}
                        placeholder={t('contact.message_placeholder') || 'Write your message here...'}
                    ></textarea>
                    {touched.message && errors.message && (
                      <p className="mt-1 text-xs text-red-600">{errors.message}</p>
                    )}
                </div>
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                    {isSubmitting && (
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
                    {isSubmitting ? (t('contact.sending') || 'Sending...') : (t('contact.send') || 'Send Message')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
