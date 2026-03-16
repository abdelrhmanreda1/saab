import { Product } from '@/lib/firestore/products';
import { GoldPricingSettings } from '@/lib/firestore/settings';

export type GoldRateCache = {
  pricePerGram: number;
  currency: string;
  fetchedAt?: string;
  sourceTimestamp?: string;
  source?: string;
};

const KARAT_MULTIPLIERS: Record<NonNullable<Product['goldKarat']>, number> = {
  '24K': 1,
  '22K': 22 / 24,
  '21K': 21 / 24,
  '18K': 18 / 24,
};

export const isGoldPricedProduct = (product: Partial<Product> | null | undefined) =>
  product?.pricingMode === 'gold' && Number(product?.goldWeight || 0) > 0;

export const getGoldRatePerGramForProduct = (
  product: Partial<Product>,
  basePricePerGram: number
) => {
  const karat = product.goldKarat || '24K';
  const multiplier = KARAT_MULTIPLIERS[karat] || 1;
  return basePricePerGram * multiplier;
};

export const calculateGoldProductPrice = (
  product: Partial<Product>,
  goldPricing: GoldPricingSettings,
  goldRateCache?: Partial<GoldRateCache> | null
) => {
  const basePricePerGram =
    Number(goldRateCache?.pricePerGram || 0) > 0
      ? Number(goldRateCache?.pricePerGram || 0)
      : Number(goldPricing.manualPricePerGram || 0);

  if (!isGoldPricedProduct(product) || basePricePerGram <= 0) {
    return Number(product.price || 0);
  }

  const goldWeight = Number(product.goldWeight || 0);
  const adjustedGoldRate = getGoldRatePerGramForProduct(product, basePricePerGram);
  const rawGoldValue = adjustedGoldRate * goldWeight;

  const makingChargeType = product.makingChargeType || goldPricing.defaultMarginType || 'fixed';
  const makingChargeValue = Number(
    product.makingChargeValue ?? goldPricing.defaultMarginValue ?? 0
  );
  const makingCharge =
    makingChargeType === 'percentage'
      ? rawGoldValue * (makingChargeValue / 100)
      : makingChargeValue;

  const manualAdjustment = Number(product.manualPriceAdjustment || 0);
  const subtotal = rawGoldValue + makingCharge + manualAdjustment;

  const karat = product.goldKarat || '24K';
  const taxRate = Number(
    goldPricing.karatTaxRates?.[karat] ?? goldPricing.taxRatePercentage ?? 0
  );
  const taxAmount = subtotal * (taxRate / 100);

  return Math.max(0, Number((subtotal + taxAmount).toFixed(2)));
};

export const getEffectiveProductPrice = (
  product: Partial<Product>,
  goldPricing?: GoldPricingSettings | null,
  goldRateCache?: Partial<GoldRateCache> | null
) => {
  if (!goldPricing?.enabled || !isGoldPricedProduct(product)) {
    return Number(product.salePrice && product.salePrice < Number(product.price || 0)
      ? product.salePrice
      : product.price || 0);
  }

  return calculateGoldProductPrice(product, goldPricing, goldRateCache);
};
