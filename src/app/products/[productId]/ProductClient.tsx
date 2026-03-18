'use client';

import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, ProductTranslation } from '@/lib/firestore/products';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FlashSale } from '@/lib/firestore/campaigns';
import ReviewForm from '@/components/ReviewForm';
import ReviewList from '@/components/ReviewList';
import { getColors, getSizes } from '@/lib/firestore/attributes_db';
import { getCategory } from '@/lib/firestore/categories_db';
import { getBrand } from '@/lib/firestore/brands_db';
import { getReviewsByProductId } from '@/lib/firestore/reviews';
import { Color, Size } from '@/lib/firestore/attributes';
import { Category } from '@/lib/firestore/categories';
import { Brand } from '@/lib/firestore/brands';
import { useRouter } from 'next/navigation';
import { getProductName, getProductDescription, getCategoryName, getBrandName, getColorName, getSizeName } from '@/lib/utils/translations';
import ImageLightbox from '@/components/ImageLightbox';
import { getFlashSaleAdjustedPrice, getProductPricingSummary } from '@/lib/utils/product-pricing';
import { Settings } from '@/lib/firestore/settings';

// Serialized Product type (Timestamps converted to plain objects)
export type SerializedProductTranslation = Omit<ProductTranslation, 'updatedAt'> & {
  updatedAt: { seconds: number; nanoseconds: number };
};

export type SerializedProduct = Omit<Product, 'createdAt' | 'updatedAt' | 'preOrderExpectedDate' | 'translations'> & {
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
  preOrderExpectedDate?: { seconds: number; nanoseconds: number } | null;
  analytics?: Omit<Product['analytics'], 'lastViewed'> & {
    lastViewed?: { seconds: number; nanoseconds: number } | null;
  };
  translations?: SerializedProductTranslation[];
};

interface ProductClientProps {
  product: SerializedProduct | null;
  productId: string;
  isFlashSalePage?: boolean;
  flashSales?: FlashSale[];
  initialSettings?: Settings | null;
}

