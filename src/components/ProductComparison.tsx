'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSettings } from '../context/SettingsContext';
import { Product } from '@/lib/firestore/products';
import { getProductName } from '@/lib/utils/translations';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';

interface ProductComparisonProps {
  products: Product[];
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export default function ProductComparison({ products, onRemove, onClear }: ProductComparisonProps) {
  const { t, currentLanguage } = useLanguage();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const languageCode = currentLanguage?.code || 'en';

  if (products.length === 0) return null;

  const getStockStatus = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
      if (totalStock > 10) return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'text-green-600' };
      if (totalStock > 0) return { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', color: 'text-yellow-600' };
      return { status: 'out_of_stock', text: t('product.out_of_stock') || 'Out of Stock', color: 'text-red-600' };
    }
    return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'text-green-600' };
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-200 shadow-2xl md:bottom-auto md:top-20 md:border-t-0 md:border-b-2">
      <div className="page-container py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {t('product.comparing') || 'Comparing Products'} ({products.length})
          </h3>
          <div className="flex gap-2">
            <Link
              href={`/compare?ids=${products.map(p => p.id).join(',')}`}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 active:scale-95 transition-all touch-manipulation text-sm"
            >
              {t('product.view_comparison') || 'View Comparison'}
            </Link>
            <button
              onClick={onClear}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 active:scale-95 transition-all touch-manipulation text-sm"
            >
              {t('product.clear_all') || 'Clear All'}
            </button>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {products.map((product) => {
            const stockInfo = getStockStatus(product);
            const pricing = getProductPricingSummary(
              product,
              settings?.goldPricing,
              settings?.goldPricing?.cache
            );
            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-32 md:w-40 bg-gray-50 rounded-lg p-3 border border-gray-200 relative"
              >
                <button
                  onClick={() => onRemove(product.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 active:scale-95 transition-all touch-manipulation"
                  aria-label={t('product.remove') || 'Remove'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <Link href={`/products/${product.slug}`} className="block">
                  <div className="relative aspect-square w-full mb-2 bg-white rounded overflow-hidden">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={getProductName(product, languageCode) || 'Product'}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h4 className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">
                    {getProductName(product, languageCode)}
                  </h4>
                  <p className={`text-xs font-semibold ${stockInfo.color} mb-1`}>
                    {stockInfo.text}
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {formatPrice(pricing.currentPrice)}
                  </p>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

