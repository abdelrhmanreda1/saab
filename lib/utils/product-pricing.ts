import { Product } from '@/lib/firestore/products';
import { FlashSale } from '@/lib/firestore/campaigns';
import { GoldPricingSettings } from '@/lib/firestore/settings';
import { GoldRateCache, getEffectiveProductPrice, isGoldPricedProduct } from '@/lib/utils/gold-pricing';

type VariantSelection =
  | {
      id?: string;
      name?: string;
      value?: string;
    }
  | undefined
  | null;

export type ProductPricingSummary = {
  currentPrice: number;
  originalPrice: number | null;
  hasDiscount: boolean;
};

export const getProductPricingSummary = (
  product: Partial<Product>,
  goldPricing?: GoldPricingSettings | null,
  goldRateCache?: Partial<GoldRateCache> | null
): ProductPricingSummary => {
  const currentPrice = getEffectiveProductPrice(product, goldPricing, goldRateCache);
  const hasSalePrice =
    !isGoldPricedProduct(product) &&
    Number(product.salePrice || 0) > 0 &&
    Number(product.salePrice || 0) < Number(product.price || 0);

  const originalPrice = hasSalePrice ? Number(product.price || 0) : null;

  return {
    currentPrice,
    originalPrice,
    hasDiscount: originalPrice !== null && currentPrice < originalPrice,
  };
};

export const getVariantExtraPrice = (
  product: Partial<Product>,
  variant?: VariantSelection
) => {
  if (!product.variants || !variant) {
    return 0;
  }

  if (variant.value?.includes(' - ')) {
    const [colorValue, sizeValue] = variant.value.split(' - ');
    const colorVariant = product.variants.find(
      (v) =>
        v.name?.toLowerCase() === 'color' &&
        v.value?.toLowerCase() === colorValue?.toLowerCase()
    );
    const sizeVariant = product.variants.find(
      (v) =>
        v.name?.toLowerCase() === 'size' &&
        v.value?.toLowerCase() === sizeValue?.toLowerCase()
    );

    return (
      Number(colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0) +
      Number(sizeVariant?.extraPrice ?? sizeVariant?.priceAdjustment ?? 0)
    );
  }

  const matchedVariant = product.variants.find(
    (v) =>
      v.id === variant.id ||
      (v.name?.toLowerCase() === variant.name?.toLowerCase() &&
        v.value?.toLowerCase() === variant.value?.toLowerCase())
  );

  return Number(matchedVariant?.extraPrice ?? matchedVariant?.priceAdjustment ?? 0);
};

export const getProductPriceWithVariant = (
  product: Partial<Product>,
  variant?: VariantSelection,
  goldPricing?: GoldPricingSettings | null,
  goldRateCache?: Partial<GoldRateCache> | null
) => {
  const pricing = getProductPricingSummary(product, goldPricing, goldRateCache);
  const variantExtra = getVariantExtraPrice(product, variant);

  return {
    currentPrice: pricing.currentPrice + variantExtra,
    originalPrice: pricing.originalPrice !== null ? pricing.originalPrice + variantExtra : null,
    hasDiscount:
      pricing.originalPrice !== null && pricing.currentPrice + variantExtra < pricing.originalPrice + variantExtra,
  };
};

export const getFlashSaleAdjustedPrice = (
  product: Partial<Product>,
  flashSale: FlashSale | null | undefined,
  goldPricing?: GoldPricingSettings | null,
  goldRateCache?: Partial<GoldRateCache> | null
) => {
  const flashSaleBasePrice = isGoldPricedProduct(product)
    ? getEffectiveProductPrice(product, goldPricing, goldRateCache)
    : Number(product.price || 0);

  if (!flashSale) {
    return {
      currentPrice: flashSaleBasePrice,
      originalPrice: null as number | null,
      hasDiscount: false,
    };
  }

  let adjustedPrice = flashSaleBasePrice;

  if (flashSale.discountType === 'percentage') {
    adjustedPrice = Math.max(flashSaleBasePrice * (1 - flashSale.discountValue / 100), 0);
  } else if (flashSale.discountType === 'fixed') {
    adjustedPrice = Math.max(flashSaleBasePrice - flashSale.discountValue, 0);
  }

  return {
    currentPrice: adjustedPrice,
    originalPrice: flashSaleBasePrice,
    hasDiscount: adjustedPrice < flashSaleBasePrice,
  };
};
