'use client';

import { memo, useState } from 'react';
import { useHomeLanguage } from '@/app/(home)/home-context';

function HomeNewsletterForm() {
  const { t } = useHomeLanguage();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || newsletterLoading) return;

    setNewsletterLoading(true);
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newsletterEmail,
          source: 'homepage',
        }),
      });
      if (!response.ok) {
        throw new Error('failed');
      }
      setNewsletterSuccess(true);
      setNewsletterEmail('');
      setTimeout(() => setNewsletterSuccess(false), 3000);
    } catch {
      // Ignore newsletter submission failures in UI.
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
        <input
          type="email"
          value={newsletterEmail}
          onChange={(e) => setNewsletterEmail(e.target.value)}
          placeholder={t('home.newsletter_placeholder') || 'Enter your email'}
          required
          className="flex-1 px-6 py-4 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
        />
        <button
          type="submit"
          disabled={newsletterLoading}
          className="px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {newsletterLoading
            ? t('home.newsletter_subscribing') || 'Subscribing...'
            : t('home.newsletter_subscribe') || 'Subscribe'}
        </button>
      </form>
      {newsletterSuccess && (
        <p className="mt-4 text-green-400 font-medium">
          {t('home.newsletter_success') || 'Thank you for subscribing!'}
        </p>
      )}
    </>
  );
}

export default memo(HomeNewsletterForm);
