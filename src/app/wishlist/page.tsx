'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import Image from 'next/image';
import AccountMobileNav from '@/components/AccountMobileNav';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { getProductName } from '@/lib/utils/translations';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';

// Define a type for Wishlist Item
interface WishlistItem {
    id: string;
    name: string;
    price: number;
    image?: string;
    category?: string;
    inStock: boolean;
    slug?: string;
}

const WishlistPage = () => {
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { showError, showSuccess } = useToast();
  const languageCode = currentLanguage?.code || 'en';
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    
    const fetchData = async () => {
      try {
        // Fetch products first
        const allProducts = await getAllProducts();
        const productsMap = new Map<string, Product>();
        allProducts.forEach(product => {
          productsMap.set(product.id, product);
        });
        setProducts(productsMap);

        // Fetch from localStorage only on client side
        const stored = localStorage.getItem('wishlist');
        if (stored) {
          setWishlistItems(JSON.parse(stored));
        } else {
          setWishlistItems([]); 
        }
      } catch {
        // Failed to fetch wishlist data
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const removeFromWishlist = (id: string) => {
    const updated = wishlistItems.filter(item => item.id !== id);
    setWishlistItems(updated);
    if (mounted) {
      localStorage.setItem('wishlist', JSON.stringify(updated));
    }
  };

  const handleAddToCart = async (item: WishlistItem) => {
    const product = products.get(item.id);
    if (!product) {
      showError(t('wishlist.product_not_found') || 'Product not found.');
      return;
    }

    setAddingToCart(item.id);
    try {
      const pricing = getProductPricingSummary(
        product,
        settings?.goldPricing,
        settings?.goldPricing?.cache
      );
      addToCart({ ...product, price: pricing.currentPrice, salePrice: undefined }, 1);
      showSuccess(
        t('wishlist.add_to_cart_success', {
          product: getProductName(product, languageCode),
        }),
      );
    } catch {
      // Failed to add to cart
      showError(t('wishlist.add_to_cart_failed') || 'Failed to add to cart.');
    } finally {
      setAddingToCart(null);
    }
  };

  // Check if wishlist feature is enabled
  if (!settings?.features?.wishlist) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
              {t('wishlist.not_available_title')}
            </h1>
            <p className="text-gray-500">
              {t('wishlist.not_available_message')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-2 w-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-6 md:py-12 mb-6 md:mb-10">
        <div className="page-container">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-heading font-bold text-gray-900 mb-2 text-center md:text-left">
            {t('account.title')}
          </h1>
          <p className="text-sm md:text-base text-gray-500 text-center md:text-left">
            {t('wishlist.subtitle')}
          </p>
        </div>
      </div>

      <div className="page-container pb-12">
        <AccountMobileNav />
        <h2 className="text-2xl font-heading font-bold mb-6">
          {t('wishlist.title')}
        </h2>

            {wishlistItems.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-bold mb-2 text-gray-900">
                  {t('wishlist.empty_title')}
                </h3>
                <p className="text-gray-500 mb-8">
                  {t('wishlist.empty_message')}
                </p>
                <Link href="/shop" className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-black rounded-full hover:bg-gray-900 transition-colors">
                  {t('wishlist.empty_cta')}
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {wishlistItems.map((item) => {
                  const product = products.get(item.id);
                  const isOutOfStock = !item.inStock || (product && product.variants && product.variants.length > 0 && !product.variants.some(v => v.stock > 0));
                  const displayName = product ? getProductName(product, languageCode) : item.name;
                  const displayPrice = product
                    ? getProductPricingSummary(product, settings?.goldPricing, settings?.goldPricing?.cache).currentPrice
                    : item.price;
                  
                  return (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex gap-4 items-start">
                          <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                            {item.image ? (
                              <Image 
                                src={item.image} 
                                alt={displayName} 
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">
                                IMG
                              </div>
                            )}
                          </div>
                          <div className="flex-grow">
                            <div className="flex justify-between items-start">
                              <div>
                                <Link href={`/products/${item.slug || item.id}`}>
                                  <h3 className="font-medium text-sm text-gray-900 hover:text-gray-600 transition-colors">{displayName}</h3>
                                </Link>
                                {item.category && (
                                  <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
                                )}
                                {isOutOfStock && (
                                  <p className="text-xs text-red-600 mt-0.5 font-medium">
                                    {t('wishlist.out_of_stock')}
                                  </p>
                                )}
                              </div>
                              <p className="font-bold text-sm text-gray-900">{formatPrice(displayPrice)}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap justify-end gap-3">
                          <Link 
                            href={`/products/${item.slug || item.id}`} 
                            className="px-4 py-2 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            {t('wishlist.view_details')}
                          </Link>
                          <button
                            onClick={() => handleAddToCart(item)}
                            disabled={addingToCart === item.id || isOutOfStock}
                            className="px-4 py-2 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {addingToCart === item.id
                              ? t('wishlist.adding')
                              : t('wishlist.add_to_cart')}
                          </button>
                          <button
                            onClick={() => removeFromWishlist(item.id)}
                            className="px-4 py-2 text-sm text-red-600 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            {t('wishlist.remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
};

export default WishlistPage;
