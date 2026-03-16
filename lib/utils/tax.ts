import { TaxRate } from '../firestore/internationalization';
import { getAllTaxRates } from '../firestore/internationalization_db';

export interface TaxCalculation {
  taxAmount: number;
  taxBreakdown: {
    taxRate: TaxRate;
    amount: number;
  }[];
  subtotal: number;
  total: number;
}

/**
 * Calculate taxes for an order based on region, products, and shipping
 */
export const calculateTaxes = async (
  subtotal: number,
  shippingCost: number,
  region: string, // Country code (for backward compatibility)
  products: Array<{ productId: string; categoryId?: string; price: number; quantity: number }>,
  location?: { countryId?: string; countryName?: string; stateId?: string; stateName?: string; cityId?: string; cityName?: string }
): Promise<TaxCalculation> => {
  try {
    // Get all active tax rates for the region - handle permissions error gracefully
    let allTaxRates = [];
    try {
      allTaxRates = await getAllTaxRates();
    } catch (taxError: unknown) {
      // Failed to fetch tax rates
      // If permissions error, return zero tax
      const error = taxError as { message?: string; code?: string };
      if (error?.message?.includes('permissions') || error?.code === 'permission-denied') {
        console.warn('Tax rates fetch failed due to permissions. Returning zero tax.');
        return {
          taxAmount: 0,
          taxBreakdown: [],
          subtotal,
          total: subtotal + shippingCost,
        };
      }
      // For other errors, also return zero tax
      return {
        taxAmount: 0,
        taxBreakdown: [],
        subtotal,
        total: subtotal + shippingCost,
      };
    }
    
    // Tax calculation - All rates
    
    // Filter tax rates based on location (country/state/city) or region (backward compatibility)
    const applicableTaxRates = allTaxRates.filter((rate) => {
      if (!rate.isActive) return false;
      
      // If location is provided, match by country/state/city
      if (location && (location.countryId || location.countryName)) {
        const countryName = location.countryName;
        const countryId = location.countryId;
        const stateName = location.stateName;
        const stateId = location.stateId;
        const cityName = location.cityName;
        const cityId = location.cityId;
        
        let countryMatch = false;
        let stateMatch = true; // Default to true if no states specified
        let cityMatch = true; // Default to true if no cities specified
        
        // Check country match
        if (rate.countries && rate.countries.length > 0) {
          // Rate has specific countries - must match
          countryMatch = rate.countries.some(c => 
            c === countryId || c === countryName
          );
          if (!countryMatch) {
            // If countries don't match and rate has region, check region as fallback
            if (rate.region && rate.region === region) {
              countryMatch = true; // Region matches, allow it
            } else {
              return false; // No match
            }
          }
        } else if (rate.region) {
          // No countries defined, match by region
          countryMatch = rate.region === region;
        } else {
          // No countries or region - match all (not recommended but allow it)
          countryMatch = true;
        }
        
        // Check state match if rate has specific states
        // If rate has states defined, location must have a matching state
        // If rate has no states, it applies to all states (country-level rate)
        if (rate.states && rate.states.length > 0) {
          if (!stateId && !stateName) {
            // Rate requires state but location doesn't have it - don't match
            // Failed to fetch tax rates
            return false;
          } else {
            stateMatch = rate.states.some(s => 
              s === stateId || s === stateName
            );
            if (!stateMatch) {
              // State doesn't match - this rate doesn't apply
              // Failed to fetch tax rates
              return false;
            }
          }
        }
        // If rate has no states specified, it applies to all states (country-level rate)
        
        // Check city match if rate has specific cities
        // If rate has cities defined, location must have a matching city
        // If rate has no cities, it applies to all cities (state/country-level rate)
        if (rate.cities && rate.cities.length > 0) {
          if (!cityId && !cityName) {
            // Rate requires city but location doesn't have it - don't match
            // Failed to fetch tax rates
            return false;
          } else {
            cityMatch = rate.cities.some(c => 
              c === cityId || c === cityName
            );
            if (!cityMatch) {
              // City doesn't match - this rate doesn't apply
              // Failed to fetch tax rates
              return false;
            }
          }
        }
        // If rate has no cities specified, it applies to all cities (state/country-level rate)
        
        return true;
      } else {
        // Backward compatibility: match by region only
        const matches = rate.region === region;
        if (matches) {
          // Failed to fetch tax rates
        }
        return matches;
      }
    });
    
    // Sort by specificity: city-specific > state-specific > country-only > region-only
    applicableTaxRates.sort((a, b) => {
      // Calculate specificity score - more specific = higher score
      const aHasCities = a.cities && a.cities.length > 0;
      const aHasStates = a.states && a.states.length > 0;
      const aHasCountries = a.countries && a.countries.length > 0;
      const aHasRegion = !!a.region;
      
      const bHasCities = b.cities && b.cities.length > 0;
      const bHasStates = b.states && b.states.length > 0;
      const bHasCountries = b.countries && b.countries.length > 0;
      const bHasRegion = !!b.region;
      
      // More specific = higher score (city=100, state=10, country=1, region=0.1)
      const aSpecificity = (aHasCities ? 100 : 0) + (aHasStates ? 10 : 0) + (aHasCountries ? 1 : 0) + (aHasRegion ? 0.1 : 0);
      const bSpecificity = (bHasCities ? 100 : 0) + (bHasStates ? 10 : 0) + (bHasCountries ? 1 : 0) + (bHasRegion ? 0.1 : 0);
      
      return bSpecificity - aSpecificity; // More specific first
    });
    
    

    if (applicableTaxRates.length === 0) {
      return {
        taxAmount: 0,
        taxBreakdown: [],
        subtotal,
        total: subtotal + shippingCost,
      };
    }

    const taxBreakdown: { taxRate: TaxRate; amount: number }[] = [];
    let totalTaxAmount = 0;

    for (const taxRate of applicableTaxRates) {
      let taxableAmount = 0;

      // Tax is always calculated product-wise, not on shipping
      // Determine what products to apply tax to
      if (taxRate.applicableTo === 'products' || taxRate.applicableTo === 'all' || taxRate.applicableTo === 'both') {
        // Check if tax applies to specific categories
        if (taxRate.productCategories && taxRate.productCategories.length > 0) {
          // Only apply to products in specified categories
          taxableAmount = products
            .filter((item) => item.categoryId && taxRate.productCategories!.includes(item.categoryId))
            .reduce((sum, item) => sum + item.price * item.quantity, 0);
        } else {
          // Apply to all products (subtotal only, no shipping)
          taxableAmount = subtotal;
        }
      } else if (taxRate.applicableTo === 'shipping') {
        // If explicitly set to shipping only, skip it (tax should be product-wise)
        continue;
      }

      // Calculate tax amount
      let taxAmount = 0;
      if (taxRate.type === 'percentage') {
        taxAmount = (taxableAmount * taxRate.rate) / 100;
      } else {
        // Fixed amount
        taxAmount = taxRate.rate;
      }

      if (taxAmount > 0) {
        taxBreakdown.push({ taxRate, amount: taxAmount });
        totalTaxAmount += taxAmount;
      }
    }

    return {
      taxAmount: totalTaxAmount,
      taxBreakdown,
      subtotal,
      total: subtotal + shippingCost + totalTaxAmount,
    };
  } catch  {
    // Failed to calculate taxes
    // Return zero tax on error
    return {
      taxAmount: 0,
      taxBreakdown: [],
      subtotal,
      total: subtotal + shippingCost,
    };
  }
};

/**
 * Get tax rates for a specific region
 */
export const getTaxRatesForRegion = async (region: string): Promise<TaxRate[]> => {
  try {
    const allTaxRates = await getAllTaxRates();
    return allTaxRates.filter((rate) => rate.isActive && rate.region === region);
  } catch {
    // Failed to fetch tax rates
    return [];
  }
};

