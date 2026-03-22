'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';

export default function MobileStickyCart() {
  const { cart, getCartTotal, setShowCartDialog } = useCart();
  const { formatPrice } = useCurrency();
  const { currentLanguage, t } = useLanguage();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const isArabic = String(currentLanguage?.code || '').trim().toLowerCase() === 'ar';

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = getCartTotal();
  const shouldHideOnPage = pathname === '/cart' || pathname === '/checkout';

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show sticky cart when scrolling down and cart has items
      if (cartItemCount > 0 && !shouldHideOnPage) {
        if (currentScrollY > 200 && currentScrollY > lastScrollY) {
          setIsVisible(true);
        } else if (currentScrollY < lastScrollY || currentScrollY < 100) {
          setIsVisible(false);
        }
      } else {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [cartItemCount, lastScrollY, shouldHideOnPage]);

  if (!isVisible || cartItemCount === 0 || shouldHideOnPage) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 md:hidden animate-slide-up">
      <div className="mx-4 mb-2">
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-900">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.4 2.925-6.75a6.324 6.324 0 00-1.666-2.153 11.96 11.96 0 00-2.649-1.35 11.96 11.96 0 00-3.75-1.001 11.96 11.96 0 00-3.75 1.001 11.96 11.96 0 00-2.649 1.35 6.324 6.324 0 00-1.666 2.153c-.825 2.35-1.804 4.45-2.925 6.75H3.75m0 0a3 3 0 00-3 3v1.5A2.25 2.25 0 003.75 21h16.5A2.25 2.25 0 0021 18.75v-1.5a3 3 0 00-3-3H3.75z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">
                {cartItemCount} {cartItemCount === 1 ? (t('cart.item') || (isArabic ? 'منتج' : 'item')) : (t('cart.items') || (isArabic ? 'منتجات' : 'items'))}
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">
                {formatPrice(cartTotal)}
              </p>
            </div>
          </div>
          <Link
            href="/cart"
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide flex-shrink-0 active:bg-gray-800 touch-manipulation"
            onClick={() => setShowCartDialog(false)}
          >
            {t('cart.view_cart') || 'View Cart'}
          </Link>
        </div>
      </div>
    </div>
  );
}

