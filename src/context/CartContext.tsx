'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Product, ProductVariant } from '@/lib/firestore/products';
import { getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FlashSale } from '@/lib/firestore/campaigns';
import { useLanguage } from './LanguageContext';

export interface CartItem {
  productId: string;
  productSlug?: string; // Product slug for SEO-friendly URLs
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  categoryId?: string; // For tax calculation
  variant?: {
    id: string;
    name: string;
    value: string;
  };
  bundleId?: string; // If item is part of a bundle
  bundleQuantity?: number; // Quantity of this item in the bundle
  originalPrice?: number; // Original price before bundle discount
  flashSaleId?: string; // If item is from flash sale page
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, selectedVariant?: ProductVariant, bundleId?: string, bundleQuantity?: number, originalPrice?: number, flashSaleId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  showCartDialog: boolean;
  cartDialogMessage: string;
  setShowCartDialog: (show: boolean) => void;
  setCartDialogMessage: (message: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Separate component so useLanguage works (LanguageProvider wraps CartProvider in layout)
const CartDialog = ({ cartDialogMessage, onClose }: { cartDialogMessage: string; onClose: () => void }) => {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-green-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 mb-1">
              {t('cart.added_to_cart_title') || 'Added to Cart'}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              {cartDialogMessage}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {t('cart.continue_shopping') || 'Continue Shopping'}
              </button>
              <a
                href="/cart"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-900 text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors text-center"
              >
                {t('cart.view_cart') || 'View Cart'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [showCartDialog, setShowCartDialog] = useState(false);
  const [cartDialogMessage, setCartDialogMessage] = useState('');

  // Initialize cart from localStorage only on client side
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const storedCart = localStorage.getItem('pardah_cart');
    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch {
        // Failed to parse cart from localStorage
      }
    }
  }, []);

  // Load active flash sales for pricing
  useEffect(() => {
    const loadFlashSales = async () => {
      try {
        const sales = await getAllFlashSales(true);
        const now = new Date();

        const validSales = sales.filter((sale) => {
          if (!sale.isActive) return false;
          const startTime = sale.startTime?.toDate ? sale.startTime.toDate() : new Date(0);
          const endTime = sale.endTime?.toDate ? sale.endTime.toDate() : new Date(0);
          return now >= startTime && now <= endTime;
        });

        setActiveFlashSales(validSales);
        
      } catch {
        // Failed to load flash sales for cart pricing
      }
    };

    loadFlashSales();
  }, []);

  // Save cart to localStorage whenever it changes (only after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('pardah_cart', JSON.stringify(cart));
    }
  }, [cart, mounted]);

  const addToCart = useCallback((product: Product, quantity: number, selectedVariant?: ProductVariant, bundleId?: string, bundleQuantity?: number, originalPrice?: number, flashSaleId?: string) => {
    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (item) =>
          item.productId === product.id &&
          (selectedVariant ? item.variant?.id === selectedVariant.id : !item.variant) &&
          (!bundleId || item.bundleId === bundleId) && // Match bundleId if provided
          (!flashSaleId || item.flashSaleId === flashSaleId) // Match flashSaleId if provided
      );

      if (existingItemIndex > -1 && !bundleId && !flashSaleId) {
        // Update quantity of existing item (only if not from bundle/flash sale)
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += quantity;
        return updatedCart;
      } else {
        // Use extraPrice (new field) or priceAdjustment (legacy field) for variant price adjustment
        // Use nullish coalescing (??) instead of || because extraPrice can be 0 (which is falsy)
        const variantExtraPrice = selectedVariant?.extraPrice ?? selectedVariant?.priceAdjustment ?? 0;
        
        // For flash sale pages: use base price only (ignore salePrice)
        // For regular pages: use salePrice if available and less than base price (discount), otherwise use base price
        const basePrice = flashSaleId 
          ? product.price 
          : (product.salePrice && product.salePrice < product.price ? product.salePrice : product.price);

        // Apply flash sale discount if applicable
        let finalPrice = basePrice + variantExtraPrice; // Default: base/salePrice + variant
        let appliedFlashSaleId: string | undefined = undefined;

        // If flashSaleId is provided (from flash sale page), discount applies to base price only, variant extraPrice NOT included
        if (flashSaleId && activeFlashSales.length > 0) {
          const flashSale = activeFlashSales.find(s => s.id === flashSaleId);
          if (flashSale && flashSale.productIds.includes(product.id)) {
            // Discount applies to base price only, variant extraPrice is NOT included in flash sale
            if (flashSale.discountType === 'percentage') {
              finalPrice = Math.max(basePrice * (1 - flashSale.discountValue / 100), 0);
            } else if (flashSale.discountType === 'fixed') {
              finalPrice = Math.max(basePrice - flashSale.discountValue, 0);
            }
            // Note: variantExtraPrice is NOT added for flash sale items
            appliedFlashSaleId = flashSaleId;
          }
        } else {
          // For regular product pages: NO flash sale discount applied
          // Show salePrice (if available) or base price + variant extraPrice
          // Flash sale discounts are ONLY applied when flashSaleId is explicitly provided
          finalPrice = basePrice + variantExtraPrice;
        }

        // Calculate original price for display (base price + variant, for showing strikethrough if salePrice exists)
        const originalBasePrice = product.price + variantExtraPrice;
        const shouldShowOriginalPrice = !flashSaleId && !bundleId && product.salePrice && product.salePrice < product.price;

        // Add new item to cart
        const newItem: CartItem = {
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          productImage: product.images[0] || '/placeholder-product.jpg', // Use first image or placeholder
          price: finalPrice,
          quantity,
          categoryId: product.category, // Store category for tax calculation
          ...(selectedVariant && { variant: { id: selectedVariant.id, name: selectedVariant.name, value: selectedVariant.value } }),
          ...(bundleId && { bundleId, bundleQuantity, originalPrice }),
          ...(appliedFlashSaleId && { flashSaleId: appliedFlashSaleId, originalPrice: basePrice }),
          ...(shouldShowOriginalPrice && { originalPrice: originalBasePrice }),
        };
        return [...prevCart, newItem];
      }
    });
  }, [activeFlashSales]);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) =>
        variantId
          ? !(item.productId === productId && item.variant?.id === variantId)
          : item.productId !== productId
      )
    );
  }, []);

  const updateCartItemQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId && (variantId ? item.variant?.id === variantId : !item.variant)
          ? { ...item, quantity: Math.max(1, quantity) } // Ensure quantity is at least 1
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const getCartTotal = useCallback(() => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cart]);

  const getCartItemCount = useCallback(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        clearCart,
        getCartTotal,
        getCartItemCount,
        showCartDialog,
        cartDialogMessage,
        setShowCartDialog,
        setCartDialogMessage,
      }}
    >
      {children}
      {/* Cart Dialog */}
      {showCartDialog && (
        <CartDialog
          cartDialogMessage={cartDialogMessage}
          onClose={() => setShowCartDialog(false)}
        />
      )}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
