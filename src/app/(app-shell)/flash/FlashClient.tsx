'use client';

import React, { useState, useMemo } from 'react';
import { Product } from '@/lib/firestore/products';
import { FlashSale } from '@/lib/firestore/campaigns';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import Image from 'next/image';
import { getCategoryName, getProductName } from '@/lib/utils/translations';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { Category } from '@/lib/firestore/categories';
import { useEffect } from 'react';

interface FlashClientProps {
  products: Product[];
  flashSales: FlashSale[];
}

const FlashClient: React.FC<FlashClientProps> = ({ products, flashSales }) => {
  const { currentLanguage } = useLanguage();
  const languageCode = currentLanguage?.code || 'en';
  const { formatPrice } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sortBy, setSortBy] = useState<string>('default');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getAllCategories();
        setCategories(cats);
      } catch {
        // Failed to load categories
      }
    };
    loadCategories();
  }, []);

  // Sort products
  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    
    switch (sortBy) {
      case 'price-asc':
        return sorted.sort((a, b) => {
          const priceA = getProductPrice(a);
          const priceB = getProductPrice(b);
          return priceA - priceB;
        });
      case 'price-desc':
        return sorted.sort((a, b) => {
          const priceA = getProductPrice(a);
          const priceB = getProductPrice(b);
          return priceB - priceA;
        });
      case 'name-asc':
        return sorted.sort((a, b) => {
          const nameA = getProductName(a, languageCode).toLowerCase();
          const nameB = getProductName(b, languageCode).toLowerCase();
          return nameA.localeCompare(nameB);
        });
      case 'name-desc':
        return sorted.sort((a, b) => {
          const nameA = getProductName(a, languageCode).toLowerCase();
          const nameB = getProductName(b, languageCode).toLowerCase();
          return nameB.localeCompare(nameA);
        });
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt
            ? a.createdAt.seconds * 1000
            : 0;
          const dateB = b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt
            ? b.createdAt.seconds * 1000
            : 0;
          return dateB - dateA;
        });
      default:
        return sorted;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sortBy, languageCode]);

  // Helper function to get product price with flash sale discount
  const getProductPrice = (product: Product): number => {
    const productSale = flashSales.find(sale => sale.productIds.includes(product.id));
    let finalPrice = product.salePrice ?? product.price;

    if (productSale) {
      if (productSale.discountType === 'percentage') {
        finalPrice = Math.max(finalPrice * (1 - productSale.discountValue / 100), 0);
      } else if (productSale.discountType === 'fixed') {
        finalPrice = Math.max(finalPrice - productSale.discountValue, 0);
      }
    }

    return finalPrice;
  };

  // Get active flash sale info
  const activeFlashSale = flashSales.length > 0 ? flashSales[0] : null;

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="page-container py-20">
          <div className="text-center">
            <h1 className="text-4xl font-heading font-bold text-gray-900 mb-4">Flash Sale</h1>
            <p className="text-gray-600 text-lg">No flash sale products available at the moment.</p>
            <Link 
              href="/shop" 
              className="inline-block mt-6 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border-b border-red-100 py-12 mb-10">
        <div className="page-container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-block bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                Flash Sale
              </div>
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
                {activeFlashSale?.name || 'Flash Sale'}
              </h1>
              <p className="text-gray-600 text-lg">
                {activeFlashSale?.description || 'Limited time offers - grab them before they\'re gone!'}
              </p>
              {activeFlashSale?.endTime && (
                <p className="text-red-600 font-medium mt-3 text-sm">
                  Ends: {activeFlashSale.endTime && typeof activeFlashSale.endTime === 'object' && 'seconds' in activeFlashSale.endTime
                    ? new Date(activeFlashSale.endTime.seconds * 1000).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })
                    : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {sortedProducts.length} {sortedProducts.length === 1 ? 'Product' : 'Products'}
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white text-sm"
              >
                <option value="default">Default</option>
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="page-container pb-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {sortedProducts.map((product) => {
            const matchedCategory = categories.find((c) => c.id === product.category);
            const categoryName = matchedCategory ? getCategoryName(matchedCategory, languageCode) : undefined;
            const productSale = flashSales.find((sale) => sale.productIds.includes(product.id));

            // For flash sale page: use base price only (ignore salePrice)
            let finalPrice = product.price;
            const originalPrice: number | null = product.price;

            if (productSale) {
              if (productSale.discountType === 'percentage') {
                finalPrice = Math.max(finalPrice * (1 - productSale.discountValue / 100), 0);
              } else if (productSale.discountType === 'fixed') {
                finalPrice = Math.max(finalPrice - productSale.discountValue, 0);
              }
            }

            const hasDiscount = originalPrice !== null && finalPrice < originalPrice;

            return (
              <Link key={product.id} href={`/flash/products/${product.slug || product.id}`} className="group block">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 rounded-2xl mb-3 border border-gray-200">
                  {product.images && product.images.length > 0 ? (
                    <Image
                      src={product.images[0]}
                      alt={getProductName(product, languageCode)}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <span className="text-xs uppercase tracking-widest">No Image</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded">
                    Flash Sale
                  </div>
                  {hasDiscount && (
                    <div className="absolute top-2 right-2 bg-black text-white text-xs font-bold px-2 py-1 rounded">
                      {productSale?.discountType === 'percentage' 
                        ? `${productSale.discountValue}% OFF`
                        : `${formatPrice(productSale?.discountValue || 0)} OFF`}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {getProductName(product, languageCode)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{categoryName || 'Collection'}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    {hasDiscount ? (
                      <>
                        <span className="text-base font-bold text-black">{formatPrice(finalPrice)}</span>
                        <span className="text-sm text-gray-500 line-through">{formatPrice(originalPrice!)}</span>
                      </>
                    ) : (
                      <span className="text-base font-bold text-black">{formatPrice(finalPrice)}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FlashClient;

