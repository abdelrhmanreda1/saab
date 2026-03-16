'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '@/lib/firestore/products';
import { useSearchParams, useRouter } from 'next/navigation';
import { Category } from '@/lib/firestore/categories';
import { getCategoryWithChildren, buildCategoryTree, CategoryTreeNode } from '@/lib/firestore/categories_db';
import { Brand } from '@/lib/firestore/brands';
import { Collection } from '@/lib/firestore/collections';
import { getChildCollections } from '@/lib/firestore/collections_db';
import { Color, Size } from '@/lib/firestore/attributes';
import { useCurrency } from '../../context/CurrencyContext';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { getAllProductBundles } from '@/lib/firestore/product_bundles_db';
import { ProductBundle } from '@/lib/firestore/product_bundles';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { getProductName, getCategoryName, getColorName, getSizeName } from '@/lib/utils/translations';
import { getSizes } from '@/lib/firestore/attributes_db';
import { getReviewsByProductId } from '@/lib/firestore/reviews_enhanced_db';
import type { Review } from '@/lib/firestore/reviews_enhanced';
import QuickViewModal from '@/components/QuickViewModal';
import { useCart } from '@/context/CartContext';
import SkeletonLoader from '@/components/SkeletonLoader';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';
import { Settings } from '@/lib/firestore/settings';

interface ShopClientProps {
  initialProducts: Product[];
  categories: Category[];
  brands: Brand[];
  collections: Collection[];
  colors: Color[];
  initialSettings?: Settings | null;
}

