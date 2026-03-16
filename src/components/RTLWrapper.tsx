'use client';

import React, { ReactNode } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface RTLWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * RTL-aware wrapper component that applies RTL/LTR classes based on current language
 */
export const RTLWrapper: React.FC<RTLWrapperProps> = ({ children, className = '' }) => {
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage?.isRTL || false;

  return (
    <div className={className} dir={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
};

/**
 * RTL-aware text alignment utility
 */
export const RTLText: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => {
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage?.isRTL || false;

  return (
    <div className={`${isRTL ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </div>
  );
};

/**
 * RTL-aware flex direction utility
 */
export const RTLFlex: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => {
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage?.isRTL || false;

  return (
    <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${className}`}>
      {children}
    </div>
  );
};

