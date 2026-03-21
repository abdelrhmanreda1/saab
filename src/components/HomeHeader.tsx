'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import TopBar from './TopBar';
import { getSafeImageUrl } from '@/lib/utils/image';

export default function HomeHeader() {
  const { settings } = useSettings();
  const { currentLanguage, t } = useLanguage();
  const isRTL = currentLanguage?.isRTL || false;
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();

  const headerBg = settings?.theme?.colors?.headerBackground || '#fffdf9';
  const headerText = settings?.theme?.colors?.headerText || '#17120b';
  const safeLogoUrl = getSafeImageUrl(settings?.theme?.logoUrl);
  const goldPricesLabel = t('nav.gold_prices') || 'Gold Prices';

  const navLinks = useMemo(
    () =>
      [
        { name: t('nav.home'), key: 'home', path: '/' },
        { name: t('nav.shop'), key: 'shop', path: '/shop' },
        { name: goldPricesLabel, key: 'gold-prices', path: '/gold-price' },
        { name: t('nav.categories'), key: 'categories', path: '/categories' },
        { name: t('nav.blog') || 'Blog', key: 'blog', path: '/blog', show: settings?.features?.blog },
        { name: t('nav.about'), key: 'about', path: '/about', show: settings?.pages?.aboutUs },
        { name: t('nav.contact'), key: 'contact', path: '/contact', show: settings?.pages?.contactUs },
      ].filter((link) => link.show !== false),
    [goldPricesLabel, settings?.features?.blog, settings?.pages?.aboutUs, settings?.pages?.contactUs, t]
  );

  const leftNavLinks = navLinks.slice(0, 3);
  const rightNavLinks = navLinks.slice(3);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="sticky top-0 z-50">
      <TopBar />
      <header
        style={{
          backgroundColor: isScrolled ? `${headerBg}F2` : headerBg,
          color: headerText,
        }}
        className={`transition-all duration-300 border-b border-[#ecd6a4] ${
          isScrolled ? 'backdrop-blur-md shadow-[0_12px_40px_rgba(86,58,11,0.08)]' : ''
        }`}
      >
        <div className="page-container">
          <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-3 md:hidden">
            <button
              className="p-2 text-[#4c3b17] hover:text-[#b8872f] focus:outline-none"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? (t('header.close_menu') || 'Close navigation menu') : (t('header.open_menu') || 'Open navigation menu')}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>

            <div className="flex justify-center">
              <Link href="/" className="flex items-center justify-center">
                {safeLogoUrl ? (
                  <Image
                    src={safeLogoUrl}
                    alt={settings.company.name || ''}
                    width={152}
                    height={54}
                    sizes="152px"
                    priority
                    className="h-12 w-[152px] object-contain"
                  />
                ) : (
                  <span
                    style={{ color: headerText }}
                    className="inline-flex h-12 w-[152px] items-center justify-center text-2xl font-heading font-bold tracking-[0.18em]"
                  >
                    {settings.company.name || ''}
                  </span>
                )}
              </Link>
            </div>

            <div className="flex items-center justify-end gap-2">
              {settings?.site?.enableLanguageSwitcher && (
                <div className="rounded-full border border-[#ead6a7] bg-[#fffaf0] px-1 py-0.5">
                  <LanguageSwitcher variant="minimal" />
                </div>
              )}
              <Link href="/login" style={{ color: headerText }} className="hover:text-[#b8872f] transition-colors" aria-label={t('common.account') || 'Account'}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </Link>
              <Link href="/cart" style={{ color: headerText }} className="hover:text-[#b8872f] transition-colors" aria-label={t('common.cart') || 'Cart'}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 5c.07.277-.15.456-.52.456H4.15c-.37 0-.59-.179-.52-.456l1.263-5a.75.75 0 0 1 .726-.569h12.862a.75.75 0 0 1 .726.569Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="hidden min-h-[104px] md:grid md:grid-cols-[minmax(280px,1fr)_180px_minmax(500px,1.2fr)] md:items-center md:gap-4 md:py-4 lg:grid-cols-[minmax(320px,1fr)_200px_minmax(580px,1.2fr)]">
            <nav className={`flex min-w-0 items-center gap-4 ${isRTL ? 'justify-end' : 'justify-start'} lg:gap-5`}>
              {leftNavLinks.map((link) => (
                <Link
                  key={link.key}
                  href={link.path}
                  style={{ color: headerText }}
                  className="shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-[#b8872f] lg:text-[13px] lg:tracking-[0.18em]"
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="flex min-h-[72px] flex-col items-center justify-center px-2 lg:px-4">
              <Link href="/" className="flex items-center justify-center">
                {safeLogoUrl ? (
                  <Image
                    src={safeLogoUrl}
                    alt={settings.company.name || ''}
                    width={190}
                    height={70}
                    sizes="190px"
                    priority
                    className="h-12 w-[190px] object-contain lg:h-14"
                  />
                ) : (
                  <span style={{ color: headerText }} className="inline-flex h-12 w-[190px] items-center justify-center text-center text-2xl font-heading font-bold tracking-[0.18em] lg:h-14">
                    {settings.company.name || ''}
                  </span>
                )}
              </Link>
              <span className="mt-1 h-px w-16 bg-[#caa14d]" />
            </div>

            <div className={`flex min-w-0 items-center ${isRTL ? 'justify-start' : 'justify-end'} gap-2.5 lg:gap-3`}>
              <nav className={`flex min-w-0 items-center gap-3 ${isRTL ? 'order-2' : 'order-1'} lg:gap-4`}>
                {rightNavLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.path}
                    style={{ color: headerText }}
                    className="shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#b8872f] lg:text-[13px] lg:tracking-[0.16em]"
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              <div className={`flex shrink-0 items-center gap-2 ${isRTL ? 'order-1' : 'order-2'}`}>
                {settings?.site?.enableLanguageSwitcher && (
                  <div className="rounded-full border border-[#ead6a7] bg-[#fffaf0] px-1 py-0.5">
                    <LanguageSwitcher variant="minimal" />
                  </div>
                )}

                <form onSubmit={handleSearch} className="relative min-h-11">
                  <input
                    type="text"
                    placeholder={t('common.search')}
                    className={`h-11 w-36 rounded-full border border-[#ecd9ae] bg-[#fffaf0] px-4 text-sm text-[#2b2110] outline-none transition focus:w-40 focus:border-[#be8c2f] lg:w-40 lg:focus:w-44 ${isRTL ? 'pl-12 pr-4' : 'pr-12 pl-4'}`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label={t('common.search') || 'Search'}
                  />
                  <button
                    type="submit"
                    style={{ color: headerText }}
                    className={`absolute ${isRTL ? 'left-1.5' : 'right-1.5'} top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:text-[#b8872f]`}
                    aria-label={t('common.search') || 'Search'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </button>
                </form>

                <Link href="/login" style={{ color: headerText }} className="transition-colors hover:text-[#b8872f]" aria-label={t('common.account') || 'Account'}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </Link>

                <Link href="/cart" style={{ color: headerText }} className="transition-colors hover:text-[#b8872f]" aria-label={t('common.cart') || 'Cart'}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 5c.07.277-.15.456-.52.456H4.15c-.37 0-.59-.179-.52-.456l1.263-5a.75.75 0 0 1 .726-.569h12.862a.75.75 0 0 1 .726.569Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
            <div id="mobile-menu" className="md:hidden fixed inset-x-0 top-0 z-50 h-[100dvh] bg-[#fffdf8] shadow-[0_24px_60px_rgba(86,58,11,0.12)]" style={{ paddingTop: '4rem' }}>
              <div className="absolute left-0 right-0 top-0 h-16 border-b border-[#ecd6a4] bg-[#fffdf8]">
                <div className="page-container flex h-16 items-center justify-between">
                  <span className="text-sm font-semibold text-[#3a2a0d]">
                    {t('header.menu') || (isRTL ? 'القائمة' : 'Menu')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ead6a7] bg-[#fffaf0] text-[#4c3b17] hover:text-[#b8872f]"
                    aria-label={t('header.close_menu') || 'Close navigation menu'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
                <div className="space-y-4">
                  <form onSubmit={handleSearch} className="relative">
                    <input
                      type="text"
                      placeholder={t('common.search')}
                      className="w-full rounded-2xl border border-[#ecd6a4] bg-white px-4 py-3 text-black focus:border-[#be8c2f] focus:outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </form>
                  <nav className="flex flex-col space-y-2">
                    {navLinks.map((link) => (
                      <Link
                        key={link.key}
                        href={link.path}
                        className="rounded-2xl border border-[#f2e4c1] bg-white px-4 py-3 font-medium text-[#3a2a0d] transition hover:border-[#be8c2f] hover:text-[#be8c2f]"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </header>
    </div>
  );
}
