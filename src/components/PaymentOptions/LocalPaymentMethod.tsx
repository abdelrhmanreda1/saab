'use client';

import React from 'react';
import { LocalPaymentMethod } from '@/lib/firestore/internationalization';
// formatPrice will be passed as prop from parent

interface LocalPaymentMethodProps {
  method: LocalPaymentMethod;
  selected: boolean;
  onSelect: () => void;
  orderTotal: number;
  formatPrice: (amount: number) => string;
}

const LocalPaymentMethodComponent: React.FC<LocalPaymentMethodProps> = ({
  method,
  selected,
  onSelect,
  orderTotal,
  formatPrice,
}) => {
  // Check if method is applicable for this order
  const isApplicable = () => {
    if (!method.isActive) return false;
    if (method.minAmount && orderTotal < method.minAmount) return false;
    if (method.maxAmount && orderTotal > method.maxAmount) return false;
    return true;
  };

  if (!isApplicable()) return null;

  // Calculate processing fee
  const getProcessingFee = () => {
    if (!method.processingFee) return 0;
    if (method.processingFeeType === 'percentage') {
      return (orderTotal * method.processingFee) / 100;
    }
    return method.processingFee;
  };

  const processingFee = getProcessingFee();

  return (
    <label
      className={`cursor-pointer border-2 rounded-xl p-4 flex items-center gap-4 transition-all hover:border-gray-300 ${
        selected ? 'border-black bg-gray-50' : 'border-gray-100'
      }`}
    >
      <input
        type="radio"
        name="localPaymentMethod"
        checked={selected}
        onChange={onSelect}
        className="w-5 h-5 text-black focus:ring-black"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {method.icon && <span className="text-2xl">{method.icon}</span>}
          <span className="block font-bold text-gray-900">{method.name}</span>
        </div>
        {processingFee > 0 && (
          <span className="block text-xs text-gray-500 mt-1">
            Processing fee: {formatPrice(processingFee)}
          </span>
        )}
        {method.type === 'bank' && method.config?.bankName && (
          <span className="block text-xs text-gray-500 mt-1">
            {method.config.bankName}
          </span>
        )}
      </div>
    </label>
  );
};

export default LocalPaymentMethodComponent;