const ShopClient: React.FC<ShopClientProps> = ({
  initialProducts,
  categories,
  brands,
  collections,
  colors,
  initialSettings,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const { settings } = useSettings();
  const languageCode = currentLanguage?.code || 'en';
  const { formatPrice, defaultCurrency } = useCurrency();
  const searchQuery = searchParams.get('search') || '';
  const categoryParam = searchParams.get('category');
  const brandParam = searchParams.get('brand');
  const collectionParam = searchParams.get('collection');
  
  // Helper to get slug from ID
  const getCategorySlugFromId = (id: string): string | null => {
    const category = categories.find(c => c.id === id);
    return category?.slug || null;
  };
  
  const getBrandSlugFromId = (id: string): string | null => {
    const brand = brands.find(b => b.id === id);
    return brand?.slug || null;
  };
  
  const getCollectionSlugFromId = (id: string): string | null => {
    const collection = collections.find(c => c.id === id);
    return collection?.slug || null;
  };
  
  // Filter only active products
  const activeProducts = useMemo(() => {
    return initialProducts.filter(p => p.isActive !== false);
  }, [initialProducts]);
  
  const [products] = useState<Product[]>(activeProducts);

  const activeGoldPricing =
    settings?.goldPricing?.enabled ? settings.goldPricing : initialSettings?.goldPricing;

  const activeGoldCache =
    settings?.goldPricing?.cache?.pricePerGram && Number(settings.goldPricing.cache.pricePerGram) > 0
      ? settings.goldPricing.cache
      : initialSettings?.goldPricing?.cache;

  const getPricing = (product: Product) =>
    getProductPricingSummary(product, activeGoldPricing, activeGoldCache);
  
  // Convert URL params (slugs) to category/brand IDs
  const getCategoryIdFromSlug = (slug: string): string | null => {
    const category = categories.find(c => c.slug === slug);
    return category?.id || null;
  };
  
  const getBrandIdFromSlug = (slug: string): string | null => {
    const brand = brands.find(b => b.slug === slug);
    return brand?.id || null;
  };
  
  const getCollectionIdFromSlug = (slug: string): string | null => {
    const collection = collections.find(c => c.slug === slug);
    return collection?.id || null;
  };
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (categoryParam) {
      const categoryId = getCategoryIdFromSlug(categoryParam);
      return categoryId ? [categoryId] : [];
    }
    return [];
  });
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => {
    if (brandParam) {
      const brandId = getBrandIdFromSlug(brandParam);
      return brandId ? [brandId] : [];
    }
    return [];
  });
  
  const [selectedCollections, setSelectedCollections] = useState<string[]>(() => {
    if (collectionParam) {
      const collectionId = getCollectionIdFromSlug(collectionParam);
      return collectionId ? [collectionId] : [];
    }
    return [];
  });
  
  // Calculate dynamic price range from products
  const calculatedPriceRange = useMemo(() => {
    if (activeProducts.length === 0) return { min: 0, max: 100000 };
    const prices = activeProducts.map(p => getPricing(p).currentPrice);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices))
    };
  }, [activeProducts, activeGoldPricing, activeGoldCache]);

  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>(calculatedPriceRange);
  const [sortOption, setSortOption] = useState<string>('newest');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [onSaleOnly, setOnSaleOnly] = useState<boolean>(false);
  const [featuredOnly, setFeaturedOnly] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, setActiveBundles] = useState<ProductBundle[]>([]);
  const [, setActiveFlashSales] = useState<unknown[]>([]);
  const [, setFlashSaleProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [reviewStats, setReviewStats] = useState<Record<string, { averageRating: number; reviewCount: number }>>({});
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const { addToCart, setShowCartDialog, setCartDialogMessage } = useCart();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [productsPerPage, setProductsPerPage] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSizes().then(setSizes).catch(() => {
      // Failed to fetch sizes
    });
    
    // Fetch bundles and flash sales
    const fetchPromotions = async () => {
      if (!settings?.features?.productBundles) return;
      
      try {
        const [bundles, flashSales] = await Promise.all([
          getAllProductBundles(true),
          getAllFlashSales(true)
        ]);
        
        const now = new Date();
        
        // Filter active bundles
        const validBundles = bundles.filter(bundle => {
          if (!bundle.isActive) return false;
          if (bundle.validFrom && bundle.validFrom.toDate && bundle.validFrom.toDate() > now) return false;
          if (bundle.validUntil && bundle.validUntil.toDate && bundle.validUntil.toDate() < now) return false;
          return true;
        });
        setActiveBundles(validBundles.slice(0, 6));
        
        // Filter flash sales
        const validFlashSales = flashSales.filter(sale => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        });
        setActiveFlashSales(validFlashSales);
        
        // Get flash sale products
        if (validFlashSales.length > 0) {
          const flashSaleProductIds = new Set<string>();
          validFlashSales.forEach(sale => {
            sale.productIds.forEach(id => flashSaleProductIds.add(id));
          });
          const flashProducts = initialProducts.filter(p => flashSaleProductIds.has(p.id)).slice(0, 8);
          setFlashSaleProducts(flashProducts);
        }
        
      } catch {
        // Failed to fetch promotions
      }
    };
    
    fetchPromotions();
  }, [settings?.features?.productBundles, initialProducts]);

  // Load review statistics (average rating + review count) for products shown on the shop page
  useEffect(() => {
    if (!settings?.features?.productReviews) return;

    const loadReviewStats = async () => {
      try {
        const entries = await Promise.all(
          activeProducts.map(async (product) => {
            try {
              const reviews: Review[] = await getReviewsByProductId(product.id);
              if (!reviews || reviews.length === 0) {
                return [product.id, { averageRating: 0, reviewCount: 0 }] as const;
              }

              const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
              const averageRating = totalRating / reviews.length;

              return [product.id, { averageRating, reviewCount: reviews.length }] as const;
            } catch {
              // Failed to fetch reviews for this product
              return [product.id, { averageRating: 0, reviewCount: 0 }] as const;
            }
          })
        );

        const statsMap: Record<string, { averageRating: number; reviewCount: number }> = {};
        for (const [productId, stats] of entries) {
          statsMap[productId] = stats;
        }
        setReviewStats(statsMap);
      } catch {
        // Failed to load review stats - ignore and keep category display
      }
    };

    if (activeProducts.length > 0) {
      loadReviewStats();
    }
  }, [activeProducts, settings?.features?.productReviews]);

  // Extract unique sizes and colors from products
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    activeProducts.forEach(product => {
      product.variants?.forEach(variant => {
        if (variant.name.toLowerCase() === 'size') {
          sizes.add(variant.value);
        }
      });
    });
    return Array.from(sizes).sort();
  }, [activeProducts]);

  const availableColors = useMemo(() => {
    const colorSet = new Set<string>();
    activeProducts.forEach(product => {
      product.variants?.forEach(variant => {
        if (variant.name.toLowerCase() === 'color') {
          colorSet.add(variant.value);
        }
      });
    });
    return Array.from(colorSet).sort();
  }, [activeProducts]);

  // Helper function to get color hex code
  const getColorHex = (colorName: string): string | null => {
    const colorObj = colors.find(c => c.name.toLowerCase() === colorName.toLowerCase());
    return colorObj?.hexCode || null;
  };

  // Update price range when products change
  useEffect(() => {
    setPriceRange(calculatedPriceRange);
  }, [calculatedPriceRange]);

  // Sync URL params (slugs) with filters - Read from URL
  useEffect(() => {
    if (categoryParam) {
      const categoryId = getCategoryIdFromSlug(categoryParam);
      if (categoryId && !selectedCategories.includes(categoryId)) {
        setSelectedCategories([categoryId]);
      }
    }
    if (brandParam) {
      const brandId = getBrandIdFromSlug(brandParam);
      if (brandId && !selectedBrands.includes(brandId)) {
        setSelectedBrands([brandId]);
      }
    }
    if (collectionParam) {
      const collectionId = getCollectionIdFromSlug(collectionParam);
      if (collectionId && !selectedCollections.includes(collectionId)) {
        setSelectedCollections([collectionId]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam, brandParam, collectionParam, categories, brands, collections]);

  // Update URL when filters change - Write to URL
  useEffect(() => {
    // Skip if this is the initial load (when URL params are being read)
    if (!categoryParam && !brandParam && !collectionParam && selectedCategories.length === 0 && selectedBrands.length === 0 && selectedCollections.length === 0) {
      return;
    }
    
    const params = new URLSearchParams();
    
    // Add search query
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    
    // Add category slug (use first selected category)
    if (selectedCategories.length > 0) {
      const categorySlug = getCategorySlugFromId(selectedCategories[0]);
      if (categorySlug) {
        params.set('category', categorySlug);
      }
    }
    
    // Add brand slug (use first selected brand)
    if (selectedBrands.length > 0) {
      const brandSlug = getBrandSlugFromId(selectedBrands[0]);
      if (brandSlug) {
        params.set('brand', brandSlug);
      }
    }
    
    // Add collection slug (use first selected collection)
    if (selectedCollections.length > 0) {
      const collectionSlug = getCollectionSlugFromId(selectedCollections[0]);
      if (collectionSlug) {
        params.set('collection', collectionSlug);
      }
    }
    
    // Update URL without page reload
    const newUrl = params.toString() ? `/shop?${params.toString()}` : '/shop';
    const currentUrl = window.location.pathname + (window.location.search || '');
    
    // Only update if URL actually changed to avoid infinite loops
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, selectedBrands, selectedCollections, searchQuery, router, categories, brands, collections, categoryParam, brandParam, collectionParam]);

  const filteredProducts = useMemo(() => {
    let tempProducts = [...products];

    // Search Filter - Search in name, description, colors, sizes, category, brand
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase().trim();
        tempProducts = tempProducts.filter(p => {
          // Search in product name
          if (p.name.toLowerCase().includes(lowerQuery)) return true;
          
          // Search in product description
          if (p.description && p.description.toLowerCase().includes(lowerQuery)) return true;
          
          // Search in category name
          const categoryObj = categories.find(c => c.id === p.category);
          if (categoryObj && categoryObj.name.toLowerCase().includes(lowerQuery)) return true;
          
          // Search in brand name
          if (p.brandId) {
            const brandObj = brands.find(b => b.id === p.brandId);
            if (brandObj && brandObj.name.toLowerCase().includes(lowerQuery)) return true;
          }
          
          // Search in variant colors
          if (p.variants && p.variants.length > 0) {
            const hasMatchingColor = p.variants.some(v => {
              if (v.name.toLowerCase() === 'color') {
                return v.value.toLowerCase().includes(lowerQuery);
              }
              return false;
            });
            if (hasMatchingColor) return true;
            
            // Search in variant sizes
            const hasMatchingSize = p.variants.some(v => {
              if (v.name.toLowerCase() === 'size') {
                return v.value.toLowerCase().includes(lowerQuery);
              }
              return false;
            });
            if (hasMatchingSize) return true;
            
            // Search in any variant value
            const hasMatchingVariant = p.variants.some(v => 
              v.value.toLowerCase().includes(lowerQuery)
            );
            if (hasMatchingVariant) return true;
          }
          
          return false;
        });
    }

    // Category Filter (include child categories)
    if (selectedCategories.length > 0) {
      // Get all category IDs including parent and children
      const allCategoryIds = new Set<string>();
      selectedCategories.forEach(catId => {
        const categoryIds = getCategoryWithChildren(catId, categories);
        categoryIds.forEach(id => allCategoryIds.add(id));
      });
      
      tempProducts = tempProducts.filter(product => allCategoryIds.has(product.category));
    }

    // Brand Filter
    if (selectedBrands.length > 0) {
      tempProducts = tempProducts.filter(product => product.brandId && selectedBrands.includes(product.brandId));
    }

    // Collection Filter (include child collections)
    if (selectedCollections.length > 0) {
      const allCollectionIds = new Set<string>();
      selectedCollections.forEach(collectionId => {
        allCollectionIds.add(collectionId);
        // Get child collections recursively
        const childIds = getChildCollections(collectionId, collections);
        childIds.forEach(id => allCollectionIds.add(id));
      });
      
      tempProducts = tempProducts.filter(product => 
        product.collectionId && allCollectionIds.has(product.collectionId)
      );
    }

    // Price Filter
    tempProducts = tempProducts.filter(product => {
      const pricing = getPricing(product);
      return pricing.currentPrice >= priceRange.min && pricing.currentPrice <= priceRange.max;
    });

    // Stock Filter
    if (inStockOnly) {
      tempProducts = tempProducts.filter(product => {
        if (product.variants && product.variants.length > 0) {
           return product.variants.some(v => v.stock > 0);
        }
        return true; 
      });
    }

    // Size Filter
    if (selectedSizes.length > 0) {
      tempProducts = tempProducts.filter(product => {
        return product.variants?.some(v => 
          v.name.toLowerCase() === 'size' && selectedSizes.includes(v.value)
        );
      });
    }

    // Color Filter
    if (selectedColors.length > 0) {
      tempProducts = tempProducts.filter(product => {
        return product.variants?.some(v => 
          v.name.toLowerCase() === 'color' && selectedColors.includes(v.value)
        );
      });
    }

    // Sale Filter
    if (onSaleOnly) {
      tempProducts = tempProducts.filter(product => {
        return getPricing(product).hasDiscount;
      });
    }

    // Featured Filter
    if (featuredOnly) {
      tempProducts = tempProducts.filter(product => product.isFeatured === true);
    }

    // Sorting
    switch (sortOption) {
      case 'price-asc':
        tempProducts.sort((a, b) => getPricing(a).currentPrice - getPricing(b).currentPrice);
        break;
      case 'price-desc':
        tempProducts.sort((a, b) => getPricing(b).currentPrice - getPricing(a).currentPrice);
        break;
      case 'name-asc':
        tempProducts.sort((a, b) => getProductName(a, languageCode).localeCompare(getProductName(b, languageCode)));
        break;
      case 'name-desc':
        tempProducts.sort((a, b) => getProductName(b, languageCode).localeCompare(getProductName(a, languageCode)));
        break;
      case 'popular':
        tempProducts.sort((a, b) => {
          const aViews = a.analytics?.views || 0;
          const aPurchases = a.analytics?.purchases || 0;
          const aPopularity = aViews + (aPurchases * 10); // Purchases weighted more
          
          const bViews = b.analytics?.views || 0;
          const bPurchases = b.analytics?.purchases || 0;
          const bPopularity = bViews + (bPurchases * 10);
          
          return bPopularity - aPopularity;
        });
        break;
      case 'rating':
        tempProducts.sort((a, b) => {
          const aRating = reviewStats[a.id]?.averageRating || 0;
          const aCount = reviewStats[a.id]?.reviewCount || 0;
          const bRating = reviewStats[b.id]?.averageRating || 0;
          const bCount = reviewStats[b.id]?.reviewCount || 0;
          
          // Sort by rating first, then by review count
          if (bRating !== aRating) {
            return bRating - aRating;
          }
          return bCount - aCount;
        });
        break;
      case 'newest':
      default:
        tempProducts.sort((a, b) => {
            // Handle both Timestamp objects and serialized timestamps
            let timeA = 0;
            if (a.createdAt) {
              if (typeof a.createdAt === 'object' && 'seconds' in a.createdAt) {
                timeA = a.createdAt.seconds;
              } else if (typeof a.createdAt === 'object' && 'toDate' in a.createdAt && typeof (a.createdAt as { toDate: () => Date }).toDate === 'function') {
                timeA = Math.floor((a.createdAt as { toDate: () => Date }).toDate().getTime() / 1000);
              }
            }
            
            let timeB = 0;
            if (b.createdAt) {
              if (typeof b.createdAt === 'object' && 'seconds' in b.createdAt) {
                timeB = b.createdAt.seconds;
              } else if (typeof b.createdAt === 'object' && 'toDate' in b.createdAt && typeof (b.createdAt as { toDate: () => Date }).toDate === 'function') {
                timeB = Math.floor((b.createdAt as { toDate: () => Date }).toDate().getTime() / 1000);
              }
            }
            
            return timeB - timeA;
        });
        break;
    }

    return tempProducts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, selectedBrands, selectedCollections, selectedSizes, selectedColors, products, searchQuery, priceRange, inStockOnly, onSaleOnly, featuredOnly, sortOption, collections]);

  // Pagination logic
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, selectedBrands, selectedCollections, selectedSizes, selectedColors, priceRange, inStockOnly, onSaleOnly, featuredOnly, searchQuery, sortOption]);

  // Loading state simulation
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [filteredProducts]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    // Make all sections visible immediately
    const allSections = document.querySelectorAll('[data-section-id]');
    const allSectionIds = Array.from(allSections).map(section => section.getAttribute('data-section-id')).filter(Boolean) as string[];
    if (allSectionIds.length > 0) {
      setVisibleSections(new Set(allSectionIds));
    }

    const observerOptions = {
      root: null,
      rootMargin: '-50px 0px',
      threshold: 0.1,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setVisibleSections((prev) => {
              // Only update if section is not already visible
              if (prev.has(sectionId)) {
                return prev;
              }
              return new Set(prev).add(sectionId);
            });
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // Use requestAnimationFrame to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => observer.observe(section));
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => observer.unobserve(section));
    };
  }, [filteredProducts.length]); // Only depend on length, not the array itself

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId) 
        : [...prev, categoryId]
    );
  };

  const handleBrandChange = (brandId: string) => {
    setSelectedBrands(prev => 
      prev.includes(brandId) 
        ? prev.filter(id => id !== brandId) 
        : [...prev, brandId]
    );
  };


  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedCollections([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceRange(calculatedPriceRange);
    setInStockOnly(false);
    setOnSaleOnly(false);
    setFeaturedOnly(false);
    setSortOption('newest');
    router.push('/shop');
  };

  const activeFiltersCount = selectedCategories.length + selectedBrands.length + selectedCollections.length + selectedSizes.length + selectedColors.length + (inStockOnly ? 1 : 0) + (onSaleOnly ? 1 : 0) + (featuredOnly ? 1 : 0) + (priceRange.min > calculatedPriceRange.min || priceRange.max < calculatedPriceRange.max ? 1 : 0);

  // Get current category/collection for banner
  const currentCategory = categoryParam ? categories.find(c => c.slug === categoryParam) : null;
  const currentCollection = collectionParam ? collections.find(c => c.slug === collectionParam) : null;

  // Product Card Component
  const ProductCard = ({
    product,
    isFeaturedLarge = false,
    prioritizeImage = false,
  }: {
    product: Product;
    isFeaturedLarge?: boolean;
    prioritizeImage?: boolean;
  }) => {
    const categoryName = categories.find(c => c.id === product.category)?.name;
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [hoveredColor, setHoveredColor] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
      const stored = localStorage.getItem('wishlist');
      if (stored) {
        const wishlistItems = JSON.parse(stored);
        setIsInWishlist(wishlistItems.some((item: { id: string }) => item.id === product.id));
      }
    }, [product.id]);

    const getStockStatus = () => {
      if (product.variants && product.variants.length > 0) {
        const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
        if (totalStock > 10) return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'bg-green-500' };
        if (totalStock > 0) return { status: 'low_stock', text: t('product.low_stock') || 'Low Stock', color: 'bg-yellow-500' };
        return { status: 'out_of_stock', text: t('product.out_of_stock') || 'Out of Stock', color: 'bg-red-500' };
      }
      return { status: 'in_stock', text: t('product.in_stock') || 'In Stock', color: 'bg-green-500' };
    };

    const stockInfo = getStockStatus();
    const isNew = product.createdAt && typeof product.createdAt === 'object' && 'toDate' in product.createdAt 
      ? (Date.now() - product.createdAt.toDate().getTime()) < 30 * 24 * 60 * 60 * 1000
      : false;
    const pricing = getPricing(product);
    const isOnSale = pricing.hasDiscount;
    const isBestSeller = (product.analytics?.purchases || 0) > 50;

    const colorVariants = product.variants?.filter(v => v.name.toLowerCase() === 'color') || [];
    const displayImage = hoveredColor && colorVariants.length > 0
      ? colorVariants.find(v => v.value.toLowerCase() === hoveredColor.toLowerCase())?.imageUrl || product.images?.[0]
      : product.images?.[0];

    const handleToggleWishlist = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!mounted) return;
      
      const stored = localStorage.getItem('wishlist');
      let wishlistItems: Array<{ id: string; name: string; price: number; image?: string; inStock: boolean; slug?: string }> = stored ? JSON.parse(stored) : [];
      
      const productItem = {
        id: product.id,
        name: getProductName(product, languageCode),
        price: pricing.currentPrice,
        image: product.images?.[0],
        inStock: stockInfo.status !== 'out_of_stock',
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

    const handleQuickView = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setQuickViewProduct(product);
    };

    const handleQuickAdd = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (stockInfo.status === 'out_of_stock') return;
      addToCart({ ...product, price: pricing.currentPrice, salePrice: undefined }, 1);
      setCartDialogMessage(t('cart.added_to_cart') || 'Added to cart');
      setShowCartDialog(true);
    };

  return (
      <div className={`group relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-gray-300 shadow-lg hover:shadow-xl ${isFeaturedLarge ? 'md:h-full' : ''}`}>
        <Link 
          href={`/products/${product.slug}`} 
          className="absolute inset-0 z-10"
          aria-label={t('home.view_product', { name: getProductName(product, languageCode) }) || `View product: ${getProductName(product, languageCode)}`}
          onClick={async () => {
            try {
              const { incrementProductClick } = await import('@/lib/firestore/products_db');
              await incrementProductClick(product.id);
            } catch {
              // Failed to track click
            }
          }}
        />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
          {isNew && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">
              {t('product.badge_new') || 'New'}
            </span>
          )}
          {isOnSale && (
            <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">
              {t('product.badge_sale') || 'Sale'}
            </span>
          )}
          {isBestSeller && (
            <span className="bg-purple-700 text-white text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">
              {t('product.badge_best_seller') || 'Best Seller'}
            </span>
          )}
        </div>

        {/* Stock Indicator */}
        {stockInfo.status !== 'in_stock' && (
          <div className="absolute top-3 right-3 z-20">
            <span className={`${stockInfo.color} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide`}>
              {stockInfo.text}
            </span>
          </div>
        )}

        {/* Image Container */}
        <div
          className={`relative w-full overflow-hidden bg-gray-50 ${isFeaturedLarge ? 'aspect-[3/4] md:aspect-square' : 'aspect-[3/4]'}`}
        >
          {displayImage ? (
            <Image
              src={displayImage}
              alt={getProductName(product, languageCode)}
              width={800}
              height={1067}
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
              sizes={isFeaturedLarge ? "(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw" : "(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 25vw"}
              priority={prioritizeImage}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <span className="text-xs uppercase tracking-widest">No Image</span>
            </div>
          )}

          {/* Action Buttons - Touch-friendly */}
          <div className="absolute bottom-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button 
              onClick={handleQuickView}
              className="bg-white/95 backdrop-blur-sm p-3 md:p-2.5 rounded-full shadow-md hover:bg-gray-900 hover:text-white active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
              title={t('product.quick_view') || 'Quick View'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 md:w-4 md:h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button 
              onClick={handleQuickAdd}
              disabled={stockInfo.status === 'out_of_stock'}
              className="bg-white/95 backdrop-blur-sm p-3 md:p-2.5 rounded-full shadow-md hover:bg-gray-900 hover:text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
              title={t('product.quick_add') || 'Quick Add'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 md:w-4 md:h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            {settings?.features?.wishlist && (
              <button 
                onClick={handleToggleWishlist}
                className={`backdrop-blur-sm p-3 md:p-2.5 rounded-full shadow-md transition-all active:scale-95 ${
                  isInWishlist
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white/95 hover:bg-gray-900 hover:text-white'
                } touch-manipulation min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center`}
                title={isInWishlist ? (t('product.remove_from_wishlist') || 'Remove from Wishlist') : (t('product.add_to_wishlist') || 'Add to Wishlist')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill={isInWishlist ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 md:w-4 md:h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            )}
          </div>

          {/* Color Swatches */}
          {colorVariants.length > 0 && (
            <div className="absolute bottom-3 left-3 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {colorVariants.slice(0, 4).map((variant) => {
                const color = colors.find(c => c.name.toLowerCase() === variant.value.toLowerCase());
                return (
                  <button
                    key={variant.id}
                    onMouseEnter={() => setHoveredColor(variant.value)}
                    onMouseLeave={() => setHoveredColor(null)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      hoveredColor === variant.value
                        ? 'border-gray-900 scale-110'
                        : 'border-white shadow-md'
                    }`}
                    style={{ backgroundColor: color?.hexCode || '#ccc' }}
                    title={color ? getColorName(color, languageCode) : variant.value}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  />
                );
              })}
              {colorVariants.length > 4 && (
                <span className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-600 shadow-md">
                  +{colorVariants.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        <div className={`p-3 md:p-4 ${isFeaturedLarge ? 'md:p-6' : ''}`}>
          <h3 className={`font-semibold text-gray-900 truncate ${isFeaturedLarge ? 'text-base md:text-xl lg:text-2xl' : 'text-sm md:text-base lg:text-lg'}`}>
            {searchQuery ? (
              <span dangerouslySetInnerHTML={{
                __html: getProductName(product, languageCode).replace(
                  new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                  '<mark class="bg-yellow-200 text-gray-900 px-0.5 rounded">$1</mark>'
                )
              }} />
            ) : (
              getProductName(product, languageCode)
            )}
          </h3>
          <div className="mt-1">
            {settings?.features?.productReviews &&
            reviewStats[product.id] &&
            reviewStats[product.id].reviewCount > 0 ? (
              <div className="flex items-center gap-1">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const rating = reviewStats[product.id].averageRating || 0;
                    const roundedRating = Math.round(rating);
                    const isFilled = index < roundedRating;
                    return (
                      <svg
                        key={index}
                        className={`w-3 h-3 md:w-4 md:h-4 ${
                          isFilled ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    );
                  })}
                </div>
                <span className="text-[10px] md:text-xs text-gray-600 font-medium">
                  ({reviewStats[product.id].reviewCount} {t('product.reviews') || 'reviews'})
                </span>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-gray-600 mt-1 truncate font-medium">
                {categoryName || t('product.collection') || 'Collection'}
              </p>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            {pricing.originalPrice !== null && (
              <span className="text-sm md:text-base text-gray-500 line-through font-medium">
                {formatPrice(pricing.originalPrice)}
              </span>
            )}
            <span className="text-sm md:text-base lg:text-lg font-bold text-gray-900">
              {formatPrice(pricing.currentPrice)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Full-width Category/Collection Banner */}
      {(currentCategory || currentCollection) && (
        <section 
          data-section-id="banner"
          className={`w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 py-12 md:py-16 border-b border-gray-200 transition-all duration-700 ${
            visibleSections.has('banner') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="page-container">
            {currentCategory && (
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {currentCategory.imageUrl && (
                  <div className="relative w-full md:w-48 h-48 md:h-48 rounded-2xl overflow-hidden flex-shrink-0">
                    <Image
                      src={currentCategory.imageUrl}
                      alt={getCategoryName(currentCategory, languageCode)}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
                    {getCategoryName(currentCategory, languageCode)}
                  </h1>
                  {currentCategory.description && (
                    <p className="text-base md:text-lg lg:text-xl text-gray-700 max-w-2xl leading-relaxed">
                      {currentCategory.description}
                    </p>
                  )}
                </div>
              </div>
            )}
            {currentCollection && (
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {currentCollection.imageUrl && (
                  <div className="relative w-full md:w-48 h-48 md:h-48 rounded-2xl overflow-hidden flex-shrink-0">
                    <Image
                      src={currentCollection.imageUrl}
                      alt={currentCollection.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
                    {currentCollection.name}
                  </h1>
                  {currentCollection.description && (
                    <p className="text-base md:text-lg lg:text-xl text-gray-700 max-w-2xl leading-relaxed">
                      {currentCollection.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Content Container */}
      <div className="page-container pt-2 md:pt-3 pb-8 md:pb-12">
        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-3 md:mb-4" />
      {/* Mobile Filter & Sort Bar */}
      <div className="md:hidden mb-6 flex justify-between items-center bg-white p-4 sticky top-20 z-30 shadow-sm border-b border-gray-100">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 font-medium text-sm uppercase tracking-wide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          {t('shop.filters') || 'Filters'} {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </button>
        <select 
            value={sortOption} 
            onChange={(e) => setSortOption(e.target.value)}
            className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
        >
            <option value="newest">{t('shop.sort_newest') || 'Newest'}</option>
            <option value="price-asc">{t('shop.sort_price_asc') || 'Price: Low to High'}</option>
            <option value="price-desc">{t('shop.sort_price_desc') || 'Price: High to Low'}</option>
            <option value="name-asc">{t('shop.sort_name_asc') || 'Name: A to Z'}</option>
            <option value="name-desc">{t('shop.sort_name_desc') || 'Name: Z to A'}</option>
        </select>
      </div>

        <div className="flex flex-col md:flex-row gap-8 md:gap-12 relative">
        {/* Sidebar Filters - Sticky Desktop */}
        <aside className={`w-full md:w-64 flex-shrink-0 bg-white p-6 md:p-6 fixed md:sticky top-0 md:top-24 left-0 h-screen md:h-[calc(100vh-6rem)] z-50 md:z-10 overflow-y-auto md:overflow-y-auto transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} shadow-2xl md:shadow-lg border-r border-gray-200`}>
          <div className="flex justify-between items-center mb-8 md:hidden">
            <h2 className="text-xl font-heading font-bold text-black">{t('shop.filters') || 'Filters'}</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-black">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <h3 className="font-heading font-bold text-xl text-black">{t('shop.filters') || 'Filters'}</h3>
                {activeFiltersCount > 0 && (
                    <button onClick={clearFilters} className="text-xs font-medium text-gray-500 hover:text-black underline underline-offset-2 transition-colors">
                        {t('shop.clear_all_filters') || 'Clear All'} ({activeFiltersCount})
                    </button>
                )}
            </div>

            {/* Price Range */}
            <div className="border-b border-gray-200 pb-5">
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">{t('shop.price_range') || 'Price Range'}</h4>
                
                {/* Range Slider - Enhanced Visual */}
                <div className="mb-4">
                    <div className="relative h-3 bg-gray-200 rounded-full">
                        <div 
                            className="absolute h-3 bg-gradient-to-r from-gray-900 to-gray-700 rounded-full"
                            style={{
                                left: `${((priceRange.min - calculatedPriceRange.min) / (calculatedPriceRange.max - calculatedPriceRange.min)) * 100}%`,
                                width: `${((priceRange.max - priceRange.min) / (calculatedPriceRange.max - calculatedPriceRange.min)) * 100}%`
                            }}
                        />
                        <input
                            type="range"
                            min={calculatedPriceRange.min}
                            max={calculatedPriceRange.max}
                            value={priceRange.min}
                            onChange={(e) => {
                                const newMin = Number(e.target.value);
                                if (newMin <= priceRange.max) {
                                    setPriceRange(prev => ({ ...prev, min: newMin }));
                                }
                            }}
                            className="absolute w-full h-3 bg-transparent appearance-none cursor-pointer"
                            style={{
                                zIndex: priceRange.min > calculatedPriceRange.min ? 2 : 1
                            }}
                        />
                        <input
                            type="range"
                            min={calculatedPriceRange.min}
                            max={calculatedPriceRange.max}
                            value={priceRange.max}
                            onChange={(e) => {
                                const newMax = Number(e.target.value);
                                if (newMax >= priceRange.min) {
                                    setPriceRange(prev => ({ ...prev, max: newMax }));
                                }
                            }}
                            className="absolute w-full h-3 bg-transparent appearance-none cursor-pointer"
                            style={{
                                zIndex: priceRange.max < calculatedPriceRange.max ? 2 : 1
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-sm font-medium text-gray-700 mt-3">
                        <span>{formatPrice(priceRange.min)}</span>
                        <span>{formatPrice(priceRange.max)}</span>
                    </div>
                </div>

                {/* Input Fields */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{defaultCurrency?.symbol || ''}</span>
                        <input 
                            type="number" 
                            value={priceRange.min}
                            onChange={(e) => {
                                const newMin = Number(e.target.value);
                                if (newMin >= calculatedPriceRange.min && newMin <= priceRange.max) {
                                    setPriceRange(prev => ({ ...prev, min: newMin }));
                                }
                            }}
                            className="w-full pl-10 pr-2 py-2 border border-gray-200 rounded-md text-sm bg-white text-black focus:border-black focus:outline-none transition-colors"
                            placeholder={t('shop.min') || 'Min'}
                            min={calculatedPriceRange.min}
                            max={priceRange.max}
                        />
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{defaultCurrency?.symbol || ''}</span>
                        <input 
                            type="number" 
                            value={priceRange.max}
                            onChange={(e) => {
                                const newMax = Number(e.target.value);
                                if (newMax <= calculatedPriceRange.max && newMax >= priceRange.min) {
                                    setPriceRange(prev => ({ ...prev, max: newMax }));
                                }
                            }}
                            className="w-full pl-10 pr-2 py-2 border border-gray-200 rounded-md text-sm bg-white text-black focus:border-black focus:outline-none transition-colors"
                            placeholder={t('shop.max') || 'Max'}
                            min={priceRange.min}
                            max={calculatedPriceRange.max}
                        />
                    </div>
                </div>
            </div>

            {/* Availability */}
            <div className="border-b border-gray-200 pb-5">
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">{t('shop.availability') || 'Availability'}</h4>
                <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${inStockOnly ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                        {inStockOnly && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>
                    <input 
                        type="checkbox" 
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="hidden"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-black transition-colors">{t('shop.in_stock_only') || 'In Stock Only'}</span>
                </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${onSaleOnly ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                            {onSaleOnly && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                        <input 
                            type="checkbox" 
                            checked={onSaleOnly}
                            onChange={(e) => setOnSaleOnly(e.target.checked)}
                            className="hidden"
                        />
                        <span className="text-sm text-gray-600 group-hover:text-black transition-colors">{t('shop.on_sale') || 'On Sale'}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${featuredOnly ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                            {featuredOnly && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                        <input 
                            type="checkbox" 
                            checked={featuredOnly}
                            onChange={(e) => setFeaturedOnly(e.target.checked)}
                            className="hidden"
                        />
                        <span className="text-sm text-gray-600 group-hover:text-black transition-colors">{t('shop.featured_only') || 'Featured Only'}</span>
                    </label>
                </div>
            </div>

            {/* Categories */}
            {settings?.features?.category && (
              <div className="border-b border-gray-200 pb-5">
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">Categories</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {(() => {
                        const categoryTree = buildCategoryTree(categories);
                        const renderCategory = (category: CategoryTreeNode, level: number = 0) => (
                            <div key={category.id}>
                                <label className={`flex items-center gap-3 cursor-pointer group ${level > 0 ? 'ml-6' : ''}`}>
                                    <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${selectedCategories.includes(category.id) ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                                        {selectedCategories.includes(category.id) && (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedCategories.includes(category.id)}
                                        onChange={() => handleCategoryChange(category.id)}
                                        className="hidden"
                                    />
                                    <span className="text-sm text-gray-600 group-hover:text-black transition-colors">
                                        {level > 0 && <span className="text-gray-400 mr-1">└─</span>}
                                        {getCategoryName(category, languageCode)}
                                    </span>
                                </label>
                                {category.children && category.children.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        {category.children.map(child => renderCategory(child, level + 1))}
                                    </div>
                                )}
                            </div>
                        );
                        return categoryTree.map(cat => renderCategory(cat, 0));
                    })()}
                </div>
              </div>
            )}

            {/* Sizes */}
            {settings?.features?.size && availableSizes.length > 0 && (
                <div className="border-b border-gray-200 pb-5">
                    <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">Size</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {availableSizes.map(size => (
                            <label key={size} className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${selectedSizes.includes(size) ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                                    {selectedSizes.includes(size) && (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={selectedSizes.includes(size)}
                                    onChange={() => {
                                        setSelectedSizes(prev => 
                                            prev.includes(size) 
                                                ? prev.filter(s => s !== size) 
                                                : [...prev, size]
                                        );
                                    }}
                                    className="hidden"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-black transition-colors">
                                  {(() => {
                                    const sizeObj = sizes.find(s => s.name === size);
                                    return sizeObj ? getSizeName(sizeObj, languageCode) : size;
                                  })()}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Colors - Swatch Chips */}
            {settings?.features?.colors && availableColors.length > 0 && (
                <div className="border-b border-gray-200 pb-5">
                    <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">Color</h4>
                    <div className="flex flex-wrap gap-2.5">
                        {availableColors.map(colorName => {
                            const hexCode = getColorHex(colorName);
                            const isSelected = selectedColors.includes(colorName);
                            const colorObj = colors.find(c => c.name === colorName);
                            return (
                                <button
                                    key={colorName}
                                    onClick={() => {
                                        setSelectedColors(prev => 
                                            prev.includes(colorName) 
                                                ? prev.filter(c => c !== colorName) 
                                                : [...prev, colorName]
                                        );
                                    }}
                                    className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all touch-manipulation ${
                                        isSelected 
                                            ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2 scale-110' 
                                            : 'border-gray-300 hover:border-gray-400 hover:scale-105'
                                    }`}
                                    style={{ 
                                        backgroundColor: hexCode || '#e5e7eb',
                                        boxShadow: hexCode ? `0 2px 6px rgba(0,0,0,0.15)` : 'none'
                                    }}
                                    title={colorObj ? getColorName(colorObj, languageCode) : colorName}
                                >
                                    {isSelected && (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white drop-shadow-lg">
                                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {/* Color Names Below (Optional) */}
                    {selectedColors.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {selectedColors.map(colorName => {
                                const colorObj = colors.find(c => c.name === colorName);
                                return (
                                    <span key={colorName} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                        {colorObj ? getColorName(colorObj, languageCode) : colorName}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Collections */}
            {settings?.features?.collections && collections.length > 0 && (
              <div className="border-b border-gray-200 pb-5">
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">Collections</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {collections.filter(c => !c.parentCollection).map(collection => (
                    <label key={collection.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${selectedCollections.includes(collection.id) ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                        {selectedCollections.includes(collection.id) && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={selectedCollections.includes(collection.id)}
                        onChange={() => {
                          setSelectedCollections(prev => 
                            prev.includes(collection.id) 
                              ? prev.filter(id => id !== collection.id) 
                              : [...prev, collection.id]
                          );
                        }}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-black transition-colors">{collection.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Brands */}
            {settings?.features?.brands && (
              <div className="border-b border-gray-200 pb-5 last:border-b-0">
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-black">Brands</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {brands.map(brand => (
                        <label key={brand.id} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${selectedBrands.includes(brand.id) ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-400'}`}>
                                {selectedBrands.includes(brand.id) && (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <input 
                                type="checkbox" 
                                checked={selectedBrands.includes(brand.id)}
                                onChange={() => handleBrandChange(brand.id)}
                                className="hidden"
                            />
                            <span className="text-sm text-gray-600 group-hover:text-black transition-colors">{brand.name}</span>
                        </label>
                    ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Product Grid */}
        <main className="flex-grow">
            {/* Active Filters Chips */}
            {activeFiltersCount > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2 pb-4 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700 mr-2">{t('shop.active_filters') || 'Active Filters:'}</span>
                {selectedCategories.map(catId => {
                  const category = categories.find(c => c.id === catId);
                  if (!category) return null;
                  return (
                    <button
                      key={catId}
                      onClick={() => handleCategoryChange(catId)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      {getCategoryName(category, languageCode)}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  );
                })}
                {selectedBrands.map(brandId => {
                  const brand = brands.find(b => b.id === brandId);
                  if (!brand) return null;
                  return (
                    <button
                      key={brandId}
                      onClick={() => handleBrandChange(brandId)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      {brand.name}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  );
                })}
                {selectedCollections.map(collectionId => {
                  const collection = collections.find(c => c.id === collectionId);
                  if (!collection) return null;
                  return (
                    <button
                      key={collectionId}
                      onClick={() => {
                        setSelectedCollections(prev => prev.filter(id => id !== collectionId));
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      {collection.name}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  );
                })}
                {selectedSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSizes(prev => prev.filter(s => s !== size));
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {(() => {
                      const sizeObj = sizes.find(s => s.name === size);
                      return sizeObj ? getSizeName(sizeObj, languageCode) : size;
                    })()}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                {selectedColors.map(colorName => {
                  const color = colors.find(c => c.name.toLowerCase() === colorName.toLowerCase());
                  return (
                    <button
                      key={colorName}
                      onClick={() => {
                        setSelectedColors(prev => prev.filter(c => c !== colorName));
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      <span 
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: color?.hexCode || '#ccc' }}
                      />
                      {color ? getColorName(color, languageCode) : colorName}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  );
                })}
                {inStockOnly && (
                  <button
                    onClick={() => setInStockOnly(false)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {t('shop.in_stock_only') || 'In Stock Only'}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {onSaleOnly && (
                  <button
                    onClick={() => setOnSaleOnly(false)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {t('shop.on_sale') || 'On Sale'}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {featuredOnly && (
                  <button
                    onClick={() => setFeaturedOnly(false)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {t('shop.featured_only') || 'Featured'}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {(priceRange.min > calculatedPriceRange.min || priceRange.max < calculatedPriceRange.max) && (
                  <button
                    onClick={() => setPriceRange(calculatedPriceRange)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {formatPrice(priceRange.min)} - {formatPrice(priceRange.max)}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-medium hover:bg-red-100 transition-colors ml-2"
                >
                  {t('shop.clear_all_filters') || 'Clear All'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Quick Filter Chips - Popular Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">{t('shop.quick_filters') || 'Quick Filters:'}</span>
              {categories.slice(0, 5).map(category => (
                <button
                  key={category.id}
                  onClick={() => {
                    if (selectedCategories.includes(category.id)) {
                      handleCategoryChange(category.id);
                    } else {
                      setSelectedCategories([category.id]);
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategories.includes(category.id)
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getCategoryName(category, languageCode)}
                </button>
              ))}
              <button
                onClick={() => setOnSaleOnly(!onSaleOnly)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  onSaleOnly
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('product.badge_sale') || 'Sale'}
              </button>
              <button
                onClick={() => setFeaturedOnly(!featuredOnly)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  featuredOnly
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('product.badge_best_seller') || 'Featured'}
              </button>
            </div>

            {/* Sort & Results Bar */}
            <div 
              data-section-id="sort-bar"
              className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 pb-4 border-b border-gray-200 transition-all duration-700 ${
                visibleSections.has('sort-bar') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="flex items-center gap-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-gray-900 leading-tight">
                  {currentCategory
                    ? getCategoryName(currentCategory, languageCode)
                    : currentCollection
                      ? currentCollection.name
                      : (t('shop.title') || 'Shop')}
                </h1>
                <span className="text-sm md:text-base text-gray-600 hidden md:inline font-medium">
                  {t('shop.showing_count', {
                    start: startIndex + 1,
                    end: Math.min(endIndex, totalProducts),
                    total: totalProducts,
                  }) || `Showing ${startIndex + 1}-${Math.min(endIndex, totalProducts)} of ${totalProducts} ${totalProducts === 1 ? 'product' : 'products'}`}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 border border-gray-200 rounded-md p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-gray-900 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={t('shop.grid_view') || 'Grid View'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0112.75 6v2.25A2.25 2.25 0 0110.5 10.5H8.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-gray-900 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={t('shop.list_view') || 'List View'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </button>
                </div>
                {/* Products Per Page */}
                <select 
                    value={productsPerPage} 
                    onChange={(e) => {
                      setProductsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-200 rounded-md px-3 py-2 bg-white font-medium text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 cursor-pointer hover:border-gray-400 transition-colors text-gray-900"
                >
                    <option value={12}>{t('shop.per_page', { count: 12 }) || '12 per page'}</option>
                    <option value={24}>{t('shop.per_page', { count: 24 }) || '24 per page'}</option>
                    <option value={48}>{t('shop.per_page', { count: 48 }) || '48 per page'}</option>
                    <option value={96}>{t('shop.per_page', { count: 96 }) || '96 per page'}</option>
                </select>
                {/* Sort */}
                <span className="text-sm text-gray-500 hidden md:inline">{t('shop.sort_by') || 'Sort by:'}</span>
                <select 
                    value={sortOption} 
                    onChange={(e) => setSortOption(e.target.value)}
                    className="border border-gray-200 rounded-md px-3 py-2 bg-white font-medium text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 cursor-pointer hover:border-gray-400 transition-colors text-gray-900"
                >
                    <option value="newest">{t('shop.sort_newest_arrivals') || 'Newest Arrivals'}</option>
                    <option value="popular">{t('shop.sort_most_popular') || 'Most Popular'}</option>
                    <option value="rating">{t('shop.sort_highest_rated') || 'Highest Rated'}</option>
                    <option value="price-asc">{t('shop.sort_price_asc') || 'Price: Low to High'}</option>
                    <option value="price-desc">{t('shop.sort_price_desc') || 'Price: High to Low'}</option>
                    <option value="name-asc">{t('shop.sort_name_asc') || 'Name: A to Z'}</option>
                    <option value="name-desc">{t('shop.sort_name_desc') || 'Name: Z to A'}</option>
                </select>
             </div>
          </div>
          
            <div className="mb-6 text-sm md:text-base text-gray-600 md:hidden font-medium">
              {t('shop.showing_count', {
                start: startIndex + 1,
                end: Math.min(endIndex, totalProducts),
                total: totalProducts,
              }) || `Showing ${startIndex + 1}-${Math.min(endIndex, totalProducts)} of ${totalProducts} ${totalProducts === 1 ? 'product' : 'products'}`}
          </div>

          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6' : 'space-y-4'}>
              <SkeletonLoader type="product" count={productsPerPage} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-200">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-2xl font-heading font-bold text-gray-900 mb-3">{t('shop.no_products_found_title') || 'No products found'}</h3>
              <p className="text-gray-600 mb-2 text-center max-w-md">{t('shop.no_products_found_desc') || "We couldn't find any products matching your criteria."}</p>
              <div className="flex flex-wrap gap-2 justify-center mb-6 mt-4">
                <button 
                    onClick={clearFilters} 
                    className="px-6 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                    {t('shop.clear_all_filters') || 'Clear All Filters'}
                </button>
                <Link
                    href="/shop"
                    className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-900 rounded-full text-sm font-medium hover:border-gray-900 transition-colors"
                >
                    {t('shop.browse_all_products') || 'Browse All Products'}
                </Link>
              </div>
              <div className="text-sm text-gray-500">
                <p className="mb-2">{t('shop.suggestions') || 'Suggestions:'}</p>
                <ul className="list-disc list-inside space-y-1 text-left">
                  <li>{t('shop.suggestion_remove_filters') || 'Try removing some filters'}</li>
                  <li>{t('shop.suggestion_check_spelling') || 'Check your search spelling'}</li>
                  <li>{t('shop.suggestion_browse_category') || 'Browse by category'}</li>
                </ul>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <>
              {/* Desktop Grid */}
              <div 
                data-section-id="product-grid"
                className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
              >
                {paginatedProducts.map((product, index) => {
                  const isFeaturedLarge = product.isFeatured && index === 0;
                  return (
                    <div 
                      key={product.id} 
                      className={`${isFeaturedLarge ? 'md:col-span-2 md:row-span-2' : ''} transition-all duration-500 hover:scale-[1.02]`}
                      style={{ transitionDelay: `${index * 50}ms` }}
                    >
                      <ProductCard
                        product={product}
                        isFeaturedLarge={isFeaturedLarge}
                        prioritizeImage={index === 0}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Mobile Horizontal Scroll */}
              <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                <div className="flex gap-4" style={{ width: 'max-content' }}>
                  {paginatedProducts.map((product, index) => (
                    <div key={product.id} className={`flex-shrink-0 w-[45vw] ${index === 0 ? 'pl-4' : ''}`} style={{ scrollSnapAlign: 'start' }}>
                      <ProductCard product={product} prioritizeImage={index === 0} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {paginatedProducts.map((product, index) => (
                <div key={product.id} className="flex gap-4 bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-all">
                  <Link href={`/products/${product.slug}`} className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50">
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={product.images[0]}
                        alt={getProductName(product, languageCode)}
                        width={160}
                        height={160}
                        className="h-full w-full object-cover"
                        sizes="128px"
                        priority={index === 0}
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <span className="text-xs">No Image</span>
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 mb-2 leading-tight">
                        {searchQuery ? (
                          <span dangerouslySetInnerHTML={{
                            __html: getProductName(product, languageCode).replace(
                              new RegExp(`(${searchQuery})`, 'gi'),
                              '<mark class="bg-yellow-200 text-gray-900">$1</mark>'
                            )
                          }} />
                        ) : (
                          getProductName(product, languageCode)
                        )}
                      </h3>
                      <p className="text-sm md:text-base text-gray-700 mb-3 line-clamp-2 leading-relaxed">
                        {product.description || categories.find(c => c.id === product.category)?.name || 'Collection'}
                      </p>
                      {(() => {
                        const pricing = getPricing(product);
                        return (
                          <div className="flex items-baseline gap-2">
                            {pricing.originalPrice !== null && (
                              <span className="text-sm md:text-base text-gray-500 line-through font-medium">
                                {formatPrice(pricing.originalPrice)}
                              </span>
                            )}
                            <span className="text-lg md:text-xl font-bold text-gray-900">
                              {formatPrice(pricing.currentPrice)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <Link
                      href={`/products/${product.slug}`}
                      className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors mt-4 w-fit"
                    >
                      {t('product.view_details') || 'View Details'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mt-12 mb-8" />

          {/* Pagination */}
          {totalPages > 1 && (
            <div 
              data-section-id="pagination"
              className={`flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-700 ${
                visibleSections.has('pagination') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          {/* Quick View Modal */}
          <QuickViewModal
            product={quickViewProduct}
            isOpen={!!quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
          />
          </main>
                        </div>
      </div>
    </div>
  );
};

export default ShopClient;
