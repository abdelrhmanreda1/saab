import { Product } from '@/lib/firestore/products';
import { Category } from '@/lib/firestore/categories';
import { Brand } from '@/lib/firestore/brands';
import { Collection } from '@/lib/firestore/collections';
import { Color } from '@/lib/firestore/attributes';
import { Size } from '@/lib/firestore/attributes';

const normalizeLangCode = (code: string | undefined | null) =>
  String(code || 'en')
    .trim()
    .toLowerCase();

const findTranslation = <T extends { languageCode: string }>(
  translations: T[] | undefined,
  languageCode: string
): T | undefined => {
  if (!translations || translations.length === 0) return undefined;
  const target = normalizeLangCode(languageCode);
  return translations.find((t) => normalizeLangCode(t.languageCode) === target);
};

/**
 * Get translated product name based on current language
 */
export function getProductName(product: Product, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !product.translations || product.translations.length === 0) {
    return product.name;
  }
  
  const translation = findTranslation(product.translations, lang);
  return translation?.name || product.name;
}

/**
 * Get translated product description based on current language
 */
export function getProductDescription(product: Product, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !product.translations || product.translations.length === 0) {
    return product.description;
  }
  
  const translation = findTranslation(product.translations, lang);
  return translation?.description || product.description;
}

/**
 * Get translated category name based on current language
 */
export function getCategoryName(category: Category, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !category.translations || category.translations.length === 0) {
    return category.name;
  }
  
  const translation = findTranslation(category.translations, lang);
  return translation?.name || category.name;
}

/**
 * Get translated category description based on current language
 */
export function getCategoryDescription(category: Category, languageCode: string = 'en'): string | undefined {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !category.translations || category.translations.length === 0) {
    return category.description;
  }
  
  const translation = findTranslation(category.translations, lang);
  return translation?.description || category.description;
}

/**
 * Get translated brand name based on current language
 */
export function getBrandName(brand: Brand | { name: string; translations?: Array<{ languageCode: string; name: string }> }, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !brand.translations || brand.translations.length === 0) {
    return brand.name;
  }
  
  const translation = findTranslation(brand.translations, lang);
  return translation?.name || brand.name;
}

/**
 * Get translated brand description based on current language
 */
export function getBrandDescription(brand: Brand | { description?: string; translations?: Array<{ languageCode: string; description?: string }> }, languageCode: string = 'en'): string | undefined {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !brand.translations || brand.translations.length === 0) {
    return brand.description;
  }
  
  const translation = findTranslation(brand.translations, lang);
  return translation?.description || brand.description;
}

/**
 * Get translated collection name based on current language
 */
export function getCollectionName(collection: Collection, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !collection.translations || collection.translations.length === 0) {
    return collection.name;
  }
  
  const translation = findTranslation(collection.translations, lang);
  return translation?.name || collection.name;
}

/**
 * Get translated collection description based on current language
 */
export function getCollectionDescription(collection: Collection, languageCode: string = 'en'): string | undefined {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !collection.translations || collection.translations.length === 0) {
    return collection.description;
  }
  
  const translation = findTranslation(collection.translations, lang);
  return translation?.description || collection.description;
}

/**
 * Get translated color name based on current language
 */
export function getColorName(color: Color, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !color.translations || color.translations.length === 0) {
    return color.name;
  }
  
  const translation = findTranslation(color.translations, lang);
  return translation?.name || color.name;
}

/**
 * Get translated size name based on current language
 */
export function getSizeName(size: Size, languageCode: string = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  if (lang === 'en' || !size.translations || size.translations.length === 0) {
    return size.name;
  }
  
  const translation = findTranslation(size.translations, lang);
  return translation?.name || size.name;
}

