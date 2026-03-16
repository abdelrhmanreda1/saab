'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';

const CurrencySwitcher = () => {
  const { defaultCurrency, isLoading } = useCurrency();
  const [, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || !defaultCurrency) {
    return null;
  }

  // Currency switching not implemented yet
  // const handleCurrencyChange = async () => {
  //   setIsOpen(false);
  // };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg bg-white">
        <span className="font-bold">{defaultCurrency.code}</span>
        <span className="text-gray-500 text-xs">({defaultCurrency.symbol})</span>
      </div>
    </div>
  );
};

export default CurrencySwitcher;

