'use client';

import React, { useState } from 'react';
import { Product, ProductVariant } from '@/lib/firestore/products';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSettings } from '../context/SettingsContext';
import Dialog from './ui/Dialog';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';

interface ProductQuickViewProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

const ProductQuickView: React.FC<ProductQuickViewProps> = ({ product, isOpen, onClose }) => {
  const { addToCart, setShowCartDialog, setCartDialogMessage } = useCart();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  if (!isOpen) return null;

  const pricing = getProductPricingSummary(
    product,
    settings?.goldPricing,
    settings?.goldPricing?.cache
  );
  const selectedVariantExtra = selectedVariant?.extraPrice ?? selectedVariant?.priceAdjustment ?? 0;
  const displayPrice = pricing.currentPrice + selectedVariantExtra;

  const handleAddToCart = () => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      setShowInfoDialog(true);
      return;
    }
    addToCart({ ...product, price: pricing.currentPrice, salePrice: undefined }, quantity, selectedVariant);
    setCartDialogMessage(`${quantity} x ${product.name} ${t('cart.added_to_cart')}`);
    setShowCartDialog(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="relative h-64 md:h-96">
            <Image
              src={product.images[0] || '/placeholder.jpg'}
              alt={product.name}
              fill
              className="object-cover rounded-lg"
            />
          </div>
          <div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{product.name}</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                ×
              </button>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-4">{formatPrice(displayPrice)}</p>
            <p className="text-gray-600 mb-4 line-clamp-3">{product.description}</p>
            
            {product.variants && product.variants.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('products.select_variant_label') || 'Select Variant'}</label>
                <select
                  value={selectedVariant?.id || ''}
                  onChange={(e) => {
                    const variant = product.variants.find(v => v.id === e.target.value);
                    setSelectedVariant(variant);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{t('products.select_option') || 'Select...'}</option>
                  {product.variants.map(variant => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}: {variant.value} - {formatPrice(pricing.currentPrice + (variant.extraPrice ?? variant.priceAdjustment ?? 0))}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium">{t('products.quantity')}:</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 border border-gray-300 rounded flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 border border-gray-300 rounded flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                className="flex-1 bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800"
              >
                Add to Cart
              </button>
              <Link
                href={`/products/${product.id}`}
                className="flex-1 bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 text-center"
                onClick={onClose}
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={t('common.error') || 'Error'}
        message={t('products.select_variant') || 'Please select a variant'}
        type="error"
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default ProductQuickView;

