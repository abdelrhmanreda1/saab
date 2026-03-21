'use client';

import arabicPack from '@/data/translations/ar.json';
import { defaultSettings, Settings } from '@/lib/firestore/settings';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type HomeLanguage = {
  code: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
  isActive: boolean;
};

type HomeCurrency = {
  code: string;
  name: string;
  symbol: string;
  symbolPosition: 'left' | 'right';
  decimalPlaces: number;
  isActive: boolean;
  isDefault: boolean;
};

type InitialHomeCurrency = {
  code?: string;
  name?: string;
  symbol?: string;
  symbolPosition?: 'left' | 'right';
  decimalPlaces?: number;
};

type HomeSettingsContextType = {
  settings: Settings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
};

type HomeLanguageContextType = {
  currentLanguage: HomeLanguage | null;
  languages: HomeLanguage[];
  translations: Record<string, string>;
  setLanguage: (language: HomeLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
};

type HomeCurrencyContextType = {
  formatPrice: (amount: number) => string;
  convertPrice: (amount: number, fromCurrency?: string, toCurrency?: string) => Promise<number>;
  defaultCurrency: HomeCurrency | null;
  isLoading: boolean;
};

const EN_TRANSLATIONS: Record<string, string> = {
  'common.home': 'Home',
  'common.account': 'Account',
  'common.cart': 'Cart',
  'common.search': 'Search',
  'common.blog': 'Blog',
  'common.brands': 'Brands',
  'nav.home': 'Home',
  'nav.shop': 'Shop',
  'nav.categories': 'Categories',
  'nav.about': 'About',
  'nav.contact': 'Contact',
  'nav.gold_prices': 'Gold Prices',
  'header.open_menu': 'Open navigation menu',
  'header.close_menu': 'Close navigation menu',
  'header.menu': 'Menu',
  'topbar.gold_24k': 'Gold 24K',
  'topbar.gold_22k': 'Gold 22K',
  'topbar.gold_21k': 'Gold 21K',
  'topbar.gold_18k': 'Gold 18K',
  'topbar.currency_sar': 'SAR',
  'topbar.show_other_prices': 'Show other prices',
  'topbar.hide_other_prices': 'Hide other prices',
  'topbar.promo': 'FREE SHIPPING ON ORDERS OVER $100',
  'home.banner_title': 'Discover Your Elegance',
  'home.banner_subtitle': 'Explore our latest collection of premium jewelry.',
  'home.limited_time_offer': 'Limited Time Offer',
  'home.shop_collection': 'Shop Collection',
  'home.shop_flash_sale': 'Shop Flash Sale',
  'home.welcome': 'Welcome to {company}',
  'home.shop_now': 'Shop Now',
  'home.explore_collection': 'Explore Collection',
  'home.view_product': 'View product: {{name}}',
  'home.trust_free_shipping': 'Free Shipping',
  'home.trust_free_shipping_desc': 'On orders over $100',
  'home.trust_secure_payment': 'Secure Payment',
  'home.trust_secure_payment_desc': '100% secure checkout',
  'home.trust_authentic': 'Authentic Products',
  'home.trust_authentic_desc': '100% genuine items',
  'home.trust_easy_returns': 'Easy Returns',
  'home.trust_easy_returns_desc': '30-day return policy',
  'home.featured': 'Featured Collection',
  'home.featured_desc': 'Curated picks just for you',
  'home.shop_by_category': 'Shop by Category',
  'home.shop_by_category_desc': 'Browse by your favorite categories',
  'home.flash_sale': 'Flash Sale',
  'home.flash_sale_desc': 'Limited time offers - grab them before they are gone',
  'home.collections': 'Our Collections',
  'home.collections_desc': 'Explore curated collections designed for you',
  'home.special_offers': 'Special Offers',
  'home.bundle_deals': 'Exclusive bundle deals and offers',
  'home.view_bundle': 'View Bundle',
  'home.testimonials_title': 'What Our Customers Say',
  'home.testimonials_subtitle': 'Real reviews from real customers',
  'home.verified_purchase': 'Verified Purchase',
  'home.blog_title': 'Latest from Our Blog',
  'home.blog_subtitle': 'Fashion tips, style guides, and more',
  'home.view_all_blog': 'View All',
  'home.read_more': 'Read More',
  'home.newsletter_title': 'Subscribe to Our Newsletter',
  'home.newsletter_subtitle': 'Get exclusive offers and updates',
  'home.newsletter_discount': 'Get 10% off your first order!',
  'home.newsletter_placeholder': 'Enter your email',
  'home.newsletter_subscribe': 'Subscribe',
  'home.newsletter_subscribing': 'Subscribing...',
  'home.newsletter_success': 'Thank you for subscribing!',
  'footer.newsletter_title': 'Join Our Newsletter',
  'footer.newsletter_description':
    'Sign up for exclusive offers, new arrivals, and fashion tips directly to your inbox.',
  'footer.email_placeholder': 'Enter your email address',
  'footer.subscribing': 'Subscribing...',
  'footer.subscribed': 'Subscribed!',
  'footer.subscribe': 'Subscribe',
  'footer.subscribe_thanks': 'Thank you for subscribing!',
  'footer.subscribe_failed': 'Failed to subscribe. Please try again.',
  'footer.email_invalid': 'Please enter a valid email address.',
  'footer.scroll_to_top': 'Scroll to top',
  'footer.shop': 'Shop',
  'footer.all_products': 'All Products',
  'footer.new_arrivals': 'New Arrivals',
  'footer.company': 'Company',
  'footer.about_us': 'About Us',
  'footer.careers': 'Careers',
  'footer.store_locator': 'Store Locator',
  'footer.contact': 'Contact',
  'footer.support': 'Support',
  'footer.faq': 'FAQs',
  'footer.shipping': 'Shipping & Returns',
  'footer.size_guide': 'Size Guide',
  'footer.track_order': 'Track Order',
  'footer.follow_us': 'Follow Us',
  'footer.social_facebook': 'Facebook',
  'footer.social_instagram': 'Instagram',
  'footer.social_twitter': 'Twitter',
  'footer.social_youtube': 'YouTube',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.we_accept': 'We accept:',
  'product.badge_new': 'New',
  'product.badge_sale': 'Sale',
  'product.badge_best_seller': 'Best Seller',
  'product.in_stock': 'In Stock',
  'product.low_stock': 'Low Stock',
};

const AR_HOME_OVERRIDES: Record<string, string> = {
  'common.blog': 'المدونة',
  'common.brands': 'العلامات التجارية',
  'nav.home': 'الرئيسية',
  'nav.shop': 'المتجر',
  'nav.categories': 'الأقسام',
  'nav.about': 'من نحن',
  'nav.contact': 'تواصل معنا',
  'nav.gold_prices': 'أسعار الذهب',
  'topbar.promo': 'شحن مجاني للطلبات فوق $100',
  'home.banner_title': 'اكتشف أناقتك',
  'home.banner_subtitle': 'استكشف أحدث مجموعاتنا من المجوهرات الراقية.',
  'home.shop_collection': 'تسوق المجموعة',
  'home.shop_flash_sale': 'تسوق عروض الفلاش',
  'home.shop_now': 'تسوق الآن',
  'home.explore_collection': 'استكشف المجموعة',
  'home.featured': 'المنتجات المميزة',
  'home.featured_desc': 'قطعنا الأكثر حبًا، مختارة لك',
  'home.shop_by_category': 'تسوق حسب الفئة',
  'home.shop_by_category_desc': 'اكتشف المجموعات التي تعبر عن ذوقك',
  'home.collections': 'المجموعات المميزة',
  'home.collections_desc': 'مختارات منسقة لكل مناسبة',
  'home.blog_title': 'أحدث مقالات المدونة',
  'home.blog_subtitle': 'نصائح موضة ودلائل أناقة والمزيد',
  'home.view_all_blog': 'عرض الكل',
  'home.read_more': 'اقرأ المزيد',
  'footer.newsletter_title': 'اشترك في النشرة البريدية',
  'footer.newsletter_description':
    'سجّل للحصول على العروض الحصرية، والقطع الجديدة، ونصائح الأناقة مباشرة إلى بريدك.',
  'footer.email_placeholder': 'أدخل بريدك الإلكتروني',
  'footer.subscribing': 'جارٍ الاشتراك...',
  'footer.subscribed': 'تم الاشتراك!',
  'footer.subscribe': 'اشترك',
  'footer.subscribe_thanks': 'شكرًا لاشتراكك!',
  'footer.subscribe_failed': 'فشل الاشتراك. حاول مرة أخرى.',
  'footer.email_invalid': 'يرجى إدخال بريد إلكتروني صحيح.',
  'footer.scroll_to_top': 'الرجوع للأعلى',
  'footer.shop': 'المتجر',
  'footer.all_products': 'كل المنتجات',
  'footer.new_arrivals': 'وصل حديثًا',
  'footer.company': 'الشركة',
  'footer.about_us': 'من نحن',
  'footer.careers': 'الوظائف',
  'footer.store_locator': 'فروعنا',
  'footer.contact': 'تواصل معنا',
  'footer.support': 'الدعم',
  'footer.faq': 'الأسئلة الشائعة',
  'footer.shipping': 'الشحن والإرجاع',
  'footer.size_guide': 'دليل المقاسات',
  'footer.track_order': 'تتبع الطلب',
  'footer.follow_us': 'تابعنا',
  'footer.social_facebook': 'فيسبوك',
  'footer.social_instagram': 'إنستغرام',
  'footer.social_twitter': 'إكس',
  'footer.social_youtube': 'يوتيوب',
  'footer.privacy': 'سياسة الخصوصية',
  'footer.terms': 'الشروط والأحكام',
  'footer.we_accept': 'نقبل:',
};

const HOME_LANGUAGES: HomeLanguage[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRTL: true, isActive: true },
  { code: 'en', name: 'English', nativeName: 'English', isRTL: false, isActive: true },
];

