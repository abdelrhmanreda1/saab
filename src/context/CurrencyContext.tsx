'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { getDefaultCurrency } from '@/lib/firestore/internationalization_db';
import { Currency } from '@/lib/firestore/internationalization';

const PRICE_FORMAT_LOCALE = 'en-US';

interface CurrencyContextType {
  formatPrice: (amount: number) => string;
  convertPrice: (amount: number, fromCurrency?: string, toCurrency?: string) => Promise<number>;
  defaultCurrency: Currency | null;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ 
  children
}) => {
  const [defaultCurrency, setDefaultCurrency] = useState<Currency | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDefaultCurrency = async () => {
      try {
        const currency = await getDefaultCurrency();
        setDefaultCurrency(currency);
      } catch {
        // Failed to load default currency
        setDefaultCurrency(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDefaultCurrency();
  }, []);

  // Format price using default currency
  const formatPrice = (amount: number): string => {
    if (!defaultCurrency) {
      // Fallback to generic format if no default currency
      return amount.toLocaleString(PRICE_FORMAT_LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }

    const formattedAmount = amount.toLocaleString(PRICE_FORMAT_LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: defaultCurrency.decimalPlaces || 0,
    });

    if (defaultCurrency.symbolPosition === 'right') {
      return `${formattedAmount} ${defaultCurrency.symbol}`;
    } else {
      return `${defaultCurrency.symbol} ${formattedAmount}`;
    }
  };

  // Simple converter - always returns the same amount (no conversion)
  const convertPrice = async (
    amount: number
  ): Promise<number> => {
    // No conversion, just return the amount as is
    return amount;
  };

  return (
    <CurrencyContext.Provider
      value={{
        formatPrice,
        convertPrice,
        defaultCurrency,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

