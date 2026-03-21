'use client';

import { useHomeLanguage, useHomeSettings } from '@/app/(home)/home-context';
import Image from 'next/image';
import Link from 'next/link';

const HomeFooter = () => {
  const { settings } = useHomeSettings();
  const { currentLanguage, t } = useHomeLanguage();
  const isRTL = currentLanguage?.isRTL || false;
  const goldPricesLabel = t('nav.gold_prices') || 'Gold Prices';
  const socialLinks = settings?.social || { facebook: '', instagram: '', twitter: '', youtube: '' };

  const isValidUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    const trimmed = url.trim();
    return trimmed !== '' && trimmed !== '#' && trimmed !== 'http://' && trimmed !== 'https://';
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const footerBg = settings?.theme?.colors?.footerBackground || '#111827';
  const footerText = settings?.theme?.colors?.footerText || '#ffffff';

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText }} className="relative border-t border-gray-800">
      <button
        onClick={scrollToTop}
        className={`absolute top-0 ${isRTL ? 'left-8' : 'right-8'} -translate-y-1/2 rounded-full bg-white p-3 text-gray-900 shadow-lg transition-all duration-200 hover:scale-105 hover:bg-gray-100`}
        aria-label={t('footer.scroll_to_top') || 'Scroll to top'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 lg:gap-12">
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t('footer.shop') || 'Shop'}</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/shop" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.all_products') || 'All Products'}</Link></li>
                <li><Link href="/categories" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('nav.categories') || 'Categories'}</Link></li>
                <li><Link href="/gold-price" className="text-gray-400 transition-colors duration-200 hover:text-white">{goldPricesLabel}</Link></li>
                <li><Link href="/brands" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('common.brands') || 'Brands'}</Link></li>
                <li><Link href="/shop?filter=new" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.new_arrivals') || 'New Arrivals'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t('footer.company') || 'Company'}</h4>
              <ul className="space-y-3 text-sm">
                {settings?.pages?.aboutUs && <li><Link href="/about" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.about_us') || 'About Us'}</Link></li>}
                {settings?.pages?.careers && <li><Link href="/careers" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.careers') || 'Careers'}</Link></li>}
                {settings?.pages?.storeLocator && <li><Link href="/store-locator" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.store_locator') || 'Store Locator'}</Link></li>}
                {settings?.pages?.contactUs && <li><Link href="/contact" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.contact') || 'Contact'}</Link></li>}
                {settings?.features?.blog && <li><Link href="/blog" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('common.blog') || 'Blog'}</Link></li>}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t('footer.support') || 'Support'}</h4>
              <ul className="space-y-3 text-sm">
                {settings?.pages?.faqs && <li><Link href="/faq" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.faq') || 'FAQs'}</Link></li>}
                {settings?.pages?.shippingReturns && <li><Link href="/shipping-returns" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.shipping') || 'Shipping & Returns'}</Link></li>}
                {settings?.pages?.sizeGuide && <li><Link href="/size-guide" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.size_guide') || 'Size Guide'}</Link></li>}
                <li><Link href="/track-order" className="text-gray-400 transition-colors duration-200 hover:text-white">{t('footer.track_order') || 'Track Order'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t('footer.contact') || 'Contact'}</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                {settings?.company?.phone && <li><a href={`tel:${settings.company.phone}`} className="transition-colors duration-200 hover:text-white">{settings.company.phone}</a></li>}
                {settings?.company?.email && <li><a href={`mailto:${settings.company.email}`} className="break-all transition-colors duration-200 hover:text-white">{settings.company.email}</a></li>}
                {(settings?.company?.address || settings?.company?.city || settings?.company?.state) && (
                  <li className="leading-relaxed">
                    {settings.company.address && <>{settings.company.address}<br /></>}
                    {settings.company.city && `${settings.company.city}`}
                    {settings.company.city && settings.company.state && ', '}
                    {settings.company.state && `${settings.company.state}`}
                    {settings.company.zipCode && ` ${settings.company.zipCode}`}
                  </li>
                )}
              </ul>
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t('footer.follow_us') || 'Follow Us'}</h4>
              <div className="flex flex-wrap gap-3">
                {isValidUrl(socialLinks.facebook) && <a href={socialLinks.facebook.startsWith('http') ? socialLinks.facebook : `https://${socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-[#1877F2] hover:text-white" aria-label={t('footer.social_facebook') || 'Facebook'}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path></svg></a>}
                {isValidUrl(socialLinks.instagram) && <a href={socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://${socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] hover:text-white" aria-label={t('footer.social_instagram') || 'Instagram'}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path></svg></a>}
                {isValidUrl(socialLinks.twitter) && <a href={socialLinks.twitter.startsWith('http') ? socialLinks.twitter : `https://${socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-[#1DA1F2] hover:text-white" aria-label={t('footer.social_twitter') || 'Twitter'}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path></svg></a>}
                {isValidUrl(socialLinks.youtube) && <a href={socialLinks.youtube.startsWith('http') ? socialLinks.youtube : `https://${socialLinks.youtube}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400 transition-all duration-200 hover:bg-[#FF0000] hover:text-white" aria-label={t('footer.social_youtube') || 'YouTube'}><svg fill="currentColor" className="h-5 w-5" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path></svg></a>}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col items-center justify-between gap-6 text-sm md:flex-row">
            <p className="text-center text-gray-400 md:text-left">{settings?.site?.copyrightText || `© ${new Date().getFullYear()} ${settings?.company?.name || ''}. All rights reserved.`}</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400">
              {settings?.pages?.privacyPolicy && <Link href="/privacy" className="transition-colors duration-200 hover:text-white">{t('footer.privacy') || 'Privacy Policy'}</Link>}
              {settings?.pages?.termsOfService && <Link href="/terms" className="transition-colors duration-200 hover:text-white">{t('footer.terms') || 'Terms of Service'}</Link>}
            </div>
            {settings?.theme?.paymentMethods && settings.theme.paymentMethods.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
                <span className="text-xs text-gray-400">{t('footer.we_accept') || 'We accept:'}</span>
                <div className="flex items-center gap-2">
                  {settings.theme.paymentMethods.sort((a, b) => (a.order || 0) - (b.order || 0)).map((method) => (
                    <div key={method.id} className="flex h-[32px] min-w-[50px] items-center justify-center rounded-md border border-gray-100 bg-white px-3 py-2 shadow-sm" title={method.name}>
                      {method.imageUrl ? <Image src={method.imageUrl} alt={method.name} width={50} height={28} className="max-h-[28px] max-w-[50px] object-contain" /> : <span className="text-xs text-gray-500">{method.name}</span>}
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

export default HomeFooter;
