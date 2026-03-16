'use client';

import React, { useState, useEffect } from 'react';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { useCurrency } from '../../../context/CurrencyContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import Image from 'next/image';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product, ProductVariant } from '@/lib/firestore/products';
import { getProductName, getColorName, getSizeName } from '@/lib/utils/translations';
import { getColors, getSizes } from '@/lib/firestore/attributes_db';
import { Color, Size } from '@/lib/firestore/attributes';
import ImageLightbox from '@/components/ImageLightbox';
import ReviewForm from '@/components/ReviewForm';
import ReviewList from '@/components/ReviewList';
import { getReviewsByProductId } from '@/lib/firestore/reviews';

interface BundleClientProps {
  bundle: ProductBundle | null;
}

const BundleClient: React.FC<BundleClientProps> = ({ bundle }) => {
  const { formatPrice } = useCurrency();
  const { addToCart, setShowCartDialog, setCartDialogMessage } = useCart();
  const { currentLanguage, t } = useLanguage();
  const { settings: contextSettings } = useSettings();
  const { showError } = useToast();
  const languageCode = currentLanguage?.code || 'en';
  const [products, setProducts] = useState<Product[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'shipping'>('description');
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  // Track selected variants for each product in bundle: { productId: { color?: string, size?: string, variant?: ProductVariant } }
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { color?: string; size?: string; variant?: ProductVariant }>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [prods, fetchedColors, fetchedSizes, reviewsData] = await Promise.all([
          getAllProducts(),
          getColors(),
          getSizes(),
          bundle?.id ? getReviewsByProductId(bundle.id).catch(() => []) : Promise.resolve([])
        ]);
        setProducts(prods);
        setColors(fetchedColors);
        setSizes(fetchedSizes);
        
        // Calculate average rating
        if (reviewsData && reviewsData.length > 0) {
          const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
          const avg = totalRating / reviewsData.length;
          setAverageRating(avg);
          setReviewCount(reviewsData.length);
        } else {
          setAverageRating(0);
          setReviewCount(0);
        }
      } catch {
        // Failed to load data
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [bundle, reviewsRefreshKey]);

  const refreshReviews = () => {
    setReviewsRefreshKey(prev => prev + 1);
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Skeleton */}
            <div className="space-y-4">
              <div className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>

            {/* Content Skeleton */}
            <div className="space-y-6">
              <div className="h-8 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
              </div>
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">Bundle Not Found</h1>
          <Link href="/product-bundles" className="inline-block mt-4 bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
            Back to Bundles
          </Link>
        </div>
      </div>
    );
  }

  // Calculate bundle price
  const calculateBundlePrice = (): number => {
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

  // Calculate original price
  const calculateOriginalPrice = (): number => {
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

  const bundlePrice = calculateBundlePrice();
  const originalPrice = calculateOriginalPrice();
  const hasDiscount = originalPrice > bundlePrice;

  const handleAddToCart = () => {
    // Check if all products with variants have selected variants
    let allVariantsSelected = true;
    bundle.products.forEach(bundleProduct => {
      const product = products.find(p => p.id === bundleProduct.productId);
      if (product && product.variants && product.variants.length > 0) {
        const hasColorVariants = product.variants.some(v => v.name.toLowerCase() === 'color');
        const hasSizeVariants = product.variants.some(v => v.name.toLowerCase() === 'size');
        const selectedVariantData = selectedVariants[bundleProduct.productId];
        
        if (hasColorVariants && hasSizeVariants) {
          if (!selectedVariantData?.color || !selectedVariantData?.size) {
            allVariantsSelected = false;
          }
        } else if (product.variants.length > 0 && !selectedVariantData?.variant && !selectedVariantData?.color && !selectedVariantData?.size) {
          allVariantsSelected = false;
        }
      }
    });
    
    if (!allVariantsSelected) {
      showError('Please select color and size for all products in the bundle.');
      return;
    }
    
    // Calculate total items in bundle
    const totalItemsInBundle = bundle.products.reduce((sum, p) => sum + (p.quantity || 1), 0);
    
    // Calculate bundle price per unit
    const bundlePricePerUnit = bundlePrice / totalItemsInBundle;
    
    // Add each product in the bundle to cart with bundle pricing
    bundle.products.forEach(bundleProduct => {
      const product = products.find(p => p.id === bundleProduct.productId);
      if (product) {
        const quantity = bundleProduct.quantity || 1;
        const originalItemPrice = product.price;
        // Calculate price per unit for this item in bundle
        const bundleItemPricePerUnit = bundlePricePerUnit;
        
        // Get selected variant for this product
        const selectedVariantData = selectedVariants[bundleProduct.productId];
        let variantToAdd: ProductVariant | undefined = undefined;
        
        if (selectedVariantData) {
          if (selectedVariantData.variant) {
            variantToAdd = selectedVariantData.variant;
          } else if (selectedVariantData.color && selectedVariantData.size) {
            // Create combined variant for color + size
            const colorVariant = product.variants?.find(v => 
              v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedVariantData.color?.toLowerCase()
            );
            const sizeVariant = product.variants?.find(v => 
              v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedVariantData.size?.toLowerCase()
            );
            if (sizeVariant) {
              const colorExtraPrice = (colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0);
              const sizeExtraPrice = (sizeVariant.extraPrice ?? sizeVariant.priceAdjustment ?? 0);
              const combinedExtraPrice = colorExtraPrice + sizeExtraPrice;
              
              variantToAdd = {
                ...sizeVariant,
                id: `${sizeVariant.id}-${selectedVariantData.color}`,
                value: `${selectedVariantData.color} - ${selectedVariantData.size}`,
                extraPrice: combinedExtraPrice,
                priceAdjustment: undefined,
              };
            }
          } else if (selectedVariantData.color) {
            variantToAdd = product.variants?.find(v => 
              v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedVariantData.color?.toLowerCase()
            );
          } else if (selectedVariantData.size) {
            variantToAdd = product.variants?.find(v => 
              v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedVariantData.size?.toLowerCase()
            );
          }
        }
        
        // Add product with bundle pricing (price per unit)
        for (let i = 0; i < quantity; i++) {
          // Create a modified product object with bundle price per unit
          const bundleProductWithPrice = {
            ...product,
            price: bundleItemPricePerUnit, // Price per unit in bundle
          };
          addToCart(bundleProductWithPrice, 1, variantToAdd, bundle.id, quantity, originalItemPrice);
        }
      }
    });
    setCartDialogMessage(`${bundle.name} ${t('cart.added_to_cart') || 'added to cart!'}`);
    setShowCartDialog(true);
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-sans">
      <div className="page-container py-8 pb-24 md:pb-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
            {/* Left: Image Gallery */}
            <div className="p-4 md:p-6 bg-gray-50/50 flex flex-col items-center justify-start relative">
              {/* Bundle Badge */}
              <div className="absolute top-6 left-6 z-20">
                <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide shadow-lg">
                  {t('bundle.badge') || 'Bundle'}
                </span>
              </div>
              
              <div 
                className="relative h-[350px] md:h-[400px] w-full max-w-md rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 mb-3 cursor-pointer group"
                onClick={() => {
                  if (bundle.image) {
                    setIsLightboxOpen(true);
                  }
                }}
              >
                {bundle.image ? (
                  <>
                    <div className="relative w-full h-full overflow-hidden">
                      <Image
                        src={bundle.image}
                        alt={bundle.name}
                        fill
                        className="object-contain p-4 transition-transform duration-500 ease-out md:group-hover:scale-150"
                        priority
                        unoptimized
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-full text-xs font-medium">
                        {t('product.click_to_view') || 'Click to view fullscreen'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                    No Image
                  </div>
                )}
              </div>
            </div>

            {/* Right: Bundle Details - Sticky */}
            <div className="p-4 md:p-6 lg:p-8 flex flex-col justify-start lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              {/* Bundle Name */}
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 mb-3">{bundle.name}</h1>

              {/* Rating */}
              {contextSettings?.features?.productReviews && (
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {averageRating > 0 && (
                    <span className="text-sm text-gray-600">
                      {averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                    </span>
                  )}
                  {averageRating === 0 && reviewCount === 0 && (
                    <span className="text-sm text-gray-400">No reviews yet</span>
                  )}
                </div>
              )}

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  {hasDiscount ? (
                    <>
                      <span className="text-2xl font-bold text-black">{formatPrice(bundlePrice)}</span>
                      <span className="text-lg text-gray-500 line-through">{formatPrice(originalPrice)}</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-black">{formatPrice(bundlePrice)}</span>
                  )}
                </div>
                {bundle.discountType === 'percentage' && bundle.discountValue && (
                  <p className="text-red-600 font-medium text-sm">Save {bundle.discountValue}%</p>
                )}
              </div>

              {/* Bundle Products */}
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('bundle.includes') || 'Bundle Includes:'}</h2>
                <div className="space-y-4">
                  {bundle.products.map((bundleProduct, index) => {
                    const product = products.find(p => p.id === bundleProduct.productId);
                    if (!product) return null;

                    const productPrice = product.price;
                    const itemTotal = productPrice * (bundleProduct.quantity || 1);
                    const selectedVariantData = selectedVariants[bundleProduct.productId];
                    
                    const productColors = product.variants?.filter(v => v.name.toLowerCase() === 'color') || [];
                    const productSizes = product.variants?.filter(v => v.name.toLowerCase() === 'size') || [];
                    const selectedColor = selectedVariantData?.color;
                    const selectedSize = selectedVariantData?.size;
                    
                    return (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg bg-white">
                        <div className="flex items-start gap-4 mb-3">
                          <Link href={`/products/${product.slug || product.id}`} className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            {product.images && product.images.length > 0 ? (
                              <Image
                                src={product.images[0]}
                                alt={getProductName(product, languageCode)}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-gray-300 text-xs">No Image</div>
                            )}
                          </Link>
                          <div className="flex-1">
                            <Link href={`/products/${product.slug || product.id}`} className="font-medium text-gray-900 hover:text-gray-600 block mb-1">
                              {getProductName(product, languageCode)}
                            </Link>
                            <p className="text-xs text-gray-500">
                              {t('bundle.quantity_price') || 'Quantity'}: {bundleProduct.quantity || 1} × {formatPrice(productPrice)} = {formatPrice(itemTotal)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Variant Selection - Same style as product page */}
                        {(productColors.length > 0 || productSizes.length > 0) && (
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            {/* Color Selection */}
                            {productColors.length > 0 && (
                              <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">{t('product.color') || 'Color'}</h3>
                                <div className="flex gap-2 flex-wrap">
                                  {Array.from(new Set(productColors.map(v => v.value))).map(colorValue => {
                                    const isSelected = selectedColor === colorValue;
                                    const colorVariants = productColors.filter(v => v.value === colorValue);
                                    const hasStock = colorVariants.some(v => v.stock > 0);
                                    const colorObj = colors.find(c => c.name.toLowerCase() === colorValue.toLowerCase());
                                    
                                    return (
                                      <button
                                        key={colorValue}
                                        onClick={() => {
                                          const variant = productColors.find(v => v.value === colorValue);
                                          setSelectedVariants(prev => ({
                                            ...prev,
                                            [bundleProduct.productId]: {
                                              ...prev[bundleProduct.productId],
                                              color: colorValue,
                                              variant: variant
                                            }
                                          }));
                                        }}
                                        disabled={!hasStock}
                                        className={`
                                          w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-200
                                          ${isSelected ? 'border-black ring-1 ring-black ring-offset-1' : 'border-gray-200 hover:border-gray-400'}
                                          ${!hasStock ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                                        `}
                                        title={`${colorObj ? getColorName(colorObj, languageCode) : colorValue} ${!hasStock ? '(Out of Stock)' : ''}`}
                                      >
                                        {colorObj ? (
                                          <span className="w-full h-full rounded-full block border border-black/5" style={{ backgroundColor: colorObj.hexCode }} />
                                        ) : (
                                          <span className="text-[8px] font-bold">{colorValue}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Size Selection */}
                            {productSizes.length > 0 && (
                              <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">{t('product.size') || 'Size'}</h3>
                                <div className="flex gap-2 flex-wrap">
                                  {Array.from(new Set(productSizes.map(v => v.value))).map(sizeValue => {
                                    const isSelected = selectedSize === sizeValue;
                                    const sizeVariants = productSizes.filter(v => v.value === sizeValue);
                                    const hasStock = sizeVariants.some(v => v.stock > 0);
                                    const sizeObj = sizes.find(s => s.name === sizeValue);
                                    
                                    return (
                                      <button
                                        key={sizeValue}
                                        onClick={() => {
                                          const variant = productSizes.find(v => v.value === sizeValue);
                                          setSelectedVariants(prev => ({
                                            ...prev,
                                            [bundleProduct.productId]: {
                                              ...prev[bundleProduct.productId],
                                              size: sizeValue,
                                              variant: variant
                                            }
                                          }));
                                        }}
                                        disabled={!hasStock}
                                        className={`
                                          px-3 py-1.5 rounded-lg border font-medium text-xs transition-all duration-200
                                          ${isSelected ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-black'}
                                          ${!hasStock ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                                        `}
                                        title={`${sizeObj ? getSizeName(sizeObj, languageCode) : sizeValue} ${!hasStock ? '(Out of Stock)' : ''}`}
                                      >
                                        {sizeObj ? sizeObj.code : sizeValue}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Single Variant Selection */}
                        {product.variants && product.variants.length > 0 && productColors.length === 0 && productSizes.length === 0 && (
                          <div className="mb-3">
                            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">{t('product.select_variant') || 'Select Variant'}</label>
                            <select
                              onChange={(e) => {
                                const variant = product.variants?.find(v => v.id === e.target.value);
                                if (variant) {
                                  setSelectedVariants(prev => ({
                                    ...prev,
                                    [bundleProduct.productId]: { variant }
                                  }));
                                }
                              }}
                              value={selectedVariantData?.variant?.id || ''}
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            >
                              <option value="">Select variant...</option>
                              {product.variants.map(variant => (
                                <option key={variant.id} value={variant.id}>
                                  {variant.name}: {variant.value} {variant.stock > 0 ? '' : '(Out of Stock)'}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add to Cart Button - Desktop */}
              <div className="hidden md:block mb-4">
                <button
                  onClick={handleAddToCart}
                  style={{
                    backgroundColor: contextSettings?.theme?.colors?.primaryButton || '#000000',
                    color: contextSettings?.theme?.colors?.primaryButtonText || '#ffffff',
                  }}
                  className="w-full px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 shadow-lg shadow-black/20"
                >
                  {t('bundle.add_to_cart') || 'Add Bundle to Cart'}
                </button>
              </div>

              {/* Shipping Info */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-17.25 4.5c0 .621.504 1.125 1.125 1.125h14.25c.621 0 1.125-.504 1.125-1.125V14.25m-17.25 4.5v-4.875c0-.621.504-1.125 1.125-1.125h11.25c.621 0 1.125.504 1.125 1.125v4.875m0 0v-4.5m0 4.5h3.375v-4.5m0 4.5h-9.75" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-1">{t('product.shipping_info') || 'Shipping Information'}</p>
                    <p className="text-xs text-gray-600 mb-2">{t('product.estimated_delivery') || 'Estimated delivery: 3-5 business days'}</p>
                    {contextSettings?.payment?.enableLoyaltyPoint && (
                      <p className="text-xs text-gray-600">
                        {t('product.free_shipping_threshold', { amount: formatPrice(0) }) || 
                         `Free shipping available`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-green-600 mb-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <p className="text-[10px] font-medium text-gray-700">{t('product.secure_payment') || 'Secure Payment'}</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600 mb-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <p className="text-[10px] font-medium text-gray-700">{t('product.free_returns') || 'Free Returns'}</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-purple-600 mb-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <p className="text-[10px] font-medium text-gray-700">{t('product.verified_reviews') || 'Verified Reviews'}</p>
                </div>
              </div>

              {/* Bundle Info */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t('bundle.details') || 'Bundle Details'}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">{t('bundle.total_items') || 'Total Items'}</span>
                    <span className="text-sm text-black font-medium">{bundle.products.reduce((sum, p) => sum + (p.quantity || 1), 0)} {t('bundle.items') || 'items'}</span>
                  </div>
                  {bundle.validUntil && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600">{t('bundle.valid_until') || 'Valid Until'}</span>
                      <span className="text-sm text-black font-medium">
                        {bundle.validUntil && typeof bundle.validUntil === 'object' && 'seconds' in bundle.validUntil
                          ? new Date(bundle.validUntil.seconds * 1000).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Tabs Section */}
        <div className="mt-12 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('description')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'description'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('product.tab_description') || 'Description'}
              </button>
              {contextSettings?.features?.productReviews && (
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'reviews'
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('product.tab_reviews') || 'Reviews'} {reviewCount > 0 && `(${reviewCount})`}
                </button>
              )}
              <button
                onClick={() => setActiveTab('shipping')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'shipping'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('product.tab_shipping') || 'Shipping & Returns'}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 md:p-10">
            {activeTab === 'description' && bundle.description && (
              <div className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-p:leading-relaxed">
                <p>{bundle.description}</p>
              </div>
            )}

            {activeTab === 'reviews' && contextSettings?.features?.productReviews && bundle.id && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <ReviewForm productId={bundle.id} onReviewSubmitted={refreshReviews} />
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <ReviewList productId={bundle.id} reviewsRefreshKey={reviewsRefreshKey} />
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{t('product.shipping_policy') || 'Shipping Policy'}</h3>
                  <p className="text-gray-600 leading-relaxed mb-2">
                    {t('product.shipping_policy_desc') || 'We offer fast and reliable shipping to all locations. Orders are typically processed within 1-2 business days and delivered within 3-5 business days.'}
                  </p>
                  {contextSettings?.payment?.enableLoyaltyPoint && (
                    <p className="text-gray-600 leading-relaxed">
                      {t('product.free_shipping_info', { amount: formatPrice(0) }) ||
                        `Free shipping available.`}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{t('product.returns_policy') || 'Returns Policy'}</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {t('product.returns_policy_desc') || 'We offer a 30-day return policy. Items must be unworn, unwashed, and in original packaging with tags attached.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Buttons */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-4 py-3 safe-area-bottom">
        <button
          onClick={handleAddToCart}
          style={{
            backgroundColor: contextSettings?.theme?.colors?.primaryButton || '#000000',
            color: contextSettings?.theme?.colors?.primaryButtonText || '#ffffff',
          }}
          className="w-full px-4 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 shadow-lg shadow-black/20 text-sm"
        >
          {t('bundle.add_to_cart') || 'Add Bundle to Cart'}
        </button>
      </div>

      {/* Image Lightbox */}
      {bundle.image && (
        <ImageLightbox
          images={[bundle.image]}
          currentIndex={0}
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          onNext={() => {}}
          onPrevious={() => {}}
          onThumbnailClick={() => {}}
          productName={bundle.name}
        />
      )}
    </div>
  );
};

export default BundleClient;

