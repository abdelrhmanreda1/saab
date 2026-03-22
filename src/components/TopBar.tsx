'use client';

import { useMemo, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';

type TrendDirection = 'up' | 'down';

type RateItem = {
  key: string;
  label: string;
  value: number;
  currencyLabel: string;
  trend: TrendDirection;
};

const TopBar = () => {
  const { settings, loading } = useSettings();
  const { currentLanguage, t } = useLanguage();
  const topBar = settings?.theme?.topBar;
  const langCode = String(currentLanguage?.code || '').trim().toLowerCase();
  const isArabic = langCode === 'ar';
  const basePrice = Number(settings?.goldPricing?.cache?.pricePerGram || 0);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const rates = useMemo<RateItem[]>(() => {
    if (basePrice <= 0) {
      return [];
    }

    return [
      {
        key: 'gold-24k',
        label: t('topbar.gold_24k') || (isArabic ? 'ذهب عيار 24' : 'Gold 24K'),
        value: basePrice,
        currencyLabel: t('topbar.currency_sar') || (isArabic ? 'ريال' : 'SAR'),
        trend: 'up',
      },
      {
        key: 'gold-22k',
        label: t('topbar.gold_22k') || (isArabic ? 'ذهب عيار 22' : 'Gold 22K'),
        value: basePrice * (22 / 24),
        currencyLabel: t('topbar.currency_sar') || (isArabic ? 'ريال' : 'SAR'),
        trend: 'down',
      },
      {
        key: 'gold-21k',
        label: t('topbar.gold_21k') || (isArabic ? 'ذهب عيار 21' : 'Gold 21K'),
        value: basePrice * (21 / 24),
        currencyLabel: t('topbar.currency_sar') || (isArabic ? 'ريال' : 'SAR'),
        trend: 'down',
      },
      {
        key: 'gold-18k',
        label: t('topbar.gold_18k') || (isArabic ? 'ذهب عيار 18' : 'Gold 18K'),
        value: basePrice * (18 / 24),
        currencyLabel: t('topbar.currency_sar') || (isArabic ? 'ريال' : 'SAR'),
        trend: 'down',
      },
    ];
  }, [basePrice, isArabic, t]);

  const shouldRender = Boolean((topBar?.enabled && topBar?.text) || rates.length > 0);

  if (loading) {
    return (
      <div className="border-b border-[#8f6b28] bg-[#050505]">
        <div className="page-container">
          <div className="hidden min-h-[84px] md:block" />
          <div className="min-h-[56px] md:hidden" />
        </div>
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  const formatValue = (value: number) =>
    new Intl.NumberFormat(isArabic ? 'ar-SA' : 'en-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const renderArrow = (trend: TrendDirection) => {
    if (trend === 'up') {
      return (
        <svg
          viewBox="0 0 18 18"
          className="h-4 w-4 text-[#d8b24d]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
        >
          <path d="M3.5 11.5 8.2 6.8l2.3 2.3 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.7 5.1h2.8v2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 18 18"
        className="h-4 w-4 text-[#dd7c7c]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      >
        <path d="M3.5 6.5 8.2 11.2l2.3-2.3 4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.7 13h2.8v-2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const renderDesktopItem = (item: RateItem, index: number) => {
    const valueColor = item.trend === 'up' ? 'text-[#f0c24f]' : 'text-[#f0c24f]';

    return (
      <div
        key={item.key}
        className={`flex min-w-0 flex-col items-center justify-center px-4 py-3 text-center ${
          index > 0 ? 'border-s border-[#d0b15a]' : ''
        }`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fff3ca] md:text-[12px]">
          {item.label}
        </span>
        <div className={`mt-1.5 flex items-center gap-1.5 text-lg font-bold leading-none ${valueColor}`}>
          <span>{formatValue(item.value)}</span>
          <span className="text-sm font-semibold">{item.currencyLabel}</span>
          {renderArrow(item.trend)}
        </div>
      </div>
    );
  };

  const renderMobileItem = (item: RateItem, index: number) => {
    const valueColor = item.trend === 'up' ? 'text-[#f0c24f]' : 'text-[#f0c24f]';
    const rowDirection = isArabic ? 'flex-row-reverse' : 'flex-row';
    const valueAlignment = isArabic ? 'justify-end text-right' : 'justify-start text-left';
    const labelAlignment = isArabic ? 'text-left' : 'text-right';

    return (
      <div
        key={item.key}
        className={`flex min-h-[56px] items-center px-4 py-3 ${index > 0 ? 'border-t border-[#2a2a2a]' : ''}`}
      >
        <div className={`flex w-full items-center justify-between gap-3 ${rowDirection}`}>
          <span className={`shrink-0 text-sm font-semibold text-white ${labelAlignment}`}>{item.label}</span>
          <div className={`flex items-center gap-1.5 tabular-nums whitespace-nowrap ${valueAlignment} ${valueColor}`}>
            {renderArrow(item.trend)}
            <span className="text-[11px] font-semibold">{item.currencyLabel}</span>
            <span className="text-[10px] font-semibold tracking-[0.06em]">{formatValue(item.value)}</span>
          </div>
        </div>
      </div>
    );
  };

  const primaryMobileRate = rates[0];
  const secondaryMobileRates = rates.slice(1);

  const translatedPromo = t('topbar.promo');
  const resolvedPromoText =
    translatedPromo && translatedPromo !== 'topbar.promo' ? translatedPromo : topBar?.text;
  const showTopBarMessage = Boolean(topBar?.enabled && resolvedPromoText);

  return (
    <div
      style={{
        backgroundColor: topBar?.backgroundColor || '#050505',
        color: topBar?.textColor || '#f4e1a1',
      }}
      className="border-b border-[#8f6b28]"
    >
      <div className="page-container">
        <div className="hidden min-h-[84px] md:flex md:items-stretch md:justify-between">
          {rates.length > 0 && (
            <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
              {rates.map((item, index) => renderDesktopItem(item, index))}
            </div>
          )}

          {showTopBarMessage && (
            <div className="flex min-h-[84px] min-w-[360px] items-center justify-center px-6 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[#fff3ca]">
              {resolvedPromoText}
            </div>
          )}
        </div>

        <div className="md:hidden">
          {primaryMobileRate && (
            <div className="min-h-[56px] bg-black">
              <div className="flex min-h-[56px] items-stretch">
                <div className="min-w-0 flex-1">{renderMobileItem(primaryMobileRate, 0)}</div>
                {secondaryMobileRates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsMobileExpanded((prev) => !prev)}
                    className="flex w-12 shrink-0 items-center justify-center border-s border-[#2a2a2a] text-white"
                    aria-label={
                      isMobileExpanded
                        ? (t('topbar.hide_other_prices') || (isArabic ? 'إخفاء باقي الأسعار' : 'Hide other prices'))
                        : (t('topbar.show_other_prices') || (isArabic ? 'عرض باقي الأسعار' : 'Show other prices'))
                    }
                    aria-expanded={isMobileExpanded}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                      className={`h-4 w-4 transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                )}
              </div>

              {isMobileExpanded && secondaryMobileRates.length > 0 && (
                <div>
                  {secondaryMobileRates.map((item, index) => renderMobileItem(item, index + 1))}
                </div>
              )}
            </div>
          )}

          {showTopBarMessage && (
            <div className={`${primaryMobileRate ? 'border-t' : ''} border-[#2a2a2a] px-4 py-2.5 text-center text-[11px] font-semibold text-white hidden md:block`}>
              {resolvedPromoText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