const HomeSettingsContext = createContext<HomeSettingsContextType | undefined>(undefined);
const HomeLanguageContext = createContext<HomeLanguageContextType | undefined>(undefined);
const HomeCurrencyContext = createContext<HomeCurrencyContextType | undefined>(undefined);

function getInitialLanguage(defaultLanguageCode: string) {
  if (typeof window !== 'undefined') {
    const saved = (localStorage.getItem('preferredLanguage') || '').trim().toLowerCase();
    if (saved === 'ar' || saved === 'en') {
      return HOME_LANGUAGES.find((language) => language.code === saved) || HOME_LANGUAGES[0];
    }
  }

  const normalized = (defaultLanguageCode || 'ar').trim().toLowerCase();
  return HOME_LANGUAGES.find((language) => language.code === normalized) || HOME_LANGUAGES[0];
}

function getTranslationsFor(code: string) {
  if (code === 'ar') {
    return { ...EN_TRANSLATIONS, ...(arabicPack as Record<string, string>), ...AR_HOME_OVERRIDES };
  }
  return EN_TRANSLATIONS;
}

function applyTheme(settings: Settings) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const theme = settings?.theme;
  const fontMap: Record<string, string> = {
    Inter: 'var(--font-inter), Inter, sans-serif',
    Cairo: 'var(--font-arabic), Cairo, sans-serif',
    Poppins: 'var(--font-inter), Inter, sans-serif',
    Roboto: 'var(--font-inter), Inter, sans-serif',
    'Open Sans': 'var(--font-inter), Inter, sans-serif',
    Montserrat: 'var(--font-inter), Inter, sans-serif',
  };

  root.style.setProperty('--theme-heading-font', fontMap[theme?.fonts?.heading || 'Inter'] || fontMap.Inter);
  root.style.setProperty('--theme-body-font', fontMap[theme?.fonts?.body || 'Inter'] || fontMap.Inter);
  root.style.setProperty('--theme-header-bg', theme?.colors?.headerBackground || '#ffffff');
  root.style.setProperty('--theme-header-text', theme?.colors?.headerText || '#000000');
  root.style.setProperty('--theme-footer-bg', theme?.colors?.footerBackground || '#111827');
  root.style.setProperty('--theme-footer-text', theme?.colors?.footerText || '#ffffff');
  root.style.setProperty('--theme-primary-button', theme?.colors?.primaryButton || '#000000');
  root.style.setProperty('--theme-primary-button-text', theme?.colors?.primaryButtonText || '#ffffff');
  root.style.setProperty('--theme-secondary-button', theme?.colors?.secondaryButton || '#f3f4f6');
  root.style.setProperty('--theme-secondary-button-text', theme?.colors?.secondaryButtonText || '#000000');
}

