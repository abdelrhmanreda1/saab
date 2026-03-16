'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

const AccountMobileNav = () => {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    { href: '/account/profile', label: t('account.nav_profile') || 'Profile' },
    { href: '/account/orders', label: t('account.nav_orders') || 'Orders' },
    { href: '/account/addresses', label: t('account.nav_addresses') || 'Addresses' },
    { href: '/account/returns', label: t('account.nav_returns') || 'Returns' },
    { href: '/account/refunds', label: t('account.nav_refunds') || 'Refunds' },
    { href: '/account/preferences', label: t('account.nav_preferences') || 'Preferences' },
    { href: '/wishlist', label: t('account.nav_wishlist') || 'Wishlist' },
  ];

  return (
    <div className="md:hidden mb-6">
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <nav className="flex gap-2 p-2" style={{ width: 'max-content' }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/wishlist' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default AccountMobileNav;

