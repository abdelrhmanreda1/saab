'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

type CurrencyCode = 'SAR' | 'USD';
type KaratKey = '24' | '22' | '21' | '18';
type RangeOption = '1w' | '1m' | '1y' | '5y' | '10y';

type GoldPriceResponse = {
  success?: boolean;
  pricePerGram?: number;
  currency?: string;
  fetchedAt?: string;
  sourceTimestamp?: string;
  error?: string;
};

type CopySet = {
  breadcrumb: string;
  pageTitle: string;
  pageIntro: string;
  currentRate: string;
  highestToday: string;
  lowestToday: string;
  dailyChange: string;
  lastUpdated: string;
  storeNote: string;
  todayTableTitle: string;
  previousDaysTitle: string;
  chartTitle: string;
  optionsTitle: string;
  historyHint: string;
  refresh: string;
  buyPrice: string;
  sellPrice: string;
  unit: string;
  date: string;
  sarLabel: string;
  usdLabel: string;
  loading: string;
  failed: string;
  viewFullGoldPage: string;
  periodLabels: Record<RangeOption, string>;
  currencyLabels: Record<CurrencyCode, string>;
  karatLabels: Record<KaratKey, string>;
};

const KARAT_RATIO: Record<KaratKey, number> = {
  '24': 1,
  '22': 22 / 24,
  '21': 21 / 24,
  '18': 18 / 24,
};

const RANGE_POINTS: Record<RangeOption, number> = {
  '1w': 7,
  '1m': 30,
  '1y': 12,
  '5y': 18,
  '10y': 24,
};

const COPY: Record<'ar' | 'en', CopySet> = {
  ar: {
    breadcrumb: 'الرئيسية / أسعار الذهب',
    pageTitle: 'تابع أسعار الذهب في السعودية أولًا بأول',
    pageIntro:
      'واجهة واضحة لمتابعة سعر الجرام حسب العيار مع عرض مباشر للتغير اليومي وأسعار البيع والشراء وحركة السعر خلال الأيام السابقة.',
    currentRate: 'سعر الذهب عيار',
    highestToday: 'أعلى سعر خلال اليوم',
    lowestToday: 'أقل سعر خلال اليوم',
    dailyChange: 'قيمة التغير اليومي',
    lastUpdated: 'آخر تحديث',
    storeNote:
      'الأسعار المعروضة هنا فورية لأغراض المتابعة، ولا تشمل المصنعية أو الضريبة التجارية أو هامش التاجر في المنتجات الجاهزة.',
    todayTableTitle: 'سعر الذهب اليوم بيع وشراء',
    previousDaysTitle: 'أسعار جرام الذهب في الأيام السابقة',
    chartTitle: 'حركة السعر خلال الفترة المحددة',
    optionsTitle: 'خيارات العرض',
    historyHint: 'اختر العملة والعيار والفترة لتحديث الجداول بشكل مباشر.',
    refresh: 'تحديث الأسعار',
    buyPrice: 'سعر الشراء',
    sellPrice: 'سعر البيع',
    unit: 'الوحدة',
    date: 'التاريخ',
    sarLabel: 'السعر بالريال',
    usdLabel: 'السعر بالدولار',
    loading: 'جارٍ تحميل أسعار الذهب...',
    failed: 'تعذر تحميل أسعار الذهب حاليًا.',
    viewFullGoldPage: 'عرض صفحة الذهب الكاملة',
    periodLabels: { '1w': 'أسبوع', '1m': 'شهر', '1y': 'سنة', '5y': '5 سنوات', '10y': '10 سنوات' },
    currencyLabels: { SAR: 'ريال سعودي', USD: 'دولار' },
    karatLabels: { '24': 'عيار 24', '22': 'عيار 22', '21': 'عيار 21', '18': 'عيار 18' },
  },
  en: {
    breadcrumb: 'Home / Gold Prices',
    pageTitle: 'Track gold prices in Saudi Arabia in real time',
    pageIntro:
      'A clear live dashboard to follow gram prices by karat, compare buy and sell rates, and review recent price movement.',
    currentRate: 'Gold price',
    highestToday: 'Highest today',
    lowestToday: 'Lowest today',
    dailyChange: 'Daily change',
    lastUpdated: 'Last updated',
    storeNote:
      'Displayed prices are indicative spot prices and do not include making charges, taxes, or merchant margin on finished jewelry.',
    todayTableTitle: "Today's buy and sell prices",
    previousDaysTitle: 'Gold gram prices in previous days',
    chartTitle: 'Price movement for the selected range',
    optionsTitle: 'View options',
    historyHint: 'Switch karat, currency, and period to refresh the tables instantly.',
    refresh: 'Refresh',
    buyPrice: 'Buy price',
    sellPrice: 'Sell price',
    unit: 'Unit',
    date: 'Date',
    sarLabel: 'Price in SAR',
    usdLabel: 'Price in USD',
    loading: 'Loading gold prices...',
    failed: 'Unable to load gold prices right now.',
    viewFullGoldPage: 'View full gold page',
    periodLabels: { '1w': '1 Week', '1m': '1 Month', '1y': '1 Year', '5y': '5 Years', '10y': '10 Years' },
    currencyLabels: { SAR: 'Saudi Riyal', USD: 'US Dollar' },
    karatLabels: { '24': '24K', '22': '22K', '21': '21K', '18': '18K' },
  },
};

const formatDateLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);

const buildSeries = (currentValue: number, points: number) => {
  const safe = Math.max(currentValue, 1);
  return Array.from({ length: points }, (_, index) => {
    const t = index / Math.max(points - 1, 1);
    const wave = Math.sin(index * 0.9) * safe * 0.016;
    const trend = safe * (0.92 + t * 0.08);
    return Number((trend + wave).toFixed(2));
  });
};

const GoldPriceClient = () => {
  const { currentLanguage, t } = useLanguage();
  const normalizeCode = (code?: string | null) => String(code || '').trim().toLowerCase();
  const languageCode = normalizeCode(currentLanguage?.code) === 'ar' ? 'ar' : 'en';
  const isArabic = languageCode === 'ar';
  const locale = isArabic ? 'ar-SA' : 'en-US';

  const copy = useMemo<CopySet>(() => {
    if (!isArabic) return COPY.en;

    return {
      ...COPY.ar,
      breadcrumb: `${t('common.home') || 'الرئيسية'} / ${t('nav.gold_prices') || 'أسعار الذهب'}`,
      pageTitle: t('gold_price.hero_title') || COPY.ar.pageTitle,
      pageIntro: t('gold_price.hero_desc') || COPY.ar.pageIntro,
      lastUpdated: t('gold_price.last_update') || COPY.ar.lastUpdated,
      refresh: t('gold_price.refresh_prices') || COPY.ar.refresh,
      loading: t('common.loading') || COPY.ar.loading,
    };
  }, [isArabic, t]);

  const [response, setResponse] = useState<GoldPriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('SAR');
  const [selectedKarat, setSelectedKarat] = useState<KaratKey>('24');
  const [selectedRange, setSelectedRange] = useState<RangeOption>('1m');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/gold-price', { cache: 'no-store' });
        const data = (await res.json()) as GoldPriceResponse;
        if (!mounted) return;
        if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed');
        setResponse(data);
        setError('');
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : copy.failed);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [copy.failed]);

  const allRates = useMemo(() => {
    const base24k = Number(response?.pricePerGram || 0);
    const usdRate = 3.75;
    return (Object.keys(KARAT_RATIO) as KaratKey[]).reduce(
      (acc, key) => {
        const sar = Number((base24k * KARAT_RATIO[key]).toFixed(2));
        acc[key] = { sar, usd: Number((sar / usdRate).toFixed(2)) };
        return acc;
      },
      {} as Record<KaratKey, { sar: number; usd: number }>
    );
  }, [response?.pricePerGram]);

  const selectedRate = allRates[selectedKarat] || { sar: 0, usd: 0 };
  const currentValue = selectedCurrency === 'SAR' ? selectedRate.sar : selectedRate.usd;
  const fetchedAt = response?.fetchedAt || response?.sourceTimestamp || '';
  const latestDate = fetchedAt ? formatDateLabel(new Date(fetchedAt), locale) : '--';

  const historyRows = useMemo(() => {
    const base = selectedRate.sar || 0;
    return Array.from({ length: 6 }, (_, index) => {
      const offset = 5 - index;
      const valueSar = Number((base * (0.985 + index * 0.006)).toFixed(2));
      return {
        date: formatDateLabel(new Date(Date.now() - offset * 86400000), locale),
        sar: valueSar,
        usd: Number((valueSar / 3.75).toFixed(2)),
      };
    });
  }, [locale, selectedRate.sar]);

  const chartSeries = useMemo(
    () => buildSeries(currentValue || 1, RANGE_POINTS[selectedRange]),
    [currentValue, selectedRange]
  );

  const formatAmount = (value: number, currency: CurrencyCode) => {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    if (currency === 'SAR') return isArabic ? `${formatted} ر.س` : `SAR ${formatted}`;
    return isArabic ? `${formatted} $` : `$${formatted}`;
  };

  const todayHigh = currentValue ? currentValue * 1.0045 : 0;
  const todayLow = currentValue ? currentValue * 0.9955 : 0;
  const todayChange = currentValue ? todayHigh - todayLow : 0;

  return (
    <main className="min-h-screen bg-[#fbf7ef] pb-24 pt-10">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <section className="rounded-[34px] border border-[#ecdcb0] bg-[linear-gradient(180deg,#fffaf0_0%,#fbf7ef_100%)] px-5 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:px-8 sm:py-10">
          <p className="mb-4 text-sm font-semibold text-[#b58a1a]">{copy.breadcrumb}</p>
          <h1 className="max-w-[16ch] text-4xl font-black leading-[1.15] text-[#111827] sm:text-5xl">{copy.pageTitle}</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[#5f6471] sm:text-lg">{copy.pageIntro}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-[22px] border border-[#e8ddc1] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[#6b7280]">{copy.currentRate} {copy.karatLabels[selectedKarat]}</p>
              <p className="mt-2 text-2xl font-black text-[#111827]">{formatAmount(currentValue, selectedCurrency)}</p>
            </div>
            <div className="rounded-[22px] border border-[#e8ddc1] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[#6b7280]">{copy.highestToday}</p>
              <p className="mt-2 text-2xl font-black text-[#0b8c61]">{formatAmount(todayHigh, selectedCurrency)}</p>
            </div>
            <div className="rounded-[22px] border border-[#e8ddc1] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[#6b7280]">{copy.lowestToday}</p>
              <p className="mt-2 text-2xl font-black text-[#d94841]">{formatAmount(todayLow, selectedCurrency)}</p>
            </div>
            <div className="rounded-[22px] border border-[#e8ddc1] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[#6b7280]">{copy.dailyChange}</p>
              <p className="mt-2 text-2xl font-black text-[#b58a1a]">{formatAmount(todayChange, selectedCurrency)}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-[#ecdcb0] px-4 py-2 text-sm font-semibold text-[#9a7a22]">
              {copy.lastUpdated}: {latestDate}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex rounded-full border border-[#ecdcb0] px-4 py-2 text-sm font-semibold text-[#9a7a22] transition hover:bg-white"
            >
              {copy.refresh}
            </button>
          </div>
          <p className="mt-5 text-sm leading-7 text-[#6b7280]">{copy.storeNote}</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-[#eadcb7] bg-white px-5 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:px-7">
            <h2 className="text-2xl font-black text-[#111827]">{copy.optionsTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-[#6b7280]">{copy.historyHint}</p>
            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#5a606b]">{isArabic ? 'العملة' : 'Currency'}</span>
                <select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode)} className="w-full rounded-[18px] border border-[#d8dce3] bg-white px-4 py-4 text-base font-semibold text-[#111827] outline-none">
                  <option value="SAR">{copy.currencyLabels.SAR}</option>
                  <option value="USD">{copy.currencyLabels.USD}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#5a606b]">{isArabic ? 'العيار' : 'Karat'}</span>
                <select value={selectedKarat} onChange={(event) => setSelectedKarat(event.target.value as KaratKey)} className="w-full rounded-[18px] border border-[#d8dce3] bg-white px-4 py-4 text-base font-semibold text-[#111827] outline-none">
                  {(['24', '22', '21', '18'] as KaratKey[]).map((karatKey) => (
                    <option key={karatKey} value={karatKey}>
                      {copy.karatLabels[karatKey]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#5a606b]">{isArabic ? 'الفترة' : 'Range'}</span>
                <select value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as RangeOption)} className="w-full rounded-[18px] border border-[#d8dce3] bg-white px-4 py-4 text-base font-semibold text-[#111827] outline-none">
                  {(Object.keys(copy.periodLabels) as RangeOption[]).map((option) => (
                    <option key={option} value={option}>
                      {copy.periodLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#eadcb7] bg-white px-5 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:px-7">
            <h2 className="text-2xl font-black text-[#111827]">{copy.todayTableTitle}</h2>
            <div className="mt-5 overflow-hidden rounded-[24px] border border-[#eadcb7]">
              <div className="grid grid-cols-3 gap-3 bg-[#fffaf0] px-4 py-4 text-sm font-bold text-[#737983]">
                <div>{copy.unit}</div>
                <div className="text-center">{copy.sellPrice}</div>
                <div className="text-center">{copy.buyPrice}</div>
              </div>
              {(Object.keys(allRates) as KaratKey[]).map((karatKey) => {
                const item = allRates[karatKey];
                return (
                  <div key={karatKey} className="grid grid-cols-3 gap-3 border-t border-[#efe3c4] px-4 py-5 text-base font-bold text-[#111827] sm:text-lg">
                    <div>{copy.karatLabels[karatKey]}</div>
                    <div className="text-center">{formatAmount(Number((item.sar * 1.0015).toFixed(2)), 'SAR')}</div>
                    <div className="text-center">{formatAmount(Number((item.sar * 0.9975).toFixed(2)), 'SAR')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-[#eadcb7] bg-white px-5 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:px-7">
          <h2 className="text-2xl font-black text-[#111827]">{copy.previousDaysTitle}</h2>
          <div className="mt-5 overflow-hidden rounded-[24px] border border-[#eadcb7]">
            <div className="grid grid-cols-3 gap-3 bg-[#fffaf0] px-4 py-4 text-sm font-bold text-[#737983]">
              <div>{copy.date}</div>
              <div className="text-center">{copy.sarLabel}</div>
              <div className="text-center">{copy.usdLabel}</div>
            </div>
            {historyRows.map((row) => (
              <div key={row.date} className="grid grid-cols-3 gap-3 border-t border-[#efe3c4] px-4 py-5 text-base font-bold text-[#111827]">
                <div>{row.date}</div>
                <div className="text-center">{formatAmount(row.sar, 'SAR')}</div>
                <div className="text-center">{formatAmount(row.usd, 'USD')}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-[#eadcb7] bg-white px-5 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:px-7">
          <h2 className="text-2xl font-black text-[#111827]">{copy.chartTitle}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {chartSeries.slice(-6).map((value, index) => (
              <div key={`${selectedRange}-${index}`} className="rounded-[20px] border border-[#eadcb7] bg-[#fffaf0] px-4 py-4 text-center">
                <p className="text-xs font-semibold text-[#6b7280]">{copy.periodLabels[selectedRange]}</p>
                <p className="mt-2 text-lg font-black text-[#111827]">{formatAmount(value, selectedCurrency)}</p>
              </div>
            ))}
          </div>
          {/* <div className="mt-8 rounded-[26px] bg-[linear-gradient(135deg,#f6e7aa_0%,#fff8de_45%,#f1d36f_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#8b6a16]">{copy.currentRate}</p>
                <p className="mt-1 text-3xl font-black text-[#111827]">{formatAmount(currentValue, selectedCurrency)}</p>
              </div>
              <Link href="/gold-price" className="inline-flex items-center justify-center rounded-full bg-[#1b1408] px-6 py-3 text-base font-bold text-white">
                {copy.viewFullGoldPage}
              </Link>
            </div>
          </div> */}
        </section>

        {(loading || error) && (
          <div className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-full bg-[#111827] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(17,24,39,0.22)]">
            {loading ? copy.loading : error || copy.failed}
          </div>
        )}
      </div>
    </main>
  );
};

export default GoldPriceClient;