const ProductClient: React.FC<ProductClientProps> = ({
  product,
  productId,
  isFlashSalePage = false,
  flashSales: propFlashSales,
  initialSettings = null,
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'shipping' | 'size-guide'>('description');
  const [showSizeGuideModal, setShowSizeGuideModal] = useState(false);
  const [viewingCount, setViewingCount] = useState<number>(0);
  const [soldToday, setSoldToday] = useState<number>(0);
  const [showSizeChart, setShowSizeChart] = useState(false);
  
  // Hooks must be called unconditionally
  const { addToCart, setShowCartDialog, setCartDialogMessage } = useCart();
  const { t, currentLanguage } = useLanguage();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useToast();
  const languageCode = currentLanguage?.code || 'en';
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayPrice, setDisplayPrice] = useState<number>(0);
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { settings: contextSettings } = useSettings();
  const router = useRouter();
  const activeGoldPricing =
    contextSettings?.goldPricing?.enabled || contextSettings?.goldPricing?.cache?.pricePerGram
      ? contextSettings.goldPricing
      : initialSettings?.goldPricing;
  const priceCurrency = activeGoldPricing?.cache?.currency || 'SAR';
  
  // Ensure component is mounted before using context
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if product is in wishlist
  useEffect(() => {
    if (mounted && product) {
      const stored = localStorage.getItem('wishlist');
      if (stored) {
        const wishlistItems = JSON.parse(stored);
        const isInList = wishlistItems.some((item: { id: string }) => item.id === product.id);
        setIsInWishlist(isInList);
      } else {
        setIsInWishlist(false);
      }
    }
  }, [mounted, product]);
  
  // Image State
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [colorsData, sizesData, categoryData, brandData, reviewsData, flashSales] = await Promise.all([
          getColors().catch(() => {
            // Error fetching colors
            return [];
          }),
          getSizes().catch(() => {
            // Error fetching sizes
            return [];
          }),
          product?.category ? getCategory(product.category).catch(() => {
            // Error fetching category
            return null;
          }) : Promise.resolve(null),
          product?.brandId ? getBrand(product.brandId).catch(() => {
            // Error fetching brand
            return null;
          }) : Promise.resolve(null),
          getReviewsByProductId(productId).catch(() => {
            // Error fetching reviews
            return [];
          }),
          getAllFlashSales(true).catch(() => {
            // Error fetching flash sales
            return [];
          }),
          Promise.resolve([])
        ]);
      setColors(colorsData);
        setSizes(sizesData);
        setCategory(categoryData);
        setBrand(brandData);
        setDataLoading(false);
        
        // Filter valid flash sales for this product
        if (flashSales && flashSales.length > 0) {
          const now = new Date();
          const validSales = flashSales.filter((sale: FlashSale) => {
            if (!sale.isActive) return false;
            if (!sale.productIds.includes(productId)) return false;
            const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
            const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
            return now >= startTime && now <= endTime;
          });
          setActiveFlashSales(validSales);
        } else {
          setActiveFlashSales([]);
        }
        
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
        // Error fetching product data
        // Set defaults on error
        setColors([]);
        setSizes([]);
        setCategory(null);
        setBrand(null);
        setAverageRating(0);
        setReviewCount(0);
      }
    };
    
    if (product && mounted) {
      fetchData();
    }

    // Track product view - silently fail if permissions issue
    if (productId && mounted) {
      const trackProductView = async () => {
        try {
        const { incrementProductView } = await import('@/lib/firestore/products_db');
          await incrementProductView(productId);
        } catch (error: unknown) {
          // Silently fail for tracking - don't show error to user
          const errorObj = error as { message?: string; code?: string };
          if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
            // Product view tracking failed due to permissions
          } else {
            // Error tracking product view
          }
        }
      };
      trackProductView();
    }

    // Calculate social proof data
    if (product?.analytics) {
      // Simulate viewing count (views in last hour)
      const views = product.analytics.views || 0;
      const recentViews = Math.floor(views * 0.1); // 10% of total views as "recent"
      setViewingCount(recentViews > 0 ? recentViews : Math.floor(Math.random() * 5) + 1);
      
      // Calculate sold today (purchases in last 24 hours)
      const purchases = product.analytics.purchases || 0;
      const recentPurchases = Math.floor(purchases * 0.05); // 5% of total purchases as "today"
      setSoldToday(recentPurchases > 0 ? recentPurchases : (purchases > 0 ? Math.floor(Math.random() * 3) + 1 : 0));
    }
  }, [productId, product, reviewsRefreshKey, mounted]);

  const refreshReviews = () => {
    setReviewsRefreshKey(prev => prev + 1);
  };

  // Find variant that matches both color and size
  useEffect(() => {
    if (!product || !product.variants) return;
    
    // If we have both color and size selected, find the matching variant
    if (selectedColor && selectedSize) {
      // Look for variants that match the combination
      // Since variants are stored separately, we'll prioritize size variant for price
      // but we need to ensure both are selected
      const sizeVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedSize.toLowerCase()
      );
      const colorVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
      );
      
      // Use size variant for price (sizes typically have different prices)
      // But we'll combine both selections
      if (sizeVariant) {
        setSelectedVariant(sizeVariant);
      } else if (colorVariant) {
        setSelectedVariant(colorVariant);
      } else {
        setSelectedVariant(undefined);
      }
    } else if (selectedColor) {
      // Only color selected
      const colorVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
      );
      setSelectedVariant(colorVariant);
    } else if (selectedSize) {
      // Only size selected
      const sizeVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedSize.toLowerCase()
      );
      setSelectedVariant(sizeVariant);
    } else {
      setSelectedVariant(undefined);
    }
  }, [product, selectedColor, selectedSize]);

  // Calculate prices (using default currency)
  useEffect(() => {
      if (!product) return;
      
      let baseDisplayPrice = 0;
      let baseOriginalPrice = 0;
      
      // Calculate total extra price from all selected variants (color + size)
      let totalExtraPrice = 0;
      
      if (selectedColor && product.variants) {
        const colorVariant = product.variants.find(v => 
          v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
        );
        if (colorVariant?.extraPrice) {
          totalExtraPrice += colorVariant.extraPrice;
        }
      }
      
      if (selectedSize && product.variants) {
        const sizeVariant = product.variants.find(v => 
          v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedSize.toLowerCase()
        );
        if (sizeVariant?.extraPrice) {
          totalExtraPrice += sizeVariant.extraPrice;
        }
      }
      
      // If only single variant is selected (not color+size combination)
      if (selectedVariant && !selectedColor && !selectedSize) {
        if (selectedVariant.extraPrice) {
          totalExtraPrice += selectedVariant.extraPrice;
        }
      }
      
      const pricing = getProductPricingSummary(
        product as Product,
        activeGoldPricing,
        activeGoldPricing?.cache
      );

      baseOriginalPrice = pricing.originalPrice ?? pricing.currentPrice;

      if (isFlashSalePage && activeFlashSales.length > 0) {
        const productSale = activeFlashSales[0];
        const flashPricing = getFlashSaleAdjustedPrice(
          product as Product,
          productSale,
          activeGoldPricing,
          activeGoldPricing?.cache
        );
        baseDisplayPrice = flashPricing.currentPrice;
        baseOriginalPrice = flashPricing.originalPrice ?? pricing.currentPrice;
      } else {
        baseDisplayPrice = pricing.currentPrice + totalExtraPrice;
        baseOriginalPrice =
          pricing.originalPrice !== null
            ? pricing.originalPrice + totalExtraPrice
            : pricing.currentPrice + totalExtraPrice;
      }
      
    // No conversion needed - prices are in default currency
    setDisplayPrice(baseDisplayPrice);
    setOriginalPrice(baseOriginalPrice);
  }, [product, selectedVariant, selectedColor, selectedSize, activeFlashSales, isFlashSalePage, activeGoldPricing]);

  const hasDiscount = displayPrice < originalPrice;

  // Product Badges
  const getProductBadges = () => {
    if (!product) return [];
    const badges: Array<{ type: 'new' | 'sale' | 'best-seller' | 'limited'; text: string; color: string }> = [];
    
    // New badge (created within last 30 days)
    if (product.createdAt) {
      const createdAt = product.createdAt.seconds ? new Date(product.createdAt.seconds * 1000) : null;
      if (createdAt && (Date.now() - createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000) {
        badges.push({ type: 'new', text: t('product.badge_new') || 'New', color: 'bg-blue-500' });
      }
    }
    
    // Sale badge
    if (hasDiscount) {
      badges.push({ type: 'sale', text: t('product.badge_sale') || 'Sale', color: 'bg-red-500' });
    }
    
    // Best Seller badge (more than 50 purchases)
    if ((product.analytics?.purchases || 0) > 50) {
      badges.push({ type: 'best-seller', text: t('product.badge_best_seller') || 'Best Seller', color: 'bg-purple-500' });
    }
    
    // Limited Edition (if stock is low)
    const totalStock = product.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;
    if (totalStock > 0 && totalStock <= 10) {
      badges.push({ type: 'limited', text: t('product.badge_limited') || 'Limited', color: 'bg-orange-500' });
    }
    
    return badges;
  };

  // Stock Indicator
  const getStockInfo = () => {
    if (!product) {
      return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', count: null, color: 'text-green-600' };
    }
    if (!product.variants || product.variants.length === 0) {
      return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', count: null, color: 'text-green-600' };
    }
    
    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    
    if (totalStock === 0) {
      return { status: 'out_of_stock', text: t('product.out_of_stock') || 'Out of Stock', count: 0, color: 'text-red-600' };
    } else if (totalStock <= 5) {
      return { status: 'low_stock', text: t('product.only_x_left', { count: totalStock }) || `Only ${totalStock} left`, count: totalStock, color: 'text-orange-600' };
    } else if (totalStock <= 10) {
      return { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', count: totalStock, color: 'text-yellow-600' };
    } else {
      return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', count: totalStock, color: 'text-green-600' };
    }
  };

  const stockInfo = getStockInfo();
  const productBadges = getProductBadges();

  // Debug: Log product data
  useEffect(() => {
    if (product) {
      console.log('Product data:', {
        id: product.id,
        name: product.name,
        hasVariants: !!product.variants,
        variantsCount: product.variants?.length || 0
      });
    }
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">{t('product.not_found') || 'Product Not Found'}</h1>
          <p className="text-gray-500">{t('product.not_found_desc') || 'The product you are looking for does not exist or has been removed.'}</p>
        </div>
      </div>
    );
  }

  if (dataLoading || !mounted) {
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
              <div className="space-y-3">
                <div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
                <div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAddToCart = async () => {
    // Check if both color and size are required
    const hasColorVariants = product.variants?.some(v => v.name.toLowerCase() === 'color');
    const hasSizeVariants = product.variants?.some(v => v.name.toLowerCase() === 'size');
    
    if (hasColorVariants && hasSizeVariants) {
      if (!selectedColor || !selectedSize) {
        showError(t('products.select_variant') || 'Please select both color and size.');
        return;
      }
    } else if (product.variants && product.variants.length > 0 && !selectedVariant) {
      showError(t('products.select_variant') || 'Please select a variant.');
      return;
    }
    
    // Track add to cart - silently fail if permissions issue
    if (productId) {
      try {
        const { incrementAddToCart } = await import('@/lib/firestore/products_db');
        await incrementAddToCart(productId);
      } catch (err: unknown) {
        // Silently fail for tracking - don't show error to user
        const errorObj = err as { message?: string; code?: string };
        if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
              // Add to cart tracking failed due to permissions
        } else {
        // Failed to track add to cart
        }
      }
    }
    
    // Create combined variant if both color and size are selected
    let variantToAdd = selectedVariant;
    if (selectedColor && selectedSize && product.variants) {
      const colorVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
      );
      const sizeVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedSize.toLowerCase()
      );
      if (sizeVariant) {
        // Calculate combined extraPrice (color + size)
        const colorExtraPrice = (colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0);
        const sizeExtraPrice = (sizeVariant.extraPrice ?? sizeVariant.priceAdjustment ?? 0);
        const combinedExtraPrice = colorExtraPrice + sizeExtraPrice;
        
        // Create a combined variant with both color and size, with combined extraPrice
        variantToAdd = {
          ...sizeVariant,
          id: `${sizeVariant.id}-${selectedColor}`,
          value: `${selectedColor} - ${selectedSize}`,
          extraPrice: combinedExtraPrice,
          // Clear priceAdjustment to avoid confusion
          priceAdjustment: undefined,
        };
      }
    }
    
    // Get flash sale ID ONLY if from flash sale page (isFlashSalePage = true)
    // Regular product pages should NOT pass flashSaleId, so cart shows base/salePrice
    const flashSaleId = isFlashSalePage ? ((propFlashSales || activeFlashSales).find(sale => sale.productIds.includes(productId))?.id) : undefined;
    
    addToCart(
      { ...(product as Product), price: displayPrice, salePrice: undefined },
      quantity,
      variantToAdd,
      undefined,
      undefined,
      undefined,
      flashSaleId
    );
    setCartDialogMessage(`${quantity} x ${getProductName(product as Product, languageCode)} ${t('cart.added_to_cart') || 'added to cart!'}`);
    setShowCartDialog(true);
  };

  const handleBuyNow = () => {
    // Check if both color and size are required
    const hasColorVariants = product.variants?.some(v => v.name.toLowerCase() === 'color');
    const hasSizeVariants = product.variants?.some(v => v.name.toLowerCase() === 'size');
    
    if (hasColorVariants && hasSizeVariants) {
      if (!selectedColor || !selectedSize) {
        showError(t('products.select_variant') || 'Please select both color and size.');
        return;
      }
    } else if (product.variants && product.variants.length > 0 && !selectedVariant) {
      showError(t('products.select_variant') || 'Please select a variant.');
      return;
    }
    
    // Create combined variant if both color and size are selected
    let variantToAdd = selectedVariant;
    if (selectedColor && selectedSize && product.variants) {
      const colorVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase()
      );
      const sizeVariant = product.variants.find(v => 
        v.name.toLowerCase() === 'size' && v.value.toLowerCase() === selectedSize.toLowerCase()
      );
      if (sizeVariant) {
        // Calculate combined extraPrice (color + size)
        const colorExtraPrice = (colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0);
        const sizeExtraPrice = (sizeVariant.extraPrice ?? sizeVariant.priceAdjustment ?? 0);
        const combinedExtraPrice = colorExtraPrice + sizeExtraPrice;
        
        // Create a combined variant with both color and size, with combined extraPrice
        variantToAdd = {
          ...sizeVariant,
          id: `${sizeVariant.id}-${selectedColor}`,
          value: `${selectedColor} - ${selectedSize}`,
          extraPrice: combinedExtraPrice,
          // Clear priceAdjustment to avoid confusion
          priceAdjustment: undefined,
        };
      }
    }
    
    // Get flash sale ID ONLY if from flash sale page (isFlashSalePage = true)
    // Regular product pages should NOT pass flashSaleId, so cart shows base/salePrice
    const flashSaleId = isFlashSalePage ? ((propFlashSales || activeFlashSales).find(sale => sale.productIds.includes(productId))?.id) : undefined;
    
    addToCart(
      { ...(product as Product), price: displayPrice, salePrice: undefined },
      quantity,
      variantToAdd,
      undefined,
      undefined,
      undefined,
      flashSaleId
    );
    
    router.push('/checkout');
  };

  // Check stock availability
  const getStockStatus = () => {
    const hasColorVariants = product.variants?.some(v => v.name.toLowerCase() === 'color');
    const hasSizeVariants = product.variants?.some(v => v.name.toLowerCase() === 'size');
    
    if (hasColorVariants && hasSizeVariants) {
      if (!selectedColor || !selectedSize) {
        return 'select_variant';
      }
      if (selectedVariant) {
        return selectedVariant.stock > 0 ? 'in_stock' : 'out_of_stock';
      }
      return 'select_variant';
    }
    
    if (selectedVariant) {
      return selectedVariant.stock > 0 ? 'in_stock' : 'out_of_stock';
    }
    if (product.variants && product.variants.length > 0) {
      const hasStock = product.variants.some(v => v.stock > 0);
      return hasStock ? 'select_variant' : 'out_of_stock';
    }
    return 'in_stock';
  };

  const stockStatus = getStockStatus();
  const isOutOfStock = stockStatus === 'out_of_stock';
  const needsVariantSelection = stockStatus === 'select_variant';

  // Share product
  const handleShare = async () => {
    const url = window.location.href;
    const text = `Check out ${getProductName(product as Product, languageCode)} on ${contextSettings?.company?.name || ''}!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: getProductName(product as Product, languageCode),
          text: text,
          url: url,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        showSuccess(t('common.link_copied') || 'Link copied to clipboard!');
      } catch {
        // Failed to copy
        showError(t('common.copy_failed') || 'Failed to copy');
      }
    }
  };

  // Toggle wishlist
  const handleToggleWishlist = () => {
    if (!mounted || !product) return;
    
    const stored = localStorage.getItem('wishlist');
    let wishlistItems: Array<{ id: string; name: string; price: number; image?: string; inStock: boolean; slug?: string }> = stored ? JSON.parse(stored) : [];
    
    const productItem = {
      id: product.id,
      name: getProductName(product as Product, languageCode),
      price: displayPrice,
      image: product.images?.[0],
      inStock: !isOutOfStock,
      slug: product.slug,
    };
    
    if (isInWishlist) {
      // Remove from wishlist
      wishlistItems = wishlistItems.filter(item => item.id !== product.id);
      setIsInWishlist(false);
    } else {
      // Add to wishlist
      wishlistItems.push(productItem);
      setIsInWishlist(true);
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlistItems));
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-sans">
      <div className="page-container py-8 pb-24 md:pb-8">
        
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
            
            {/* Left: Image Gallery */}
            <div className="p-4 md:p-6 bg-gray-50/50 flex flex-col items-center justify-start relative">
              {/* Product Badges */}
              {productBadges.length > 0 && (
                <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
                  {productBadges.map((badge, index) => (
                    <span
                      key={index}
                      className={`${badge.color} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide shadow-lg`}
                    >
                      {badge.text}
                    </span>
                  ))}
                </div>
              )}
              
              <div 
                className="relative h-[350px] md:h-[400px] w-full max-w-md rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 mb-3 cursor-pointer group"
                onClick={() => {
                  if (product.images && product.images.length > 0) {
                    setIsLightboxOpen(true);
                  }
                }}
              >
                {product.images && product.images.length > 0 ? (
                  <>
                    <div className="relative w-full h-full overflow-hidden">
                      <Image
                        src={product.images[activeImageIndex]}
                        alt={getProductName(product as Product, languageCode)}
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
              
              {/* Thumbnails */}
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full max-w-md px-1">
                  {product.images.map((img, index) => (
                    <div 
                      key={index} 
                      onClick={async () => {
                        setActiveImageIndex(index);
                        // Track click - silently fail if permissions issue
                        if (productId) {
                          try {
                            const { incrementProductClick } = await import('@/lib/firestore/products_db');
                            await incrementProductClick(productId);
                          } catch (err: unknown) {
                            // Silently fail for tracking - don't show error to user
                            const errorObj = err as { message?: string; code?: string };
                            if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
                              // Product click tracking failed due to permissions
                            } else {
                            // Failed to track click
                            }
                          }
                        }
                      }}
                      className={`relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border cursor-pointer transition-all duration-200 ${
                        activeImageIndex === index ? 'border-black ring-1 ring-black scale-105' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`${getProductName(product as Product, languageCode)} ${index}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Product Details - Sticky */}
            <div className="p-4 md:p-6 lg:p-8 flex flex-col justify-start lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              {/* 1. Product Name - Top with Wishlist and Share Icons */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 flex-1">
                  {product?.name ? (getProductName(product as Product, languageCode) || product.name) : (product ? 'Product' : 'Loading...')}
                </h1>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Wishlist Icon */}
                  {contextSettings?.features?.wishlist && (
                    <button
                      onClick={handleToggleWishlist}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                      aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                      title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={isInWishlist ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={1.5}
                        className={`w-6 h-6 ${isInWishlist ? 'text-red-500' : 'text-gray-600 hover:text-red-500'} transition-colors`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Share Icon */}
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                    aria-label="Share product"
                    title="Share product"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 text-gray-600 hover:text-black transition-colors"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* 2. Rating - After Name */}
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
                    {averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? (t('product.review_singular') || 'review') : (t('product.review_plural') || 'reviews')})
                  </span>
                )}
                {averageRating === 0 && reviewCount === 0 && (
                  <span className="text-sm text-gray-400">{t('product.no_reviews_yet') || 'No reviews yet'}</span>
                )}
              </div>
              
              {/* 3. Price and Discounted Price */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  {hasDiscount ? (
                    <>
                      <span className="text-2xl font-bold text-black">{formatPrice(displayPrice)} <span className="text-base font-medium text-gray-500">{priceCurrency}</span></span>
                      <span className="text-lg text-gray-500 line-through">{formatPrice(originalPrice)} <span className="text-sm">{priceCurrency}</span></span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-black">{formatPrice(displayPrice)} <span className="text-base font-medium text-gray-500">{priceCurrency}</span></span>
                  )}
                </div>
                
                {/* Social Proof */}
                {(viewingCount > 0 || soldToday > 0) && (
                  <div className="flex items-center gap-4 text-xs">
                    {viewingCount > 0 && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="flex -space-x-1">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white"></div>
                          ))}
                        </div>
                        <span>
                          {viewingCount} {viewingCount === 1 ? (t('product.person_viewing') || 'person is') : (t('product.people_viewing_text') || 'people are')} {t('product.viewing_this_product') || 'viewing this product'}
                        </span>
                      </div>
                    )}
                    {soldToday > 0 && (
                      <div className="flex items-center gap-1.5 text-green-600 font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{soldToday} {t('product.sold_today') || 'sold today'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stock Indicator with Urgency */}
              <div className="mb-4 space-y-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${stockInfo.color} bg-opacity-10`}>
                  <div className={`w-2 h-2 rounded-full ${stockInfo.status === 'in_stock' ? 'bg-green-500' : stockInfo.status === 'low_stock' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                  <span>{stockInfo.text}</span>
                  {stockInfo.count !== null && stockInfo.count > 0 && stockInfo.count <= 10 && (
                    <span className="text-xs opacity-75">({stockInfo.count} {t('product.available') || 'available'})</span>
                  )}
                </div>
                
                {/* Urgency Warning for Low Stock */}
                {stockInfo.status === 'low_stock' && stockInfo.count !== null && stockInfo.count > 0 && stockInfo.count <= 5 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <span className="text-xs font-medium text-orange-800">
                      {t('product.hurry_only_left', { count: stockInfo.count }) || `Hurry! Only ${stockInfo.count} left in stock!`}
                    </span>
                  </div>
                )}
              </div>

              {/* Loyalty Points - Only show if enabled */}
              {contextSettings?.payment?.enableLoyaltyPoint && product.loyaltyPoints && product.loyaltyPoints > 0 && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-600">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-yellow-900">
                    {t('product.earn_loyalty_points', { points: product.loyaltyPoints }) || (<>Earn <span className="font-bold">{product.loyaltyPoints}</span> loyalty points on purchase</>)}
                  </span>
                </div>
              )}

              {/* 4. Colors | Size | Quantity */}
              {product && product.variants && Array.isArray(product.variants) && product.variants.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6" key={`variants-${product.id}-${selectedColor || ''}-${selectedSize || ''}`}>
                  {/* Colors Section */}
                  {product.variants.some(v => v.name.toLowerCase() === 'color') && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">{t('product.color') || 'Color'}</h3>
                      <div className="flex gap-2 flex-wrap">
                        {Array.from(new Set(product.variants.filter(v => v.name.toLowerCase() === 'color').map(v => v.value))).map(colorValue => {
                          const colorObj = colors.find(c => c.name === colorValue);
                          const isSelected = selectedColor === colorValue;
                          const colorVariants = product.variants.filter(v => 
                            v.name.toLowerCase() === 'color' && v.value === colorValue
                          );
                          const hasStock = colorVariants.some(v => v.stock > 0);
                          
                          return (
                            <button
                              key={colorValue}
                              onClick={() => setSelectedColor(colorValue)}
                              disabled={!hasStock}
                              className={`
                                w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-200
                                ${isSelected ? 'border-black ring-1 ring-black ring-offset-1' : 'border-gray-200 hover:border-gray-400'}
                                ${!hasStock ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                              `}
                              title={`${(() => {
                                const colorObj = colors.find(c => c.name === colorValue);
                                return colorObj ? getColorName(colorObj, languageCode) : colorValue;
                              })()} ${!hasStock ? `(${t('product.out_of_stock') || 'Out of Stock'})` : ''}`}
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

                  {/* Size Section */}
                  {product.variants.some(v => v.name.toLowerCase() === 'size') && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">{t('product.size_label') || 'Size'}</h3>
                      <div className="flex gap-2 flex-wrap">
                        {Array.from(new Set(product.variants.filter(v => v.name.toLowerCase() === 'size').map(v => v.value))).map(sizeValue => {
                          const isSelected = selectedSize === sizeValue;
                          // Check stock for this size with selected color (if color is selected)
                          let hasStock = true;
                          if (selectedColor) {
                            // Find variants that match both color and size
                            const matchingVariants = product.variants.filter(v => {
                              const matchesColor = v.name.toLowerCase() === 'color' && v.value.toLowerCase() === selectedColor.toLowerCase();
                              const matchesSize = v.name.toLowerCase() === 'size' && v.value.toLowerCase() === sizeValue.toLowerCase();
                              return matchesColor || matchesSize;
                            });
                            // If we have both color and size variants, check if there's stock
                            const colorVariants = matchingVariants.filter(v => v.name.toLowerCase() === 'color');
                            const sizeVariants = matchingVariants.filter(v => v.name.toLowerCase() === 'size');
                            hasStock = sizeVariants.some(v => v.stock > 0) || colorVariants.some(v => v.stock > 0);
                          } else {
                            const sizeVariants = product.variants.filter(v => 
                              v.name.toLowerCase() === 'size' && v.value === sizeValue
                            );
                            hasStock = sizeVariants.some(v => v.stock > 0);
                          }
                          
                          return (
                            <button 
                              key={sizeValue}
                              onClick={() => setSelectedSize(sizeValue)}
                              disabled={!hasStock}
                              className={`
                                px-3 py-1.5 rounded-lg border font-medium text-xs transition-all duration-200
                                ${isSelected ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-black'}
                                ${!hasStock ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                              `}
                              title={`${(() => {
                                const sizeObj = sizes.find(s => s.name === sizeValue);
                                return sizeObj ? getSizeName(sizeObj, languageCode) : sizeValue;
                              })()} ${!hasStock ? `(${t('product.out_of_stock') || 'Out of Stock'})` : ''}`}
                            >
                              {(() => {
                                const sizeObj = sizes.find(s => s.name === sizeValue);
                                return sizeObj ? sizeObj.code : sizeValue;
                              })()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quantity Section */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">{t('product.quantity') || 'Quantity'}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setQuantity(Math.max(1, Math.min(99, val)));
                        }}
                        className="w-16 h-8 text-center text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-medium"
                      />
                      <button
                        onClick={() => setQuantity(Math.min(99, quantity + 1))}
                        disabled={quantity >= 99}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Increase quantity"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}


              {/* 5. Add to Cart and Buy Now Buttons - Desktop */}
              <div className="hidden md:flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAddToCart}
                  disabled={isOutOfStock || needsVariantSelection}
                  style={{
                    backgroundColor: contextSettings?.theme?.colors?.secondaryButton || '#ffffff',
                    color: contextSettings?.theme?.colors?.secondaryButtonText || '#000000',
                    borderColor: contextSettings?.theme?.colors?.primaryButton || '#000000',
                  }}
                  className="flex-1 border-2 px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                  {isOutOfStock ? (t('product.out_of_stock') || 'Out of Stock') : needsVariantSelection ? (t('product.select_variant') || 'Select Variant') : (t('products.add_to_cart') || 'Add to Cart')}
                  </button>
                  <button
                    onClick={handleBuyNow}
                  disabled={isOutOfStock || needsVariantSelection}
                  style={{
                    backgroundColor: contextSettings?.theme?.colors?.primaryButton || '#000000',
                    color: contextSettings?.theme?.colors?.primaryButtonText || '#ffffff',
                  }}
                  className="flex-1 px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 shadow-lg shadow-black/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                  {t('products.buy_now') || 'Buy Now'}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                    </svg>
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

              {/* Product Specifications */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t('product.product_details') || 'Product Details'}</h3>
                <div className="space-y-3">
                  {category && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600">{t('product.category') || 'Category'}</span>
                      <Link href={`/shop?category=${category.slug}`} className="text-sm text-black hover:underline font-medium">
                        {getCategoryName(category, languageCode)}
                      </Link>
                    </div>
                  )}
                  {brand && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600">{t('product.brand') || 'Brand'}</span>
                      <Link href={`/shop?brand=${brand.slug}`} className="text-sm text-black hover:underline font-medium">
                        {getBrandName(brand, languageCode)}
                      </Link>
                    </div>
                  )}
                  {product.variants && product.variants.length > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600">{t('product.available_variants') || 'Available Variants'}</span>
                      <span className="text-sm text-black font-medium">
                        {Array.from(new Set(product.variants.map(v => v.name))).join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedVariant && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600">{t('product.selected_variant') || 'Selected Variant'}</span>
                      <span className="text-sm text-black font-medium">{selectedVariant.value}</span>
                    </div>
                  )}
                  {selectedVariant && selectedVariant.stock !== undefined && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600">{t('product.stock_available') || 'Stock Available'}</span>
                      <span className={`text-sm font-medium ${selectedVariant.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedVariant.stock} {t('product.units') || 'units'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Product Tabs Section */}
        <section className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs Navigation */}
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
              <button
                onClick={() => setActiveTab('size-guide')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'size-guide'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('product.tab_size_guide') || 'Size Guide'}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 md:p-10">
            {activeTab === 'description' && product.description && (
              <div 
                className="quill-content prose prose-lg max-w-none prose-headings:font-heading prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-p:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: getProductDescription(product as Product, languageCode) }}
              />
            )}

            {activeTab === 'reviews' && contextSettings?.features?.productReviews && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <ReviewForm productId={productId} onReviewSubmitted={refreshReviews} />
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <ReviewList productId={productId} reviewsRefreshKey={reviewsRefreshKey} />
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-heading font-bold text-gray-900 mb-3">{t('product.shipping_policy') || 'Shipping Policy'}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t('product.shipping_policy_desc') || 'We offer fast and reliable shipping to all locations. Orders are typically processed within 1-2 business days and delivered within 3-5 business days.'}
                  </p>
                  {contextSettings?.payment?.enableLoyaltyPoint && (
                    <p className="text-sm text-gray-600 mt-2">
                      {t('product.free_shipping_info', { amount: formatPrice(0) }) || 
                       `Free shipping available.`}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-gray-900 mb-3">{t('product.returns_policy') || 'Returns Policy'}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t('product.returns_policy_desc') || 'We offer a 30-day return policy. Items must be unworn, unwashed, and in original packaging with tags attached.'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'size-guide' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  {t('product.size_guide_desc') || 'Find your perfect fit with our comprehensive size guide.'}
                </p>
                <Link
                  href="/size-guide"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
                >
                  {t('product.view_full_size_guide') || 'View Full Size Guide'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
      
      {/* Mobile Sticky Buttons - Bottom */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-4 py-3 safe-area-bottom">
        <div className="flex gap-3 max-w-7xl mx-auto">
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || needsVariantSelection}
            style={{
              backgroundColor: contextSettings?.theme?.colors?.secondaryButton || '#ffffff',
              color: contextSettings?.theme?.colors?.secondaryButtonText || '#000000',
              borderColor: contextSettings?.theme?.colors?.primaryButton || '#000000',
            }}
            className="flex-1 border-2 px-4 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
          >
            {isOutOfStock ? (t('product.out_of_stock') || 'Out of Stock') : needsVariantSelection ? (t('product.select_variant') || 'Select Variant') : (t('products.add_to_cart') || 'Add to Cart')}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={isOutOfStock || needsVariantSelection}
            style={{
              backgroundColor: contextSettings?.theme?.colors?.primaryButton || '#000000',
              color: contextSettings?.theme?.colors?.primaryButtonText || '#ffffff',
            }}
            className="flex-1 px-4 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 shadow-lg shadow-black/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
          >
            {t('products.buy_now') || 'Buy Now'}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image Lightbox */}
      {product && product.images && product.images.length > 0 && (
        <ImageLightbox
          images={product.images}
          currentIndex={activeImageIndex}
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          onNext={() => product && setActiveImageIndex((activeImageIndex + 1) % product.images.length)}
          onPrevious={() => product && setActiveImageIndex((activeImageIndex - 1 + product.images.length) % product.images.length)}
          onThumbnailClick={(index) => setActiveImageIndex(index)}
          productName={getProductName(product as Product, languageCode)}
        />
      )}

      {/* Size Guide Modal */}
      {showSizeGuideModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setShowSizeGuideModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold text-gray-900">{t('product.size_guide') || 'Size Guide'}</h2>
              <button
                onClick={() => setShowSizeGuideModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                {t('product.size_guide_modal_desc') || 'Find your perfect fit with our comprehensive size guide.'}
              </p>
              <Link
                href="/size-guide"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
                onClick={() => setShowSizeGuideModal(false)}
              >
                {t('product.view_full_size_guide') || 'View Full Size Guide'}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Size Chart Modal */}
      {showSizeChart && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setShowSizeChart(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold text-gray-900">{t('product.size_chart') || 'Size Chart'}</h2>
              <button
                onClick={() => setShowSizeChart(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {product && product.variants && product.variants.some(v => v.name.toLowerCase() === 'size') ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">{t('product.size') || 'Size'}</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">{t('product.stock') || 'Stock'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(product.variants.filter(v => v.name.toLowerCase() === 'size').map(v => v.value))).map(sizeValue => {
                        const sizeObj = sizes.find(s => s.name === sizeValue);
                        const sizeVariants = product.variants.filter(v => v.name.toLowerCase() === 'size' && v.value === sizeValue);
                        const totalStock = sizeVariants.reduce((sum, v) => sum + v.stock, 0);
                        return (
                          <tr key={sizeValue} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">{sizeObj ? (sizeObj.code || sizeValue) : sizeValue}</td>
                            <td className="text-center py-3 px-4">
                              <span className={`text-xs font-medium ${totalStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totalStock > 0 ? `${totalStock} ${t('product.in_stock') || 'In Stock'}` : t('product.out_of_stock') || 'Out of Stock'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  {t('product.size_chart_not_available') || 'Size chart not available for this product.'}
                </p>
              )}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link
                  href="/size-guide"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
                  onClick={() => setShowSizeChart(false)}
                >
                  {t('product.view_full_size_guide') || 'View Full Size Guide'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductClient;
