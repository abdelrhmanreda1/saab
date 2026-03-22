'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { addNewsletterSubscription } from '@/lib/firestore/newsletter_db';

type FooterLink = { href: string; label: string };
type ContactItem = { href?: string; label: string; icon: 'phone' | 'email' | 'location' };
type MobileSectionId = 'shop' | 'company' | 'support' | 'contact';

export default function Footer() {
  const { settings } = useSettings();
  const { currentLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMobileSection, setOpenMobileSection] = useState<MobileSectionId | null>('shop');

  const normalizeCode = (code?: string | null) => String(code || '').trim().toLowerCase();
  const isArabic = normalizeCode(currentLanguage?.code) === 'ar';
  const isRTL = currentLanguage?.isRTL || false;

  const pickLabel = (arabicText: string, key: string, englishText: string) =>
    isArabic ? arabicText : t(key) || englishText;

  const labels = {
    goldPrices: pickLabel('أسعار الذهب', 'nav.gold_prices', 'Gold Prices'),
    newsletterTitle: pickLabel('اشترك في النشرة البريدية', 'footer.newsletter_title', 'Join Our Newsletter'),
    newsletterDescription: pickLabel(
      'سجل للحصول على العروض الحصرية والمنتجات الجديدة ونصائح الأناقة مباشرة إلى بريدك الإلكتروني.',
      'footer.newsletter_description',
      'Sign up for exclusive offers, new arrivals, and style updates directly to your inbox.'
    ),
    newsletterPlaceholder: pickLabel('أدخل بريدك الإلكتروني', 'footer.email_placeholder', 'Enter your email address'),
    newsletterSubmitting: pickLabel('جارٍ الاشتراك...', 'footer.subscribing', 'Subscribing...'),
    newsletterSubscribed: pickLabel('تم الاشتراك!', 'footer.subscribed', 'Subscribed!'),
    newsletterSubscribe: pickLabel('اشترك', 'footer.subscribe', 'Subscribe'),
    newsletterThanks: pickLabel('شكرًا لاشتراكك!', 'footer.subscribe_thanks', 'Thank you for subscribing!'),
    scrollToTop: pickLabel('الرجوع للأعلى', 'footer.scroll_to_top', 'Scroll to top'),
    shop: pickLabel('المتجر', 'footer.shop', 'Shop'),
    allProducts: pickLabel('كل المنتجات', 'footer.all_products', 'All Products'),
    categories: pickLabel('الأقسام', 'nav.categories', 'Categories'),
    brands: pickLabel('العلامات التجارية', 'common.brands', 'Brands'),
    newArrivals: pickLabel('وصل حديثًا', 'footer.new_arrivals', 'New Arrivals'),
    company: pickLabel('الشركة', 'footer.company', 'Company'),
    about: pickLabel('من نحن', 'footer.about_us', 'About Us'),
    careers: pickLabel('الوظائف', 'footer.careers', 'Careers'),
    storeLocator: pickLabel('فروعنا', 'footer.store_locator', 'Store Locator'),
    contact: pickLabel('تواصل معنا', 'footer.contact', 'Contact'),
    blog: pickLabel('المدونة', 'common.blog', 'Blog'),
    support: pickLabel('الدعم', 'footer.support', 'Support'),
    faq: pickLabel('الأسئلة الشائعة', 'footer.faq', 'FAQs'),
    shipping: pickLabel('الشحن والإرجاع', 'footer.shipping', 'Shipping & Returns'),
    sizeGuide: pickLabel('دليل المقاسات', 'footer.size_guide', 'Size Guide'),
    trackOrder: pickLabel('تتبع الطلب', 'footer.track_order', 'Track Order'),
    followUs: pickLabel('تابعنا', 'footer.follow_us', 'Follow Us'),
    privacy: pickLabel('سياسة الخصوصية', 'footer.privacy', 'Privacy Policy'),
    terms: pickLabel('الشروط والأحكام', 'footer.terms', 'Terms of Service'),
    weAccept: pickLabel('وسائل الدفع:', 'footer.we_accept', 'We accept:'),
    socialFacebook: pickLabel('فيسبوك', 'footer.social_facebook', 'Facebook'),
    socialInstagram: pickLabel('إنستجرام', 'footer.social_instagram', 'Instagram'),
    socialTwitter: pickLabel('إكس', 'footer.social_twitter', 'Twitter'),
    socialYoutube: pickLabel('يوتيوب', 'footer.social_youtube', 'YouTube'),
    emailInvalid: pickLabel('يرجى إدخال بريد إلكتروني صحيح.', 'footer.email_invalid', 'Please enter a valid email address.'),
    subscribeFailed: pickLabel('فشل الاشتراك. حاول مرة أخرى.', 'footer.subscribe_failed', 'Failed to subscribe. Please try again.'),
    mobileBadge: isArabic ? 'واجهة أهدأ' : 'Refined Layout',
    mobileSummary: isArabic
      ? 'روابط مهمة، دعم، وتواصل بشكل أوضح وأسهل على الموبايل.'
      : 'Important links, support, and contact details arranged better for mobile.',
  };

  const socialLinks = settings?.social || { facebook: '', instagram: '', twitter: '', youtube: '' };
  const footerBg = settings?.theme?.colors?.footerBackground || '#111827';
  const footerText = settings?.theme?.colors?.footerText || '#ffffff';
  const companyName = settings?.company?.name || 'Store';
  const copyrightText =
    settings?.site?.copyrightText ||
    (isArabic
      ? `© ${new Date().getFullYear()} ${companyName}. جميع الحقوق محفوظة.`
      : `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`);

  const isValidUrl = (url: string | undefined) => {
    if (!url) return false;
    const trimmed = url.trim();
    return trimmed !== '' && trimmed !== '#' && trimmed !== 'http://' && trimmed !== 'https://';
  };

  const shopLinks = useMemo<FooterLink[]>(
    () => [
      { href: '/shop', label: labels.allProducts },
      { href: '/categories', label: labels.categories },
      { href: '/gold-price', label: labels.goldPrices },
      { href: '/brands', label: labels.brands },
      { href: '/shop?filter=new', label: labels.newArrivals },
    ],
    [labels.allProducts, labels.brands, labels.categories, labels.goldPrices, labels.newArrivals]
  );

  const companyLinks = useMemo<FooterLink[]>(
    () =>
      [
        settings?.pages?.aboutUs ? { href: '/about', label: labels.about } : null,
        settings?.pages?.careers ? { href: '/careers', label: labels.careers } : null,
        settings?.pages?.storeLocator ? { href: '/store-locator', label: labels.storeLocator } : null,
        settings?.pages?.contactUs ? { href: '/contact', label: labels.contact } : null,
        settings?.features?.blog ? { href: '/blog', label: labels.blog } : null,
      ].filter(Boolean) as FooterLink[],
    [labels.about, labels.blog, labels.careers, labels.contact, labels.storeLocator, settings?.features?.blog, settings?.pages?.aboutUs, settings?.pages?.careers, settings?.pages?.contactUs, settings?.pages?.storeLocator]
  );

  const supportLinks = useMemo<FooterLink[]>(
    () =>
      [
        settings?.pages?.faqs ? { href: '/faq', label: labels.faq } : null,
        settings?.pages?.shippingReturns ? { href: '/shipping-returns', label: labels.shipping } : null,
        settings?.pages?.sizeGuide ? { href: '/size-guide', label: labels.sizeGuide } : null,
        { href: '/track-order', label: labels.trackOrder },
      ].filter(Boolean) as FooterLink[],
    [labels.faq, labels.shipping, labels.sizeGuide, labels.trackOrder, settings?.pages?.faqs, settings?.pages?.shippingReturns, settings?.pages?.sizeGuide]
  );

  const contactItems = useMemo<ContactItem[]>(
    () =>
      [
        settings?.company?.phone ? { href: `tel:${settings.company.phone}`, label: settings.company.phone, icon: 'phone' } : null,
        settings?.company?.email ? { href: `mailto:${settings.company.email}`, label: settings.company.email, icon: 'email' } : null,
        settings?.company?.address || settings?.company?.city || settings?.company?.state
          ? {
              label: `${settings?.company?.address ? `${settings.company.address}, ` : ''}${settings?.company?.city || ''}${settings?.company?.city && settings?.company?.state ? ', ' : ''}${settings?.company?.state || ''}${settings?.company?.zipCode ? ` ${settings.company.zipCode}` : ''}`.trim(),
              icon: 'location',
            }
          : null,
      ].filter(Boolean) as ContactItem[],
    [settings?.company?.address, settings?.company?.city, settings?.company?.email, settings?.company?.phone, settings?.company?.state, settings?.company?.zipCode]
  );

  const mobileSections = [
    { id: 'shop' as const, title: labels.shop, links: shopLinks },
    { id: 'company' as const, title: labels.company, links: companyLinks },
    { id: 'support' as const, title: labels.support, links: supportLinks },
    { id: 'contact' as const, title: labels.contact, links: [] as FooterLink[] },
  ];

  const renderContactIcon = (icon: ContactItem['icon']) => {
    if (icon === 'phone') return <span>☎</span>;
    if (icon === 'email') return <span>@</span>;
    return <span>⌂</span>;
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(labels.emailInvalid);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addNewsletterSubscription({ email: email.trim(), source: 'footer' });
      setSubmitted(true);
      setEmail('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setError(labels.subscribeFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText }} className="relative border-t border-gray-800">
      <button
        onClick={scrollToTop}
        className={`absolute top-0 hidden -translate-y-1/2 rounded-full bg-white p-3 text-gray-900 shadow-lg transition-all duration-200 hover:scale-105 hover:bg-gray-100 md:inline-flex ${isRTL ? 'left-8' : 'right-8'}`}
        aria-label={labels.scrollToTop}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-800 py-12">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="mb-3 text-2xl font-semibold text-white sm:text-3xl">{labels.newsletterTitle}</h3>
            <p className="mx-auto mb-6 max-w-lg text-sm text-gray-400 sm:text-base">{labels.newsletterDescription}</p>
            <form onSubmit={handleNewsletterSubmit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={labels.newsletterPlaceholder}
                className="flex-1 rounded-xl border border-gray-700 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-400 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-white"
                required
                disabled={submitting || submitted}
              />
              <button
                type="submit"
                disabled={submitting || submitted}
                className="whitespace-nowrap rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? labels.newsletterSubmitting : submitted ? labels.newsletterSubscribed : labels.newsletterSubscribe}
              </button>
            </form>
            <div className="mt-3 min-h-5">
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {submitted && !error ? <p className="text-sm text-green-400">{labels.newsletterThanks}</p> : null}
            </div>
          </div>
        </div>

        <div className="py-10 md:py-12">
          <div className="md:hidden">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_rgba(255,255,255,0.04)_40%,_transparent_72%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <div>
                  <div className="inline-flex items-center rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#f2d680]">
                    {labels.mobileBadge}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-white">{companyName}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-300">{labels.mobileSummary}</p>
                </div>
                <button
                  onClick={scrollToTop}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition-transform hover:scale-105"
                  aria-label={labels.scrollToTop}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Link href="/shop" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">{labels.allProducts}</Link>
                <Link href="/track-order" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">{labels.trackOrder}</Link>
                <Link href="/gold-price" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">{labels.goldPrices}</Link>
                <Link href="/contact" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">{labels.contact}</Link>
              </div>

              <div className="mt-6 space-y-3">
                {mobileSections.map((section) => {
                  const isOpen = openMobileSection === section.id;
                  return (
                    <div key={section.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/15">
                      <button
                        type="button"
                        onClick={() => setOpenMobileSection(isOpen ? null : section.id)}
                        className="flex w-full items-center justify-between px-4 py-4 text-sm font-semibold text-white"
                      >
                        <span>{section.title}</span>
                        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                      </button>
                      {isOpen ? (
                        <div className="border-t border-white/10 px-4 py-3">
                          {section.id === 'contact' ? (
                            <div className="space-y-3">
                              {contactItems.map((item) => {
                                const block = (
                                  <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 text-sm text-gray-300">
                                    <span className="mt-0.5 text-[#f2d680]">{renderContactIcon(item.icon)}</span>
                                    <span className="min-w-0 break-words leading-6">{item.label}</span>
                                  </div>
                                );
                                return item.href ? <a key={`${item.icon}-${item.label}`} href={item.href}>{block}</a> : <div key={`${item.icon}-${item.label}`}>{block}</div>;
                              })}
                            </div>
                          ) : (
                            <div className="grid gap-2">
                              {section.links.map((link) => (
                                <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white">
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">{labels.followUs}</h4>
                <div className="mt-3 flex flex-wrap gap-3">
                  {isValidUrl(socialLinks.facebook) ? <a href={socialLinks.facebook.startsWith('http') ? socialLinks.facebook : `https://${socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-gray-300 transition-all duration-200 hover:bg-[#1877F2] hover:text-white" aria-label={labels.socialFacebook}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg></a> : null}
                  {isValidUrl(socialLinks.instagram) ? <a href={socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://${socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-gray-300 transition-all duration-200 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] hover:text-white" aria-label={labels.socialInstagram}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></a> : null}
                  {isValidUrl(socialLinks.twitter) ? <a href={socialLinks.twitter.startsWith('http') ? socialLinks.twitter : `https://${socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-gray-300 transition-all duration-200 hover:bg-[#1DA1F2] hover:text-white" aria-label={labels.socialTwitter}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg></a> : null}
                  {isValidUrl(socialLinks.youtube) ? <a href={socialLinks.youtube.startsWith('http') ? socialLinks.youtube : `https://${socialLinks.youtube}`} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-gray-300 transition-all duration-200 hover:bg-[#FF0000] hover:text-white" aria-label={labels.socialYoutube}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg></a> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-8 md:grid md:grid-cols-4 lg:grid-cols-5 lg:gap-12">
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{labels.shop}</h4>
              <ul className="space-y-3 text-sm">
                {shopLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-gray-400 transition-colors duration-200 hover:text-white">{link.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{labels.company}</h4>
              <ul className="space-y-3 text-sm">
                {companyLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-gray-400 transition-colors duration-200 hover:text-white">{link.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{labels.support}</h4>
              <ul className="space-y-3 text-sm">
                {supportLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-gray-400 transition-colors duration-200 hover:text-white">{link.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{labels.contact}</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                {contactItems.map((item) => (
                  <li key={`${item.icon}-${item.label}`} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0">{renderContactIcon(item.icon)}</span>
                    {item.href ? <a href={item.href} className="break-all transition-colors duration-200 hover:text-white">{item.label}</a> : <span className="leading-relaxed">{item.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{labels.followUs}</h4>
              <div className="flex flex-wrap gap-3">
                {isValidUrl(socialLinks.facebook) ? <a href={socialLinks.facebook.startsWith('http') ? socialLinks.facebook : `https://${socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-[#1877F2] hover:text-white" aria-label={labels.socialFacebook}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg></a> : null}
                {isValidUrl(socialLinks.instagram) ? <a href={socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://${socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] hover:text-white" aria-label={labels.socialInstagram}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></a> : null}
                {isValidUrl(socialLinks.twitter) ? <a href={socialLinks.twitter.startsWith('http') ? socialLinks.twitter : `https://${socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-[#1DA1F2] hover:text-white" aria-label={labels.socialTwitter}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg></a> : null}
                {isValidUrl(socialLinks.youtube) ? <a href={socialLinks.youtube.startsWith('http') ? socialLinks.youtube : `https://${socialLinks.youtube}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-[#FF0000] hover:text-white" aria-label={labels.socialYoutube}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg></a> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col items-center justify-between gap-6 text-sm md:flex-row">
            <p className="text-center text-gray-400 md:text-left">{copyrightText}</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400">
              {settings?.pages?.privacyPolicy ? <Link href="/privacy" className="transition-colors duration-200 hover:text-white">{labels.privacy}</Link> : null}
              {settings?.pages?.termsOfService ? <Link href="/terms" className="transition-colors duration-200 hover:text-white">{labels.terms}</Link> : null}
            </div>
            {settings?.theme?.paymentMethods && settings.theme.paymentMethods.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
                <span className="text-xs text-gray-400">{labels.weAccept}</span>
                <div className="flex items-center gap-2">
                  {settings.theme.paymentMethods.sort((a, b) => (a.order || 0) - (b.order || 0)).map((method) => (
                    <div key={method.id} className="flex items-center justify-center rounded-md border border-gray-100 bg-white px-3 py-2 shadow-sm" style={{ minWidth: '50px', height: '32px' }} title={method.name}>
                      {method.imageUrl ? <Image src={method.imageUrl} alt={method.name} width={50} height={28} className="max-h-[28px] max-w-[50px] object-contain" /> : <span className="text-xs text-gray-500">{method.name}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
