'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo } from 'react';
import { Currency } from '@/lib/firestore/internationalization';
import { scheduleNonCriticalTask } from '@/lib/utils/schedule';

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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDefaultCurrency = async () => {
      try {
        setIsLoading(true);
        const { getDefaultCurrency } = await import('@/lib/firestore/internationalization_db');
        const currency = await getDefaultCurrency();
        if (!cancelled) {
          setDefaultCurrency(currency);
        }
      } catch {
        // Failed to load default currency
        if (!cancelled) {
          setDefaultCurrency(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const scheduledTask = scheduleNonCriticalTask(() => {
      void loadDefaultCurrency();
    }, 200);

    return () => {
      cancelled = true;
      scheduledTask.cancel();
    };
  }, []);

  // Format price using default currency
  const formatPrice = (amount: number): string => {
    if (!defaultCurrency) {
      // Fallback to SAR format if no default currency loaded yet
      const fallbackAmount = amount.toLocaleString(PRICE_FORMAT_LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      const isRtl = typeof document !== 'undefined' && document.documentElement?.dir === 'rtl';
      const fallbackSymbol = isRtl ? 'ر.س' : 'SAR';
      return `${fallbackAmount} ${fallbackSymbol}`;
    }

    const formattedAmount = amount.toLocaleString(PRICE_FORMAT_LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: defaultCurrency.decimalPlaces || 0,
    });

    // Some Arabic currency symbols are stored with a trailing dot (e.g. "ر.س.")
    // which looks odd in RTL. Strip only the trailing dots safely.
    const isRtlDoc =
      typeof document !== 'undefined' && document.documentElement?.dir === 'rtl';
    const symbol = isRtlDoc
      ? String(defaultCurrency.symbol || '').replace(/\.+\s*$/, '').trim()
      : String(defaultCurrency.symbol || '').trim();

    if (defaultCurrency.symbolPosition === 'right') {
      return `${formattedAmount} ${symbol}`;
    } else {
      return `${symbol} ${formattedAmount}`;
    }
  };

  // Simple converter - always returns the same amount (no conversion)
  const convertPrice = async (
    amount: number
  ): Promise<number> => {
    // No conversion, just return the amount as is
    return amount;
  };

  const value = useMemo(
    () => ({
      formatPrice,
      convertPrice,
      defaultCurrency,
      isLoading,
    }),
    [defaultCurrency, isLoading]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

