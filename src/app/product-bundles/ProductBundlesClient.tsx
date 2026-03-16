'use client';

import React, { useState, useMemo } from 'react';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { useCurrency } from '../../context/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { useEffect } from 'react';

interface ProductBundlesClientProps {
  bundles: ProductBundle[];
}

const ProductBundlesClient: React.FC<ProductBundlesClientProps> = ({ bundles }) => {
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<string>('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const prods = await getAllProducts();
        setProducts(prods);
      } catch {
        // Failed to load products
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  // Sort bundles
  const sortedBundles = useMemo(() => {
    const sorted = [...bundles];
    
    switch (sortBy) {
      case 'price-asc':
        return sorted.sort((a, b) => {
          const priceA = getBundlePrice(a);
          const priceB = getBundlePrice(b);
          return priceA - priceB;
        });
      case 'price-desc':
        return sorted.sort((a, b) => {
          const priceA = getBundlePrice(a);
          const priceB = getBundlePrice(b);
          return priceB - priceA;
        });
      case 'name-asc':
        return sorted.sort((a, b) => {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
      case 'name-desc':
        return sorted.sort((a, b) => {
          return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
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
  }, [bundles, sortBy]);

  // Helper function to calculate bundle price
  const getBundlePrice = (bundle: ProductBundle): number => {
    if (bundle.bundlePrice) {
      return bundle.bundlePrice;
    }
    
    let totalPrice = 0;
    bundle.products.forEach(p => {
      const product = products.find(pr => pr.id === p.productId);
      if (product) {
        // Use base price only (ignore salePrice for bundle calculation)
        const itemPrice = product.price;
        const quantity = p.quantity || 1;
        
        if (p.discount) {
          totalPrice += itemPrice * quantity * (1 - p.discount / 100);
        } else {
          totalPrice += itemPrice * quantity;
        }
      }
    });
    
    // Apply bundle-level discount
    if (bundle.discountType === 'percentage' && bundle.discountValue) {
      totalPrice = totalPrice * (1 - bundle.discountValue / 100);
    } else if (bundle.discountType === 'fixed' && bundle.discountValue) {
      totalPrice = totalPrice - bundle.discountValue;
    }
    
    return totalPrice;
  };

  // Helper function to calculate original price
  const getOriginalPrice = (bundle: ProductBundle): number => {
    let totalPrice = 0;
    bundle.products.forEach(p => {
      const product = products.find(pr => pr.id === p.productId);
      if (product) {
        // Use base price only (ignore salePrice)
        const itemPrice = product.price;
        const quantity = p.quantity || 1;
        totalPrice += itemPrice * quantity;
      }
    });
    return totalPrice;
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container">
            <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
          </div>
        </div>
        <div className="page-container pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (bundles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="page-container py-20">
          <div className="text-center">
            <h1 className="text-4xl font-heading font-bold text-gray-900 mb-4">Product Bundles</h1>
            <p className="text-gray-600 text-lg">No product bundles available at the moment.</p>
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
      <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 border-b border-purple-100 py-12 mb-10">
        <div className="page-container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-block bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                Special Offers
              </div>
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
                Product Bundles
              </h1>
              <p className="text-gray-600 text-lg">
                Exclusive bundle deals - save more when you buy together!
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {sortedBundles.length} {sortedBundles.length === 1 ? 'Bundle' : 'Bundles'}
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

      {/* Bundles Grid */}
      <div className="page-container pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {sortedBundles.map((bundle) => {
            const bundlePrice = getBundlePrice(bundle);
            const originalPrice = getOriginalPrice(bundle);
            const hasDiscount = originalPrice > bundlePrice;

            return (
              <Link key={bundle.id} href={`/product-bundles/${bundle.id}`} className="group relative bg-white rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all shadow-sm hover:shadow-lg">
                {bundle.image ? (
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src={bundle.image}
                      alt={bundle.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="relative h-48 w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No Image</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded">
                  Bundle
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-heading font-bold text-gray-900 group-hover:text-gray-600 transition-colors flex-1">
                      {bundle.name}
                    </h3>
                  </div>
                  {bundle.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{bundle.description}</p>
                  )}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Includes {bundle.products.length} {bundle.products.length === 1 ? 'item' : 'items'}</p>
                    <div className="flex items-center gap-2">
                      {hasDiscount && (
                        <span className="text-sm text-gray-500 line-through">{formatPrice(originalPrice)}</span>
                      )}
                      <span className="text-xl font-heading font-bold text-gray-900">{formatPrice(bundlePrice)}</span>
                      {bundle.discountType === 'percentage' && bundle.discountValue && (
                        <span className="text-sm font-medium text-red-600">-{bundle.discountValue}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-sm font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                    View Bundle →
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

export default ProductBundlesClient;

