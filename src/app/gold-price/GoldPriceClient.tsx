'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';

type GoldPriceResponse = {
  success: boolean;
  source?: string;
  pricePerGram?: number;
  currency?: string;
  fetchedAt?: string;
  sourceTimestamp?: string;
  error?: string;
};

const KARAT_CONFIG = [
  { karat: '24K', multiplier: 1, purity: '99.9%' },
  { karat: '22K', multiplier: 22 / 24, purity: '91.6%' },
  { karat: '21K', multiplier: 21 / 24, purity: '87.5%' },
  { karat: '18K', multiplier: 18 / 24, purity: '75.0%' },
] as const;

const GoldPriceClient = () => {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const [data, setData] = useState<GoldPriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isArabic = String(currentLanguage?.code || '').trim().toLowerCase() === 'ar';
  const formatKaratLabel = (karat: string) => {
    if (!isArabic) return karat;
    const match = String(karat).match(/^(\d{2})K$/i);
    return match ? `${t('gold_price.karat_prefix') || 'عيار'} ${match[1]}` : karat;
  };
  const locale = isArabic ? 'ar-SA' : 'en-SA';
  const goldPricing = settings?.goldPricing;
  const companyName = settings?.company?.name || (t('gold_price.store') || (isArabic ? 'المتجر' : 'Store'));
  const goldPricesLabel = t('gold_price.title') || (isArabic ? 'أسعار الذهب' : 'Gold Prices');

  const formatAmount = (value: number, currency = data?.currency || 'SAR') =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  const formatTimestamp = (value?: string) => {
    if (!value) return t('gold_price.not_available') || (isArabic ? 'غير متاح' : 'Not available');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t('gold_price.not_available') || (isArabic ? 'غير متاح' : 'Not available');

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  };

  const loadPrices = async (forceRefresh = false) => {
    const setter = forceRefresh ? setRefreshing : setLoading;
    setter(true);
    setError(null);

    try {
      const response = await fetch(`/api/gold-price${forceRefresh ? '?refresh=1' : ''}`, {
        cache: 'no-store',
      });
      const result = (await response.json()) as GoldPriceResponse;

      if (!response.ok || !result.success || !result.pricePerGram) {
        throw new Error(result.error || (t('gold_price.load_failed') || 'Failed to load gold prices'));
      }

      setData(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : isArabic
            ? 'تعذر تحميل أسعار الذهب.'
            : 'Failed to load gold prices.'
      );
    } finally {
      setter(false);
    }
  };

  useEffect(() => {
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    const basePrice = Number(data?.pricePerGram || goldPricing?.cache?.pricePerGram || 0);

    return KARAT_CONFIG.map(({ karat, multiplier, purity }) => {
      const marketPrice = basePrice * multiplier;
      const taxRate = Number(goldPricing?.karatTaxRates?.[karat] || 0);
      const storePrice = marketPrice * (1 + taxRate / 100);

      return {
        karat,
        purity,
        marketPrice,
        taxRate,
        storePrice,
      };
    });
  }, [data?.pricePerGram, goldPricing?.cache?.pricePerGram, goldPricing?.karatTaxRates]);

  const sourceLabel =
    data?.source === 'remote'
      ? (t('gold_price.source_live') || (isArabic ? 'مباشر من المصدر' : 'Live source'))
      : data?.source === 'manual'
        ? (t('gold_price.source_manual') || (isArabic ? 'تحديث يدوي' : 'Manual source'))
        : (t('gold_price.source_cached') || (isArabic ? 'الكاش الحالي' : 'Cached source'));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_35%),linear-gradient(180deg,#fffdf8_0%,#f8f5ee_100%)]">
      <section className="page-container py-10 md:py-16">
        <div className="overflow-hidden rounded-[2rem] border border-[#ead9b2] bg-white/80 shadow-[0_30px_80px_rgba(140,104,32,0.12)] backdrop-blur">
          <div className="grid gap-8 border-b border-[#f0e2be] bg-[linear-gradient(135deg,rgba(247,230,182,0.55),rgba(255,255,255,0.92))] px-6 py-8 md:grid-cols-[1.35fr_0.85fr] md:px-10 md:py-12">
            <div>
              <span className="inline-flex items-center rounded-full border border-[#d4b161] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#8f6a1c]">
                {goldPricesLabel}
              </span>
              <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight text-[#23190a] md:text-5xl">
                {t('gold_price.hero_title') || (isArabic ? 'تابع أسعار الذهب حسب العيارات بشكل واضح ومباشر.' : 'Track live gold prices by karat with a cleaner storefront view.')}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5d4c29] md:text-base">
                {t('gold_price.hero_desc')
                  || (isArabic
                    ? 'تعرض الصفحة سعر الجرام الحالي لكل عيار، ونسبة ضريبة العيار المضبوطة من الإعدادات، والسعر النهائي المستخدم داخل المتجر قبل إضافة هامش أو مصنعية المنتج.'
                    : 'This page shows the current gram rate for each karat, the configured karat tax, and the effective store rate before each product-specific making charge is added.')}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadPrices(true)}
                  disabled={refreshing}
                  className="rounded-full bg-[#1f1608] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3a2b10] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing
                    ? (t('gold_price.refreshing') || (isArabic ? 'جارٍ التحديث...' : 'Refreshing...'))
                    : (t('gold_price.refresh_prices') || (isArabic ? 'تحديث الأسعار' : 'Refresh Prices'))}
                </button>
                <Link
                  href="/shop"
                  className="rounded-full border border-[#d8c18f] bg-white px-5 py-3 text-sm font-semibold text-[#4a3917] transition hover:border-[#b99751] hover:text-[#2f240f]"
                >
                  {t('gold_price.browse_products') || (isArabic ? 'تصفح المنتجات' : 'Browse Products')}
                </Link>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[#ead9b2] bg-[#fffaf0] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#7c6330]">
                    {t('gold_price.base_24k_label') || (isArabic ? 'سعر 24K الأساسي للجرام' : '24K base gram rate')}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#23190a]">
                    {formatAmount(Number(data?.pricePerGram || goldPricing?.cache?.pricePerGram || 0))}
                  </p>
                </div>
                <span className="rounded-full bg-[#f5e7bb] px-3 py-1 text-xs font-semibold text-[#7f5d17]">
                  {sourceLabel}
                </span>
              </div>

              <dl className="mt-6 space-y-4 text-sm text-[#6e5a30]">
                <div className="flex items-center justify-between gap-4 border-b border-[#f0e2be] pb-4">
                  <dt>{t('gold_price.last_update') || (isArabic ? 'آخر تحديث' : 'Last update')}</dt>
                  <dd className="font-medium text-[#2c200c]">{formatTimestamp(data?.fetchedAt || goldPricing?.cache?.fetchedAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-[#f0e2be] pb-4">
                  <dt>{t('gold_price.pricing_source') || (isArabic ? 'المصدر المستخدم في التسعير' : 'Pricing source')}</dt>
                  <dd className="font-medium text-[#2c200c]">{goldPricing?.provider === 'manual' ? (isArabic ? 'يدوي' : 'Manual') : 'goldpricez'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{t('gold_price.store') || (isArabic ? 'المتجر' : 'Store')}</dt>
                  <dd className="font-medium text-[#2c200c]">{companyName}</dd>
                </div>
              </dl>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 md:mx-10">
              {error}
            </div>
          )}

          <div className="px-6 py-8 md:px-10 md:py-10">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#23190a]">
                  {t('gold_price.rates_by_karat_title') || (isArabic ? 'أسعار الذهب حسب العيار' : 'Gold rates by karat')}
                </h2>
                <p className="mt-2 text-sm text-[#6f5d38]">
                  {t('gold_price.rates_by_karat_desc')
                    || (isArabic
                      ? 'كل بطاقة تعرض السعر السوقي للجرام ثم السعر بعد ضريبة العيار المضبوطة من لوحة التحكم.'
                      : 'Each card shows the market gram price first, then the price after the configured karat tax.')}
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <article
                  key={card.karat}
                  className="group rounded-[1.75rem] border border-[#ead9b2] bg-[linear-gradient(180deg,#fffefb_0%,#fbf4e4_100%)] p-5 shadow-[0_18px_45px_rgba(160,126,52,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(160,126,52,0.14)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9b7a31]">
                        {formatKaratLabel(card.karat)}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-[#23190a]">
                        {formatAmount(card.marketPrice)}
                      </h3>
                    </div>
                    <span className="rounded-full border border-[#e4cf98] bg-white px-3 py-1 text-xs font-medium text-[#7c6431]">
                      {card.purity}
                    </span>
                  </div>

                  <div className="mt-6 space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-[#644f24]">
                      <span>{t('gold_price.market_per_gram') || (isArabic ? 'السعر السوقي / جرام' : 'Market / gram')}</span>
                      <strong className="text-[#23190a]">{formatAmount(card.marketPrice)}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-[#644f24]">
                      <span>{t('gold_price.karat_tax') || (isArabic ? 'ضريبة العيار' : 'Karat tax')}</span>
                      <strong className="text-[#23190a]">{card.taxRate}%</strong>
                    </div>
                    <div className="rounded-2xl bg-[#1f1608] px-4 py-4 text-white">
                      <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.22em] text-[#d9c18d]">
                        <span>{t('gold_price.after_karat_tax') || (isArabic ? 'السعر بعد ضريبة العيار' : 'After karat tax')}</span>
                        <span>{formatKaratLabel(card.karat)}</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold">{formatAmount(card.storePrice)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-[#ead9b2] bg-[#fff9ec] p-6">
              <h3 className="text-lg font-bold text-[#23190a]">
                {t('gold_price.how_pricing_works_title') || (isArabic ? 'كيف يتم التسعير داخل المتجر؟' : 'How pricing works in the store')}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#634f24]">
                {t('gold_price.how_pricing_works_desc')
                  || (isArabic
                    ? 'السعر النهائي للمنتج الذهبي يعتمد على: سعر الذهب الحالي حسب العيار، ثم الوزن، ثم ضريبة نفس العيار من الإعدادات، وبعد ذلك تُضاف المصنعية/الهامش الخاص بالمنتج إذا كان مضبوطًا داخل بيانات المنتج.'
                    : 'A gold-priced product is calculated from the current gold market rate for its karat, then the product weight, then that karat tax from settings, and finally the product-specific making charge or manual adjustment if configured.')}
              </p>
            </div>
          </div>
        </div>

        {(loading || refreshing) && !data && (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-60 animate-pulse rounded-[1.75rem] border border-[#ead9b2] bg-white/70"
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default GoldPriceClient;
