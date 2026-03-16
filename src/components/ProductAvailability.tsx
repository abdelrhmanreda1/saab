'use client';

import React from 'react';
import { Product, ProductVariant } from '@/lib/firestore/products';

interface ProductAvailabilityProps {
  product: Product;
  selectedVariant?: ProductVariant;
}

const ProductAvailability: React.FC<ProductAvailabilityProps> = ({ product, selectedVariant }) => {
  const getStockStatus = () => {
    if (product.variants && product.variants.length > 0) {
      if (selectedVariant) {
        if (selectedVariant.stock > 10) return { status: 'in_stock', text: 'In Stock', color: 'text-green-600' };
        if (selectedVariant.stock > 0) return { status: 'low_stock', text: 'Low Stock', color: 'text-yellow-600' };
        return { status: 'out_of_stock', text: 'Out of Stock', color: 'text-red-600' };
      }
      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
      if (totalStock > 10) return { status: 'in_stock', text: 'In Stock', color: 'text-green-600' };
      if (totalStock > 0) return { status: 'low_stock', text: 'Low Stock', color: 'text-yellow-600' };
      return { status: 'out_of_stock', text: 'Out of Stock', color: 'text-red-600' };
    }
    return { status: 'in_stock', text: 'In Stock', color: 'text-green-600' };
  };

  const stockInfo = getStockStatus();
  const stockCount = selectedVariant 
    ? selectedVariant.stock 
    : (product.variants && product.variants.length > 0 
        ? product.variants.reduce((sum, v) => sum + v.stock, 0) 
        : null);

  return (
    <div className="flex items-center gap-2">
      <span className={`font-medium ${stockInfo.color}`}>
        {stockInfo.text}
      </span>
      {stockCount !== null && stockInfo.status !== 'out_of_stock' && (
        <span className="text-sm text-gray-500">
          ({stockCount} available)
        </span>
      )}
    </div>
  );
};

export default ProductAvailability;

