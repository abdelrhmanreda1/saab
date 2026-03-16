'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { addNewsletterSubscription } from '@/lib/firestore/newsletter_db';

const Footer = () => {
  const { settings } = useSettings();
  const { currentLanguage, t } = useLanguage();
  const isRTL = currentLanguage?.isRTL || false;
  const goldPricesLabel = t('nav.gold_prices') || 'Gold Prices';
  
  // Get social media links from settings and validate
  const socialLinks = settings?.social || {
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: ''
  };
  
  // Helper function to check if URL is valid and not empty
  const isValidUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    const trimmed = url.trim();
    return trimmed !== '' && trimmed !== '#' && trimmed !== 'http://' && trimmed !== 'https://';
  };
  
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('footer.email_invalid') || 'Please enter a valid email address.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await addNewsletterSubscription({
        email: email.trim(),
        source: 'footer',
      });
      setSubmitted(true);
      setEmail('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setError(t('footer.subscribe_failed') || 'Failed to subscribe. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const footerBg = settings?.theme?.colors?.footerBackground || '#111827';
  const footerText = settings?.theme?.colors?.footerText || '#ffffff';

  return (
    <footer 
      style={{
        backgroundColor: footerBg,
        color: footerText,
      }}
      className="relative border-t border-gray-800"
    >
      {/* Scroll to Top Button */}
      <button 
        onClick={scrollToTop}
        className={`absolute top-0 ${isRTL ? 'left-8' : 'right-8'} -translate-y-1/2 bg-white text-gray-900 p-3 rounded-full shadow-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105`}
        aria-label={t('footer.scroll_to_top') || 'Scroll to top'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Newsletter Section */}
        <div className="py-12 border-b border-gray-800">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
              {t('footer.newsletter_title') || 'Join Our Newsletter'}
            </h3>
            <p className="text-gray-400 text-sm sm:text-base mb-6 max-w-lg mx-auto">
              {t('footer.newsletter_description') || 'Sign up for exclusive offers, new arrivals, and fashion tips directly to your inbox. Be the first to know about our sales.'}
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input 
                type="email" 
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={t('footer.email_placeholder') || 'Enter your email address'} 
                className="flex-1 bg-white/10 border border-gray-700 text-white placeholder-gray-400 px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-sm"
                required
                disabled={submitting || submitted}
              />
              <button 
                type="submit"
                disabled={submitting || submitted}
                className="bg-white text-gray-900 px-6 py-3 font-semibold text-sm rounded-lg hover:bg-gray-100 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {submitting
                  ? (t('footer.subscribing') || 'Subscribing...')
                  : submitted
                    ? (t('footer.subscribed') || 'Subscribed!')
                    : (t('footer.subscribe') || 'Subscribe')}
              </button>
            </form>
            {error && (
              <p className="text-red-400 text-sm mt-3">{error}</p>
            )}
            {submitted && !error && (
              <p className="text-green-400 text-sm mt-3">{t('footer.subscribe_thanks') || 'Thank you for subscribing!'}</p>
            )}
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
            
            {/* Shop Column */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                {t('footer.shop') || 'Shop'}
              </h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/shop" className="text-gray-400 hover:text-white transition-colors duration-200">
                    {t('footer.all_products') || 'All Products'}
                  </Link>
                </li>
                <li>
                  <Link href="/categories" className="text-gray-400 hover:text-white transition-colors duration-200">
                    {t('nav.categories') || 'Categories'}
                  </Link>
                </li>
                <li>
                  <Link href="/gold-price" className="text-gray-400 hover:text-white transition-colors duration-200">
                    {goldPricesLabel}
                  </Link>
                </li>
                <li>
                  <Link href="/brands" className="text-gray-400 hover:text-white transition-colors duration-200">
                    {t('common.brands') || 'Brands'}
                  </Link>
                </li>
                <li>
                  <Link href="/shop?filter=new" className="text-gray-400 hover:text-white transition-colors duration-200">
                    {t('footer.new_arrivals') || 'New Arrivals'}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                {t('footer.company') || 'Company'}
              </h4>
              <ul className="space-y-3 text-sm">
                {settings?.pages?.aboutUs && (
                  <li>
                    <Link href="/about" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.about_us') || 'About Us'}
                    </Link>
                  </li>
                )}
                {settings?.pages?.careers && (
                  <li>
                    <Link href="/careers" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.careers') || 'Careers'}
                    </Link>
                  </li>
                )}
                {settings?.pages?.storeLocator && (
                  <li>
                    <Link href="/store-locator" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.store_locator') || 'Store Locator'}
                    </Link>
                  </li>
                )}
                {settings?.pages?.contactUs && (
                  <li>
                    <Link href="/contact" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.contact') || 'Contact'}
                    </Link>
                  </li>
                )}
                {settings?.features?.blog && (
                  <li>
                    <Link href="/blog" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('common.blog') || 'Blog'}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Support Column */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                {t('footer.support') || 'Support'}
              </h4>
              <ul className="space-y-3 text-sm">
                {settings?.pages?.faqs && (
                  <li>
                    <Link href="/faq" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.faq') || 'FAQs'}
                    </Link>
                  </li>
                )}
                {settings?.pages?.shippingReturns && (
                  <li>
                    <Link href="/shipping-returns" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.shipping') || 'Shipping & Returns'}
                    </Link>
                  </li>
                )}
                {settings?.pages?.sizeGuide && (
                  <li>
                    <Link href="/size-guide" className="text-gray-400 hover:text-white transition-colors duration-200">
                      {t('footer.size_guide') || 'Size Guide'}
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/track-order" className="text-gray-400 hover:text-white transition-colors duration-200">
                    {t('footer.track_order') || 'Track Order'}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                {t('footer.contact') || 'Contact'}
              </h4>
              <ul className="space-y-3 text-sm text-gray-400">
                {settings?.company?.phone && (
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${settings.company.phone}`} className="hover:text-white transition-colors duration-200">
                      {settings.company.phone}
                    </a>
                  </li>
                )}
                {settings?.company?.email && (
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${settings.company.email}`} className="hover:text-white transition-colors duration-200 break-all">
                      {settings.company.email}
                    </a>
                  </li>
                )}
                {(settings?.company?.address || settings?.company?.city || settings?.company?.state) && (
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="leading-relaxed">
                      {settings.company.address && <>{settings.company.address}<br/></>}
                      {settings.company.city && `${settings.company.city}`}
                      {settings.company.city && settings.company.state && ', '}
                      {settings.company.state && `${settings.company.state}`}
                      {settings.company.zipCode && ` ${settings.company.zipCode}`}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Social Media Column */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                {t('footer.follow_us') || 'Follow Us'}
              </h4>
              <div className="flex flex-wrap gap-3">
                {isValidUrl(socialLinks.facebook) && (
                  <a 
                    href={socialLinks.facebook.startsWith('http') ? socialLinks.facebook : `https://${socialLinks.facebook}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-[#1877F2] text-gray-400 hover:text-white transition-all duration-200"
                    aria-label={t('footer.social_facebook') || 'Facebook'}
                  >
                    <svg fill="currentColor" className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path>
                    </svg>
                  </a>
                )}
                {isValidUrl(socialLinks.instagram) && (
                  <a 
                    href={socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://${socialLinks.instagram}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] text-gray-400 hover:text-white transition-all duration-200"
                    aria-label={t('footer.social_instagram') || 'Instagram'}
                  >
                    <svg fill="currentColor" className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
                    </svg>
                  </a>
                )}
                {isValidUrl(socialLinks.twitter) && (
                  <a 
                    href={socialLinks.twitter.startsWith('http') ? socialLinks.twitter : `https://${socialLinks.twitter}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-[#1DA1F2] text-gray-400 hover:text-white transition-all duration-200"
                    aria-label={t('footer.social_twitter') || 'Twitter'}
                  >
                    <svg fill="currentColor" className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"></path>
                    </svg>
                  </a>
                )}
                {isValidUrl(socialLinks.youtube) && (
                  <a 
                    href={socialLinks.youtube.startsWith('http') ? socialLinks.youtube : `https://${socialLinks.youtube}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-[#FF0000] text-gray-400 hover:text-white transition-all duration-200"
                    aria-label={t('footer.social_youtube') || 'YouTube'}
                  >
                    <svg fill="currentColor" className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
            
            {/* Copyright */}
            <p className="text-gray-400 text-center md:text-left">
              {settings?.site?.copyrightText || `© ${new Date().getFullYear()} ${settings?.company?.name || ''}. All rights reserved.`}
            </p>

            {/* Legal Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400">
              {settings?.pages?.privacyPolicy && (
                <Link href="/privacy" className="hover:text-white transition-colors duration-200">
                  {t('footer.privacy') || 'Privacy Policy'}
                </Link>
              )}
              {settings?.pages?.termsOfService && (
                <Link href="/terms" className="hover:text-white transition-colors duration-200">
                  {t('footer.terms') || 'Terms of Service'}
                </Link>
              )}
            </div>

            {/* Payment Methods */}
            {settings?.theme?.paymentMethods && settings.theme.paymentMethods.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end">
                <span className="text-gray-400 text-xs">{t('footer.we_accept') || 'We accept:'}</span>
                <div className="flex items-center gap-2">
                  {settings.theme.paymentMethods
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((method) => (
                      <div
                        key={method.id}
                        className="bg-white px-3 py-2 rounded-md flex items-center justify-center shadow-sm border border-gray-100"
                        style={{ minWidth: '50px', height: '32px' }}
                        title={method.name}
                      >
                        {method.imageUrl ? (
                          <Image
                            src={method.imageUrl}
                            alt={method.name}
                            width={50}
                            height={28}
                            className="max-w-[50px] max-h-[28px] object-contain"
                          />
                        ) : (
                          <span className="text-xs text-gray-500">{method.name}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
