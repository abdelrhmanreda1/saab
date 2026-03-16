'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product, ProductVariant } from '@/lib/firestore/products';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getProductName, getColorName } from '@/lib/utils/translations';
import { getColors } from '@/lib/firestore/attributes_db';
import { Color } from '@/lib/firestore/attributes';
import { useSettings } from '@/context/SettingsContext';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';

interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({ product, isOpen, onClose }) => {
  const { addToCart, setShowCartDialog, setCartDialogMessage } = useCart();
  const { t, currentLanguage } = useLanguage();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const languageCode = currentLanguage?.code || 'en';
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [colors, setColors] = useState<Color[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isInWishlist, setIsInWishlist] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      getColors().then(setColors).catch(() => {
        // Failed to fetch colors
      });
      
      // Check wishlist
      const stored = localStorage.getItem('wishlist');
      if (stored) {
        const wishlistItems = JSON.parse(stored);
        setTimeout(() => {
          setIsInWishlist(wishlistItems.some((item: { id: string }) => item.id === product.id));
        }, 0);
      }
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (product && selectedColor && selectedSize) {
      const variant = product.variants.find(
        v => v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
      );
      if (variant) {
        const sizeVariant = product.variants.find(
          v => v.name.toLowerCase() === 'size' && 
          v.value.toLowerCase() === selectedSize.toLowerCase() &&
          v.id !== variant.id
        );
        if (sizeVariant) {
          setTimeout(() => {
            setSelectedVariant(sizeVariant);
          }, 0);
        }
      }
    } else if (product && selectedColor) {
      const variant = product.variants.find(
        v => v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
      );
      setTimeout(() => {
        setSelectedVariant(variant);
      }, 0);
    } else if (product && selectedSize) {
      const variant = product.variants.find(
        v => v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedSize.toLowerCase()
      );
      setTimeout(() => {
        setSelectedVariant(variant);
      }, 0);
    } else {
      setTimeout(() => {
        setSelectedVariant(undefined);
      }, 0);
    }
  }, [product, selectedColor, selectedSize]);

  if (!product || !isOpen) return null;

  const hasColorVariants = product.variants?.some(v => v.name.toLowerCase() === 'color');
  const hasSizeVariants = product.variants?.some(v => v.name.toLowerCase() === 'size');
  const colorVariants = product.variants?.filter(v => v.name.toLowerCase() === 'color') || [];
  const sizeVariants = product.variants?.filter(v => v.name.toLowerCase() === 'size') || [];

  const pricing = getProductPricingSummary(product, settings?.goldPricing, settings?.goldPricing?.cache);
  const displayPrice = selectedVariant
    ? pricing.currentPrice + (selectedVariant.extraPrice || 0)
    : pricing.currentPrice;
  const originalPrice = pricing.originalPrice !== null
    ? pricing.originalPrice + (selectedVariant?.extraPrice || 0)
    : null;

  const getStockStatus = () => {
    if (product.variants && product.variants.length > 0) {
      if (selectedVariant) {
        if (selectedVariant.stock > 10) return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'text-green-600' };
        if (selectedVariant.stock > 0) return { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', color: 'text-yellow-600' };
        return { status: 'out_of_stock', text: t('product.out_of_stock') || 'Out of Stock', color: 'text-red-600' };
      }
      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
      if (totalStock > 10) return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'text-green-600' };
      if (totalStock > 0) return { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', color: 'text-yellow-600' };
      return { status: 'out_of_stock', text: t('product.out_of_stock') || 'Out of Stock', color: 'text-red-600' };
    }
    return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'text-green-600' };
  };

  const stockInfo = getStockStatus();
  const isOutOfStock = stockInfo.status === 'out_of_stock';

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart({ ...product, price: displayPrice, salePrice: undefined }, quantity, selectedVariant);
    setCartDialogMessage(t('cart.added_to_cart') || 'Added to cart');
    setShowCartDialog(true);
    onClose();
  };

  const handleToggleWishlist = () => {
    const stored = localStorage.getItem('wishlist');
    let wishlistItems: Array<{ id: string; name: string; price: number; image?: string; inStock: boolean; slug?: string }> = stored ? JSON.parse(stored) : [];
    
    const productItem = {
      id: product.id,
      name: getProductName(product, languageCode),
      price: displayPrice,
      image: product.images?.[0],
      inStock: !isOutOfStock,
      slug: product.slug,
    };
    
    if (isInWishlist) {
      wishlistItems = wishlistItems.filter(item => item.id !== product.id);
      setIsInWishlist(false);
    } else {
      wishlistItems.push(productItem);
      setIsInWishlist(true);
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlistItems));
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'block' : 'hidden'}`}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Images */}
              <div className="relative">
                <div className="relative aspect-square w-full bg-gray-100 rounded-lg overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <Image
                      src={product.images[activeImageIndex] || product.images[0]}
                      alt={getProductName(product, languageCode)}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                {product.images && product.images.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                          activeImageIndex === idx ? 'border-gray-900' : 'border-gray-200'
                        }`}
                      >
                        <Image src={img} alt={`${idx + 1}`} width={64} height={64} className="object-cover" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="flex flex-col">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {getProductName(product, languageCode)}
                  </h2>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-sm font-medium ${stockInfo.color}`}>
                      {stockInfo.text}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      {originalPrice && (
                        <span className="text-lg text-gray-500 line-through">
                          {formatPrice(originalPrice)}
                        </span>
                      )}
                      <span className="text-2xl font-bold text-gray-900">
                        {formatPrice(displayPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Variants */}
                  {hasColorVariants && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('product.color') || 'Color'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {colorVariants.map((variant) => {
                          const color = colors.find(c => c.name.toLowerCase() === variant.value.toLowerCase());
                          return (
                            <button
                              key={variant.id}
                              onClick={() => setSelectedColor(variant.value)}
                              className={`w-10 h-10 rounded-full border-2 transition-all ${
                                selectedColor === variant.value
                                  ? 'border-gray-900 scale-110'
                                  : 'border-gray-300 hover:border-gray-500'
                              } ${variant.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                              style={{ backgroundColor: color?.hexCode || '#ccc' }}
                              disabled={variant.stock === 0}
                              title={color ? getColorName(color, languageCode) : variant.value}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hasSizeVariants && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('product.size') || 'Size'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {sizeVariants.map((variant) => (
                          <button
                            key={variant.id}
                            onClick={() => setSelectedSize(variant.value)}
                            className={`px-4 py-2 border-2 rounded transition-all ${
                              selectedSize === variant.value
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-300 hover:border-gray-500'
                            } ${variant.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={variant.stock === 0}
                          >
                            {variant.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('product.quantity') || 'Quantity'}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-10 h-10 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-medium">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-10 h-10 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className="flex-1 bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('product.add_to_cart') || 'Add to Cart'}
                  </button>
                  <button
                    onClick={handleToggleWishlist}
                    className={`p-3 border-2 rounded-lg transition-colors ${
                      isInWishlist
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill={isInWishlist ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                  </button>
                </div>

                <Link
                  href={`/products/${product.slug}`}
                  className="mt-3 text-center text-sm font-medium text-gray-900 border-b border-gray-900 pb-1 hover:opacity-70 transition-opacity"
                >
                  {t('product.view_full_details') || 'View Full Details'} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;

