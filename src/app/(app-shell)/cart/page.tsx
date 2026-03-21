'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { getProductName } from '@/lib/utils/translations';
import { calculateTaxes } from '@/lib/utils/tax';
import { getAllFreeShippingRules, getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FreeShippingRule, FlashSale } from '@/lib/firestore/campaigns';
import { getAllProductBundles } from '@/lib/firestore/product_bundles_db';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import { getProductPriceWithVariant, getProductPricingSummary } from '@/lib/utils/product-pricing';
import { isGoldPricedProduct } from '@/lib/utils/gold-pricing';
import { generateSlug } from '@/lib/utils/slug';

const CartPage = () => {
  const { cart, updateCartItemQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const { currentLanguage, t } = useLanguage();
  const languageCode = currentLanguage?.code || 'en';
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [freeShippingRule, setFreeShippingRule] = useState<FreeShippingRule | null>(null);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
    
    const fetchData = async () => {
      try {
        // Fetch free shipping rules
        const rules = await getAllFreeShippingRules(true); // activeOnly = true
        if (rules.length > 0) {
          // Use the rule with the lowest threshold (first one since they're ordered by threshold asc)
          setFreeShippingRule(rules[0]);
        }
        
        // Fetch related products
        const allProducts = await getAllProducts();
        const activeProducts = allProducts.filter((product) => product.isActive !== false);
        setProducts(activeProducts);

        const cartProductIds = new Set(cart.map((item) => item.productId));
        const recommendationPool = activeProducts
          .filter((product) => !cartProductIds.has(product.id))
          .map((product) => ({
            ...product,
            slug: product.slug || generateSlug(product.name || `product-${product.id}`),
          }));

        const shuffled = [...recommendationPool].sort(() => 0.5 - Math.random());
        setRelatedProducts(shuffled.slice(0, 4));
        
        // Fetch bundles for bundle pricing
        const allBundles = await getAllProductBundles(true);
        setBundles(allBundles);
        
        // Fetch flash sales for pricing
        const allFlashSales = await getAllFlashSales(true);
        
        const now = new Date();
        const validFlashSales = allFlashSales.filter(sale => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        });
        setFlashSales(validFlashSales);
      } catch {
        // Failed to fetch data
      }
    };
    
    fetchData();
  }, [cart]);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [remainingForFreeShipping, setRemainingForFreeShipping] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [, setTaxBreakdown] = useState<Array<{ taxRate: { name: string; rate: number; type: string }; amount: number }>>([]);
  const activeGoldPricing = settings?.goldPricing;
  const activeGoldCache = settings?.goldPricing?.cache;

  useEffect(() => {
    const updateTotals = async () => {
      // Calculate total including bundle pricing
      let baseTotal = 0;
      
      // Group items by bundleId, flashSaleId
      const bundleGroups = new Map<string, typeof cart>();
      const flashSaleGroups = new Map<string, typeof cart>();
      const nonGroupItems: typeof cart = [];
      
      cart.forEach(item => {
        if (item.bundleId) {
          if (!bundleGroups.has(item.bundleId)) {
            bundleGroups.set(item.bundleId, []);
          }
          bundleGroups.get(item.bundleId)!.push(item);
        } else if (item.flashSaleId) {
          if (!flashSaleGroups.has(item.flashSaleId)) {
            flashSaleGroups.set(item.flashSaleId, []);
          }
          flashSaleGroups.get(item.flashSaleId)!.push(item);
        } else {
          nonGroupItems.push(item);
        }
      });
      
      // Calculate bundle totals
      bundleGroups.forEach((items, bundleId) => {
        const bundle = bundles.find(b => b.id === bundleId);
        if (bundle) {
          let bundleTotalPrice = 0;
          
          if (bundle.bundlePrice) {
            bundleTotalPrice = bundle.bundlePrice;
          } else {
            items.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                const itemPrice = product.price; // Use base price
                const quantity = item.quantity;
                
                const bundleProduct = bundle.products.find(p => p.productId === item.productId);
                if (bundleProduct?.discount) {
                  bundleTotalPrice += itemPrice * quantity * (1 - bundleProduct.discount / 100);
                } else {
                  bundleTotalPrice += itemPrice * quantity;
                }
              }
            });
            
            // Apply bundle-level discount
            if (bundle.discountType === 'percentage' && bundle.discountValue) {
              bundleTotalPrice = bundleTotalPrice * (1 - bundle.discountValue / 100);
            } else if (bundle.discountType === 'fixed' && bundle.discountValue) {
              bundleTotalPrice = bundleTotalPrice - bundle.discountValue;
            }
          }
          
          baseTotal += bundleTotalPrice;
        } else {
          // If bundle not found, use individual prices
          items.forEach(item => {
            baseTotal += item.price * item.quantity;
          });
        }
      });
      
      // Calculate flash sale totals (recalculate to ensure correct pricing)
      flashSaleGroups.forEach((items, flashSaleId) => {
        const flashSale = flashSales.find(s => s.id === flashSaleId);
        if (flashSale) {
          items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              // For flash sale: discount applies to the effective product base price only, variant extraPrice is excluded.
              const basePrice = getProductPriceWithVariant(
                product,
                undefined,
                activeGoldPricing,
                activeGoldCache
              ).currentPrice;
              
              // Apply flash sale discount to base price only
              let discountedPrice = basePrice;
              if (flashSale.discountType === 'percentage') {
                discountedPrice = Math.max(basePrice * (1 - flashSale.discountValue / 100), 0);
              } else if (flashSale.discountType === 'fixed') {
                discountedPrice = Math.max(basePrice - flashSale.discountValue, 0);
              }
              
              // Final price = discounted base price only (variant extraPrice NOT included)
              baseTotal += discountedPrice * item.quantity;
            } else {
              // Fallback to stored price if product not found
              baseTotal += item.price * item.quantity;
            }
          });
        } else {
          // Fallback to stored price if flash sale not found
          items.forEach(item => {
            baseTotal += item.price * item.quantity;
          });
        }
      });
      
      // Add non-group items (recalculate price based on current product data)
      nonGroupItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          // Calculate variant extraPrice
          // If variant value contains " - " (color - size format), calculate both variants' extraPrice
          let variantExtraPrice = 0;
          if (item.variant) {
            // Check if this is a combined variant (color - size)
            if (item.variant.value?.includes(' - ')) {
              const [colorValue, sizeValue] = item.variant.value.split(' - ');
              const colorVariant = product.variants?.find(v => 
                v.name?.toLowerCase() === 'color' && 
                v.value?.toLowerCase() === colorValue?.toLowerCase()
              );
              const sizeVariant = product.variants?.find(v => 
                v.name?.toLowerCase() === 'size' && 
                v.value?.toLowerCase() === sizeValue?.toLowerCase()
              );
              const colorExtraPrice = (colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0);
              const sizeExtraPrice = (sizeVariant?.extraPrice ?? sizeVariant?.priceAdjustment ?? 0);
              variantExtraPrice = colorExtraPrice + sizeExtraPrice;
            } else {
              // Single variant
              const variant = product.variants?.find(v => 
                v.id === item.variant?.id || 
                (v.name?.toLowerCase() === item.variant?.name?.toLowerCase() && 
                 v.value?.toLowerCase() === item.variant?.value?.toLowerCase())
              );
              if (variant) {
                // Use nullish coalescing (??) instead of || because extraPrice can be 0 (which is falsy)
                variantExtraPrice = (variant.extraPrice ?? variant.priceAdjustment ?? 0);
              }
            }
          }
          
          const finalPrice = getProductPriceWithVariant(
            product,
            item.variant,
            activeGoldPricing,
            activeGoldCache
          ).currentPrice || (item.price + variantExtraPrice);
          baseTotal += finalPrice * item.quantity;
        } else {
          // Fallback to stored price if product not found
          baseTotal += item.price * item.quantity;
        }
      });
      
      setCurrentTotal(baseTotal);
      
      // Only calculate free shipping if there's an active rule
      if (freeShippingRule && freeShippingRule.threshold) {
        const threshold = freeShippingRule.threshold;
        const remaining = Math.max(0, threshold - baseTotal);
        setRemainingForFreeShipping(remaining);
        setProgressPercentage(Math.min(100, (baseTotal / threshold) * 100));
      } else {
        setRemainingForFreeShipping(0);
        setProgressPercentage(0);
      }
      
      // Calculate taxes only for non-gold products because gold tax is already included in gold pricing.
      const taxableCartItems = cart
        .filter((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          return product ? !isGoldPricedProduct(product) : true;
        })
        .map(item => ({
          productId: item.productId,
          categoryId: item.categoryId,
          price: item.price,
          quantity: item.quantity
        }));

      const taxableSubtotal = taxableCartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Calculate taxes (using PK as default region, can be changed based on user location)
      const taxCalculation = await calculateTaxes(
        taxableSubtotal,
        0, // Shipping cost (calculated at checkout)
        'PK', // Default region - can be made dynamic
        taxableCartItems
      );
      
      setTaxAmount(taxCalculation.taxAmount);
      setTaxBreakdown(taxCalculation.taxBreakdown);
    };
    
    if (bundles.length >= 0 && products.length > 0 && flashSales.length >= 0) {
    updateTotals();
    }
  }, [cart, getCartTotal, freeShippingRule, bundles, products, flashSales, activeGoldPricing, activeGoldCache]);

  if (!isClient) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container">
            <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
          </div>
        </div>

        <div className="page-container pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items Skeleton */}
            <div className="lg:col-span-2 space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="flex-grow space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-20 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary Skeleton */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 sticky top-4">
                <div className="h-6 bg-gray-200 rounded w-32 mb-6 animate-pulse" />
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                  <div className="h-px bg-gray-200 my-4" />
                  <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
                <div className="h-12 bg-gray-200 rounded-lg mt-6 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center bg-white">
        <div className="mb-8 relative">
            <div className="absolute inset-0 bg-gray-100 rounded-full scale-150 animate-pulse opacity-50"></div>
            <div className="relative p-8 bg-gray-50 rounded-full ring-1 ring-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 5c.07.277-.15.456-.52.456H4.15c-.37 0-.59-.179-.52-.456l1.263-5a.75.75 0 0 1 .726-.569h12.862a.75.75 0 0 1 .726.569Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z" />
                </svg>
            </div>
        </div>
        <h1 className="text-4xl font-heading font-bold mb-4 text-gray-900 tracking-tight">{t('cart.empty') || 'Your cart is empty'}</h1>
        <p className="text-gray-500 mb-10 max-w-md mx-auto text-lg leading-relaxed">
            {t('cart.empty_message') || "Looks like you haven't added any items yet."}
            <br />
            {t('cart.empty_submessage') || 'Explore our latest collection to find your perfect style.'}
        </p>
        <Link 
          href="/shop" 
          className="group relative inline-flex items-center justify-center px-10 py-4 text-lg font-medium text-white bg-black rounded-full hover:bg-gray-900 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          <span>{t('cart.start_shopping') || 'Start Shopping'}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-24 md:pb-20">
      {/* Page Header */}
      <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
        <div className="page-container">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">{t('cart.title') || 'Shopping Cart'}</h1>
            <p className="text-gray-500 flex items-center gap-2 text-sm">
                <Link href="/" className="hover:text-black transition-colors">{t('common.home') || 'Home'}</Link>
                <span className="text-gray-300">/</span>
                <span>{t('common.cart') || 'Cart'}</span>
            </p>
        </div>
      </div>

      <div className="page-container">
        <div className="flex flex-col lg:flex-row gap-12 relative">
          
          {/* Left Column: Cart Items */}
          <div className="lg:w-2/3">
            
            {/* Free Shipping Progress - Only show if there's an active rule */}
            {freeShippingRule && (
              <div className="mb-10 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-green-500">
                      <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" />
                      <path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM18.75 6.75h-1.875v3h1.875a.75.75 0 0 0 .75-.75V7.5a.75.75 0 0 0-.75-.75ZM20.25 13.5v-3h-4.5v3h4.5Z" />
                      <path d="M18.75 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                      <path fillRule="evenodd" d="M14.25 4.5v1.5H16.5v1.5H14.25v1.5H16.5v1.5H14.25v6h3a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75h-3Z" clipRule="evenodd" />
                    </svg>
                </div>

                <div className="flex justify-between items-center mb-3 relative z-10">
                  <span className="text-base font-medium text-gray-800">
                    {remainingForFreeShipping > 0 
                      ? <span>{(t('cart.free_shipping_spend_more') || 'Spend {{amount}} more for Free Shipping').replace('{{amount}}', formatPrice(remainingForFreeShipping))}</span>
                      : <span className="flex items-center text-green-600 font-bold"><span className="bg-green-100 p-1 rounded-full mr-2">🎉</span> {t('cart.free_shipping_unlocked') || "You've unlocked Free Shipping!"}</span>}
                  </span>
                  <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md">{progressPercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 relative z-10 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out relative ${progressPercentage === 100 ? 'bg-green-500' : 'bg-black'}`}
                    style={{ width: `${progressPercentage}%` }}
                  >
                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Cart Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-900">{t('cart.items') || 'Cart Items'} ({cart.length})</h2>
                <button
                    onClick={clearCart}
                    className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    {t('cart.clear_cart') || 'Clear Cart'}
                </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-6">
              {(() => {
                // Group items by bundleId, flashSaleId
                const bundleGroups = new Map<string, typeof cart>();
                const flashSaleGroups = new Map<string, typeof cart>();
                const nonGroupItems: typeof cart = [];
                
                cart.forEach(item => {
                  if (item.bundleId) {
                    if (!bundleGroups.has(item.bundleId)) {
                      bundleGroups.set(item.bundleId, []);
                    }
                    bundleGroups.get(item.bundleId)!.push(item);
                  } else if (item.flashSaleId) {
                    if (!flashSaleGroups.has(item.flashSaleId)) {
                      flashSaleGroups.set(item.flashSaleId, []);
                    }
                    flashSaleGroups.get(item.flashSaleId)!.push(item);
                  } else {
                    nonGroupItems.push(item);
                  }
                });
                
                const itemsToRender: Array<{ type: 'bundle' | 'flashSale' | 'item'; bundleId?: string; flashSaleId?: string; items: typeof cart; bundle?: ProductBundle; flashSale?: FlashSale }> = [];
                
                // Add bundle groups
                bundleGroups.forEach((items, bundleId) => {
                  const bundle = bundles.find(b => b.id === bundleId);
                  if (bundle) {
                    itemsToRender.push({ type: 'bundle', bundleId, items, bundle });
                  } else {
                    // If bundle not found, treat as regular items
                    nonGroupItems.push(...items);
                  }
                });
                
                // Add flash sale groups
                flashSaleGroups.forEach((items, flashSaleId) => {
                  const flashSale = flashSales.find(s => s.id === flashSaleId);
                  if (flashSale) {
                    itemsToRender.push({ type: 'flashSale', flashSaleId, items, flashSale });
                  } else {
                    // If flash sale not found, treat as regular items
                    nonGroupItems.push(...items);
                  }
                });
                
                // Add non-group items
                nonGroupItems.forEach(item => {
                  itemsToRender.push({ type: 'item', items: [item] });
                });

                return itemsToRender.map((group) => {
                  if (group.type === 'bundle' && group.bundle) {
                    // Render bundle group
                    const bundle = group.bundle;
                    const bundleItems = group.items;
                    
                    // Calculate bundle pricing
                    let bundleTotalPrice = 0;
                    let bundleOriginalPrice = 0;
                    
                    // Calculate original price (sum of base prices)
                    bundleItems.forEach(item => {
                      const product = products.find(p => p.id === item.productId);
                      if (product) {
                        bundleOriginalPrice += product.price * item.quantity; // Use base price only
                      }
                    });
                    
                    if (bundle.bundlePrice) {
                      bundleTotalPrice = bundle.bundlePrice;
                    } else {
                      // Calculate from individual products with discounts
                      bundleItems.forEach(item => {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                          const itemPrice = product.price; // Use base price
                          const quantity = item.quantity;
                          
                          const bundleProduct = bundle.products.find(p => p.productId === item.productId);
                          if (bundleProduct?.discount) {
                            bundleTotalPrice += itemPrice * quantity * (1 - bundleProduct.discount / 100);
                          } else {
                            bundleTotalPrice += itemPrice * quantity;
                          }
                        }
                      });
                      
                      // Apply bundle-level discount
                      if (bundle.discountType === 'percentage' && bundle.discountValue) {
                        bundleTotalPrice = bundleTotalPrice * (1 - bundle.discountValue / 100);
                      } else if (bundle.discountType === 'fixed' && bundle.discountValue) {
                        bundleTotalPrice = bundleTotalPrice - bundle.discountValue;
                      }
                    }
                    
                    const bundleSavings = bundleOriginalPrice - bundleTotalPrice;
                    
                    return (
                      <div key={`bundle-${group.bundleId}`} className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 uppercase tracking-wider rounded">
                              {t('cart.bundle') || 'Bundle'}
                            </span>
                            <Link href={`/product-bundles/${bundle.id}`} className="text-lg font-bold text-gray-900 hover:underline">
                              {bundle.name}
                            </Link>
                          </div>
                          <button
                            onClick={() => bundleItems.forEach(item => removeFromCart(item.productId, item.variant?.id))}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            {t('cart.remove_bundle') || 'Remove Bundle'}
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {bundleItems.map((item) => (
                            <div key={`${item.productId}-${item.variant?.id || 'no-variant'}`} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-purple-100">
                              <Link href={`/products/${item.productSlug || item.productId}`} className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                <Image
                                  src={item.productImage}
                                  alt={item.productName}
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                />
                              </Link>
                              <div className="flex-1">
                                <Link href={`/products/${item.productSlug || item.productId}`} className="font-medium text-gray-900 hover:text-gray-600">
                                  {item.productName}
                                </Link>
                                {item.variant && (
                                  <p className="text-sm text-gray-500">{item.variant.name}: {item.variant.value}</p>
                                )}
                                <p className="text-sm text-gray-500">{(t('cart.quantity_label') || 'Quantity: {{count}}').replace('{{count}}', item.quantity.toString())}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-purple-200">
                          <div>
                            <p className="text-sm text-gray-600">{t('cart.bundle_total') || 'Bundle Total'}</p>
                            {bundleSavings > 0 && (
                              <p className="text-xs text-green-600">{(t('cart.you_save') || 'You save {{amount}}').replace('{{amount}}', formatPrice(bundleSavings))}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {bundleSavings > 0 && (
                              <p className="text-sm text-gray-500 line-through">{formatPrice(bundleOriginalPrice)}</p>
                            )}
                            <p className="text-xl font-bold text-gray-900">{formatPrice(bundleTotalPrice)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (group.type === 'flashSale' && group.flashSale) {
                    // Render flash sale group
                    const flashSale = group.flashSale;
                    const flashSaleItems = group.items;
                    
                    // Calculate flash sale pricing
                    let flashSaleTotalPrice = 0;
                    let flashSaleOriginalPrice = 0;
                    
                    flashSaleItems.forEach(item => {
                      const product = products.find(p => p.id === item.productId);
                      if (product) {
                        // For flash sale, use the effective product price as the base before flash discount.
                        const basePrice = getProductPriceWithVariant(
                          product,
                          undefined,
                          activeGoldPricing,
                          activeGoldCache
                        ).currentPrice;
                        
                        const quantity = item.quantity;
                        
                        // Original price = base price only (variant extraPrice not included in flash sale)
                        flashSaleOriginalPrice += basePrice * quantity;
                        
                        // Flash sale discount applies to base price only
                        let discountedPrice = basePrice;
                        if (flashSale.discountType === 'percentage') {
                          discountedPrice = Math.max(basePrice * (1 - flashSale.discountValue / 100), 0);
                        } else if (flashSale.discountType === 'fixed') {
                          discountedPrice = Math.max(basePrice - flashSale.discountValue, 0);
                        }
                        
                        // Final price = discounted base price only (variant extraPrice not included)
                        flashSaleTotalPrice += discountedPrice * quantity;
                      }
                    });
                    
                    const flashSaleSavings = flashSaleOriginalPrice - flashSaleTotalPrice;
                    
                    return (
                      <div key={`flashSale-${group.flashSaleId}`} className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-600 text-white text-xs font-bold px-2 py-1 uppercase tracking-wider rounded">
                              {t('cart.flash_sale') || 'Flash Sale'}
                            </span>
                            <Link href={`/flash`} className="text-lg font-bold text-gray-900 hover:underline">
                              {flashSale.name}
                            </Link>
                          </div>
                          <button
                            onClick={() => flashSaleItems.forEach(item => removeFromCart(item.productId, item.variant?.id))}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            {t('cart.remove_flash_sale_items') || 'Remove Flash Sale Items'}
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {flashSaleItems.map((item) => (
                            <div key={`${item.productId}-${item.variant?.id || 'no-variant'}`} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-orange-100">
                              <Link href={`/products/${item.productSlug || item.productId}`} className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                <Image
                                  src={item.productImage}
                                  alt={item.productName}
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                />
                              </Link>
                              <div className="flex-1">
                                <Link href={`/products/${item.productSlug || item.productId}`} className="font-medium text-gray-900 hover:text-gray-600">
                                  {item.productName}
                                </Link>
                                {item.variant && (
                                  <p className="text-sm text-gray-500">{item.variant.name}: {item.variant.value}</p>
                                )}
                                <p className="text-sm text-gray-500">{(t('cart.quantity_label') || 'Quantity: {{count}}').replace('{{count}}', item.quantity.toString())}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-orange-200">
                          <div>
                            <p className="text-sm text-gray-600">{t('cart.flash_sale_total') || 'Flash Sale Total'}</p>
                            {flashSaleSavings > 0 && (
                              <p className="text-xs text-green-600">{(t('cart.you_save') || 'You save {{amount}}').replace('{{amount}}', formatPrice(flashSaleSavings))}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {flashSaleSavings > 0 && (
                              <p className="text-sm text-gray-500 line-through">{formatPrice(flashSaleOriginalPrice)}</p>
                            )}
                            <p className="text-xl font-bold text-gray-900">{formatPrice(flashSaleTotalPrice)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Render regular item
                    return group.items.map((item) => {
                      // Recalculate price for regular items based on current product data
                      const product = products.find(p => p.id === item.productId);
                      let displayPrice = item.price;
                      let displayOriginalPrice: number | undefined = undefined;
                      
                      if (product) {
                        const pricing = getProductPriceWithVariant(
                          product,
                          item.variant,
                          activeGoldPricing,
                          activeGoldCache
                        );

                        displayPrice = pricing.currentPrice;
                        displayOriginalPrice = pricing.originalPrice ?? 0;
                      }
                      
                      return (
                <div key={`${item.productId}-${item.variant?.id || 'no-variant'}`} className="group flex flex-col sm:flex-row gap-6 p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:border-gray-200 transition-all duration-300 relative overflow-hidden">
                  
                  {/* Remove Button (Top Right absolute) */}
                  <button
                      onClick={() => removeFromCart(item.productId, item.variant?.id)}
                      className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                      aria-label="Remove item"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                  </button>

                  {/* Product Image */}
                  <Link href={`/products/${item.productSlug || item.productId}`} className="relative w-full sm:w-36 h-48 sm:h-36 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 cursor-pointer">
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, 144px"
                    />
                  </Link>

                  {/* Product Details */}
                  <div className="flex-grow flex flex-col justify-between pr-8">
                    <div>
                      <Link href={`/products/${item.productSlug || item.productId}`} className="text-lg font-bold text-gray-900 mb-1 hover:underline decoration-1 underline-offset-4">{item.productName}</Link>
                      
                      <div className="flex flex-wrap gap-2 mt-2 mb-4">
                        {item.variant && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {item.variant.name}: {item.variant.value}
                            </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            {t('cart.in_stock') || 'In Stock'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-4">
                      <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('cart.price') || 'Price'}</span>
                                {displayOriginalPrice && displayOriginalPrice > displayPrice ? (
                                  <>
                                    <span className="text-lg font-medium text-gray-900">{formatPrice(displayPrice)}</span>
                                    <span className="text-sm text-gray-500 line-through">{formatPrice(displayOriginalPrice)}</span>
                                  </>
                                ) : (
                          <span className="text-lg font-medium text-gray-900">{formatPrice(displayPrice)}</span>
                                )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 p-1">
                        <button
                          onClick={() => updateCartItemQuantity(item.productId, Math.max(1, item.quantity - 1), item.variant?.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-600 hover:text-black shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:shadow-none"
                          disabled={item.quantity <= 1}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                          </svg>
                        </button>
                        <span className="w-10 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1, item.variant?.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-600 hover:text-black shadow-sm hover:shadow transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-right min-w-[100px]">
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('cart.total') || 'Total'}</span>
                          <span className="text-lg font-bold text-gray-900">{formatPrice(displayPrice * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                      );
                    });
                  }
                })
              })()}
            </div>

            {/* Related Products / You Might Also Like */}
            <div className="mt-16">
                <h3 className="text-2xl font-heading font-bold text-gray-900 mb-6">{t('cart.you_might_also_like') || 'You Might Also Like'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {relatedProducts.map((product) => (
                        <div key={product.id} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer">
                             <Link href={`/products/${product.slug || product.id}`} className="block relative h-48 w-full bg-gray-100 overflow-hidden">
                                <Image 
                                    src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder-product.jpg'} 
                                    alt={getProductName(product, languageCode)}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />
                                <button className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-sm hover:bg-black hover:text-white transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                </button>
                            </Link>
                            <div className="p-3">
                                <Link href={`/products/${product.slug || product.id}`}>
                                    <h4 className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors">{getProductName(product, languageCode)}</h4>
                                </Link>
                                <p className="text-sm font-bold text-gray-600 mt-1">
                                  {formatPrice(
                                    getProductPricingSummary(
                                      product,
                                      activeGoldPricing,
                                      activeGoldCache
                                    ).currentPrice
                                  )}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-10">
               <Link href="/shop" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-black transition-colors group">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  {t('cart.continue_shopping') || 'Continue Shopping'}
               </Link>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:w-1/3 relative">
            <div className="sticky top-24 space-y-6">
                
                {/* Summary Card */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50">
                <h2 className="text-2xl font-heading font-bold mb-6 text-gray-900">{t('cart.order_summary') || 'Order Summary'}</h2>
                
                {/* Promo Code */}
                <div className="mb-6">
                    <button 
                        onClick={() => setIsPromoOpen(!isPromoOpen)}
                        className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-black mb-2"
                    >
                        <span>{t('cart.have_promo_code') || 'Have a promo code?'}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transition-transform ${isPromoOpen ? 'rotate-180' : ''}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                    
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isPromoOpen ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                placeholder={t('cart.enter_code') || 'Enter code'}
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
                            />
                            <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors">
                                {t('cart.apply') || 'Apply'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Gift Wrap Toggle - Only show if enabled in settings */}
                {settings?.giftWrap?.enabled && (
                <div className="flex items-center justify-between mb-8 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm text-pink-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                            </svg>
                        </div>
                        <div>
                            <span className="block text-sm font-medium text-gray-900">
                              {t('admin.gift_wrap') || 'Gift Wrap'}
                            </span>
                            <span className="block text-xs text-gray-500">
                              {settings?.giftWrap?.description || 'Add a special touch'} (+{formatPrice(settings?.giftWrap?.price || 150)})
                            </span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={giftWrap} onChange={() => setGiftWrap(!giftWrap)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                </div>
                )}

                <div className="space-y-4 mb-6 pb-6 border-b border-gray-100 border-dashed">
                    <div className="flex justify-between text-gray-600">
                    <span>{t('cart.subtotal') || 'Subtotal'}</span>
                    <span className="font-medium text-gray-900">{formatPrice(currentTotal)}</span>
                    </div>
                    {giftWrap && settings?.giftWrap?.enabled && (
                        <div className="flex justify-between text-gray-600">
                            <span>{t('admin.gift_wrap') || 'Gift Wrap'}</span>
                            <span className="font-medium text-gray-900">
                              {formatPrice(settings?.giftWrap?.price || 150)}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                    <span>{t('cart.shipping_estimate') || 'Shipping Estimate'}</span>
                    <span className="text-sm text-gray-500 italic">{t('cart.calculated_at_checkout') || 'Calculated at checkout'}</span>
                    </div>
                    {freeShippingRule && remainingForFreeShipping === 0 && (
                    <div className="flex justify-between text-green-600 font-medium text-sm bg-green-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                            </svg>
                            {t('cart.free_shipping') || 'Free Shipping'}
                        </span>
                        <span>-{formatPrice(0)}</span>
                    </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>{t('cart.tax') || 'Tax'}</span>
                        <span className="font-medium text-gray-900">{formatPrice(taxAmount)}</span>
                      </div>
                    )}
                </div>

                <div className="flex justify-between items-end mb-8">
                    <span className="text-lg font-bold text-gray-900">{t('cart.total') || 'Total'}</span>
                    <div className="text-right">
                        <span className="block text-3xl font-bold text-gray-900">
                          {formatPrice(currentTotal + (giftWrap ? (settings?.giftWrap?.price || 150) : 0) + taxAmount)}
                        </span>
                        <span className="text-xs text-gray-400">{taxAmount > 0 ? (t('cart.including_taxes') || 'Including taxes') : (t('cart.tax_calculated_at_checkout') || 'Tax calculated at checkout')}</span>
                    </div>
                </div>

                {/* Desktop Checkout Button */}
                <button
                    onClick={() => router.push('/checkout')}
                    style={{
                      backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
                      color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
                    }}
                    className="hidden md:block w-full py-4 px-6 rounded-xl font-bold text-lg hover:opacity-90 hover:shadow-lg hover:shadow-gray-200 transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center group relative overflow-hidden"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {t('cart.proceed_to_checkout') || 'Proceed to Checkout'}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                    </span>
                    <div className="absolute inset-0 bg-gray-800 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 ease-out"></div>
                </button>
                
                <div className="mt-6 flex items-center justify-center gap-2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span className="text-xs font-medium">{t('cart.secure_checkout_via_stripe') || 'Secure Checkout via Stripe'}</span>
                </div>
                </div>

                {/* Additional Trust Badges or Info */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="mx-auto w-8 h-8 bg-white rounded-full flex items-center justify-center mb-1 shadow-sm text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                            </svg>
                        </div>
                        <p className="text-[10px] font-medium text-gray-500">{t('cart.authentic') || 'Authentic'}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="mx-auto w-8 h-8 bg-white rounded-full flex items-center justify-center mb-1 shadow-sm text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </div>
                        <p className="text-[10px] font-medium text-gray-500">{t('cart.easy_returns') || 'Easy Returns'}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                         <div className="mx-auto w-8 h-8 bg-white rounded-full flex items-center justify-center mb-1 shadow-sm text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                            </svg>
                        </div>
                        <p className="text-[10px] font-medium text-gray-500">{t('cart.support') || 'Support'}</p>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Sticky Checkout Button - Bottom */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-0.5">{t('cart.total') || 'Total'}</p>
            <p className="text-lg font-bold text-gray-900">
              {formatPrice(currentTotal + (giftWrap ? (settings?.giftWrap?.price || 150) : 0) + taxAmount)}
            </p>
          </div>
          <button
            onClick={() => router.push('/checkout')}
            style={{
              backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
              color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
            }}
            className="flex-1 py-3 px-4 rounded-lg font-semibold hover:opacity-90 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm"
          >
            <span>{t('cart.checkout') || 'Checkout'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