export function HomeProviders({
  children,
  initialSettings,
  initialCurrency = null,
}: {
  children: React.ReactNode;
  initialSettings: Settings | null;
  initialCurrency?: InitialHomeCurrency | null;
}) {
  const settings = useMemo(
    () => (initialSettings ? ({ ...defaultSettings, ...initialSettings } as Settings) : defaultSettings),
    [initialSettings]
  );
  const [currentLanguage, setCurrentLanguageState] = useState<HomeLanguage>(() =>
    getInitialLanguage(settings?.site?.language || 'ar')
  );
  const [translations, setTranslations] = useState<Record<string, string>>(() =>
    getTranslationsFor(getInitialLanguage(settings?.site?.language || 'ar').code)
  );

  useEffect(() => {
    document.documentElement.lang = currentLanguage?.code || 'ar';
    document.documentElement.dir = currentLanguage?.isRTL ? 'rtl' : 'ltr';
    localStorage.setItem('preferredLanguage', currentLanguage?.code || 'ar');
  }, [currentLanguage]);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  const setLanguage = useCallback(async (language: HomeLanguage) => {
    setCurrentLanguageState(language);
    setTranslations(getTranslationsFor(language.code));
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let translation = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          translation = translation.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
          translation = translation.replace(new RegExp(`{${paramKey}}`, 'g'), String(value));
        });
      }
      return translation;
    },
    [translations]
  );

  const defaultCurrency = useMemo<HomeCurrency>(
    () => ({
      code: 'SAR',
      name: 'Saudi Riyal',
      symbol: 'ر.س',
      symbolPosition: 'right',
      decimalPlaces: Number(initialCurrency?.decimalPlaces ?? settings?.site?.digitsAfterDecimal ?? 0),
      isActive: true,
      isDefault: true,
    }),
    [initialCurrency?.decimalPlaces, settings]
  );

  const formatPrice = useCallback(
    (amount: number) => {
      const formattedAmount = Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: defaultCurrency.decimalPlaces || 0,
      });
      return defaultCurrency.symbolPosition === 'left'
        ? `${defaultCurrency.symbol} ${formattedAmount}`
        : `${formattedAmount} ${defaultCurrency.symbol}`;
    },
    [defaultCurrency]
  );

  const settingsValue = useMemo<HomeSettingsContextType>(
    () => ({ settings, loading: false, refreshSettings: async () => {} }),
    [settings]
  );
  const languageValue = useMemo<HomeLanguageContextType>(
    () => ({
      currentLanguage,
      languages: HOME_LANGUAGES,
      translations,
      setLanguage,
      t,
      isLoading: false,
    }),
    [currentLanguage, setLanguage, t, translations]
  );
  const currencyValue = useMemo<HomeCurrencyContextType>(
    () => ({
      formatPrice,
      convertPrice: async (amount: number) => amount,
      defaultCurrency,
      isLoading: false,
    }),
    [defaultCurrency, formatPrice]
  );

  return (
    <HomeSettingsContext.Provider value={settingsValue}>
      <HomeLanguageContext.Provider value={languageValue}>
        <HomeCurrencyContext.Provider value={currencyValue}>{children}</HomeCurrencyContext.Provider>
      </HomeLanguageContext.Provider>
    </HomeSettingsContext.Provider>
  );
}

export function useHomeSettings() {
  const context = useContext(HomeSettingsContext);
  if (!context) throw new Error('useHomeSettings must be used within HomeProviders');
  return context;
}

export function useHomeLanguage() {
  const context = useContext(HomeLanguageContext);
  if (!context) throw new Error('useHomeLanguage must be used within HomeProviders');
  return context;
}

export function useHomeCurrency() {
  const context = useContext(HomeCurrencyContext);
  if (!context) throw new Error('useHomeCurrency must be used within HomeProviders');
  return context;
}
