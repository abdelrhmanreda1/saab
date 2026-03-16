export interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  zipCode: string;
}

export interface SiteSettings {
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  defaultCountry: string; // ISO country code (e.g., PK, US)
  language: string;
  androidAppLink: string;
  iosAppLink: string;
  copyrightText: string;
  currency: string;
  currencyPosition: 'left' | 'right';
  digitsAfterDecimal: number;
  phoneDigitLength: number;
  paymentGateway: 'stripe' | 'none';
  enableLanguageSwitcher: boolean;
  enableUserAccountCreation: boolean;
  enablePhoneVerification: boolean;
  enablePhoneLogin: boolean;
  enableGoogleLogin: boolean;
  enableEmailLogin: boolean;
  googleMapsApiKey?: string;
}

export interface SMTPSettings {
  host: string;
  port: string;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  encryption: 'tls' | 'ssl' | 'none';
}

export interface SocialSettings {
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  imageUrl: string;
  order?: number;
}

export interface ThemeSettings {
  logoUrl: string;
  faviconUrl: string;
  loginImageUrl?: string;
  colors?: {
    headerBackground?: string;
    headerText?: string;
    footerBackground?: string;
    footerText?: string;
    primaryButton?: string;
    primaryButtonText?: string;
    secondaryButton?: string;
    secondaryButtonText?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
  topBar?: {
    enabled: boolean;
    text: string;
    backgroundColor?: string;
    textColor?: string;
  };
  paymentMethods?: PaymentMethod[];
}

export interface FeaturesSettings {
  category: boolean;
  brands: boolean;
  collections: boolean;
  size: boolean;
  colors: boolean;
  banners: boolean;
  coupons: boolean;
  emailMarketing: boolean;
  notifications: boolean;
  blog: boolean;
  wishlist: boolean;
  productReviews: boolean;
  productBundles: boolean;
  preOrders: boolean;
  productTemplates: boolean;
  recentlyViewed: boolean;
  productRecommendations: boolean;
  importExport: boolean;
  abandonedCarts: boolean;
  customerSegmentation: boolean;
  liveChat: boolean;
}

export interface PagesSettings {
  aboutUs: boolean;
  privacyPolicy: boolean;
  termsOfService: boolean;
  shippingReturns: boolean;
  sizeGuide: boolean;
  storeLocator: boolean;
  careers: boolean;
  faqs: boolean;
  contactUs: boolean;
}

export interface GeographySettings {
  countries: boolean;
  states: boolean;
  cities: boolean;
}

export interface PaymentSettings {
  enableCOD: boolean; // Cash on Delivery
  enableLocalPayment: boolean;
  enableOnlinePayment: boolean;
  enableAdvancePayment: boolean;
  advancePaymentType: 'percentage' | 'fixed'; // Percentage or Fixed amount
  advancePaymentValue: number; // Percentage (0-100) or Fixed amount
  enableWallet: boolean;
  enableLoyaltyPoint: boolean;
  loyaltyPointValue: number; // Conversion rate: 1 point = X amount
}

export interface GiftWrapSettings {
  enabled: boolean;
  price: number;
  description: string;
}

export interface GoldPricingSettings {
  enabled: boolean;
  provider: 'manual' | 'goldpricez';
  apiUrl: string;
  refreshIntervalSeconds: number;
  manualPricePerGram: number;
  defaultMarginType: 'fixed' | 'percentage';
  defaultMarginValue: number;
  taxRatePercentage?: number; // Legacy global tax rate kept for backward compatibility
  karatTaxRates: {
    '24K': number;
    '22K': number;
    '21K': number;
    '18K': number;
  };
  cache?: {
    pricePerGram?: number;
    currency?: string;
    fetchedAt?: string;
    sourceTimestamp?: string;
    source?: string;
  };
}

export interface EmailNotificationSettings {
  // Customer Email Notifications
  customerOrderPlaced: boolean;
  customerOrderPlacedSubject?: string;
  customerOrderPlacedTemplate?: string;
  
  customerOrderStatusUpdate: boolean;
  customerOrderStatusUpdateSubject?: string;
  customerOrderStatusUpdateTemplate?: string;
  
  customerOrderDelivered: boolean;
  customerOrderDeliveredSubject?: string;
  customerOrderDeliveredTemplate?: string;
  
  // Admin Email Notifications
  adminNewOrder: boolean;
  adminNewOrderEmails?: string[]; // Comma-separated email addresses
  adminNewOrderSubject?: string;
  adminNewOrderTemplate?: string;
}

export interface SEOSettings {
  siteTitle: string;
  siteDescription: string;
  siteKeywords: string[];
  defaultMetaImage?: string;
  ogSiteName: string;
  ogLocale: string;
  ogDefaultImage?: string;
  twitterCard: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterSite?: string;
  twitterCreator?: string;
  organizationName: string;
  organizationLogo?: string;
  organizationUrl: string;
  robotsTxt?: string;
  sitemapEnabled: boolean;
  sitemapUrl?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  googleVerificationCode?: string;
  bingVerificationCode?: string;
}

export interface Settings {
  id?: string;
  company: CompanySettings;
  site: SiteSettings;
  seo?: SEOSettings;
  smtp: SMTPSettings;
  emailNotifications?: EmailNotificationSettings;
  social: SocialSettings;
  theme: ThemeSettings;
  features: FeaturesSettings;
  pages: PagesSettings;
  geography: GeographySettings;
  payment: PaymentSettings;
  giftWrap: GiftWrapSettings;
  goldPricing: GoldPricingSettings;
  demoMode?: boolean; // Demo mode flag - when enabled, phone verification uses mock OTP
}

export const defaultGoldPricingSettings: GoldPricingSettings = {
  enabled: false,
  provider: 'manual',
  apiUrl: 'https://goldpricez.com/api/rates/currency/sar/measure/gram',
  refreshIntervalSeconds: 60,
  manualPricePerGram: 0,
  defaultMarginType: 'fixed',
  defaultMarginValue: 0,
  taxRatePercentage: 0,
  karatTaxRates: {
    '24K': 0,
    '22K': 0,
    '21K': 0,
    '18K': 0,
  },
  cache: {
    pricePerGram: 0,
    currency: 'SAR',
    fetchedAt: '',
    sourceTimestamp: '',
    source: 'manual',
  },
};

export const normalizeGoldPricingSettings = (
  goldPricing?: Partial<GoldPricingSettings> | null
): GoldPricingSettings => {
  const legacyTaxRate = Number(
    goldPricing?.taxRatePercentage ?? defaultGoldPricingSettings.taxRatePercentage ?? 0
  );

  return {
    ...defaultGoldPricingSettings,
    ...goldPricing,
    karatTaxRates: {
      ...defaultGoldPricingSettings.karatTaxRates,
      '24K': Number(goldPricing?.karatTaxRates?.['24K'] ?? legacyTaxRate),
      '22K': Number(goldPricing?.karatTaxRates?.['22K'] ?? legacyTaxRate),
      '21K': Number(goldPricing?.karatTaxRates?.['21K'] ?? legacyTaxRate),
      '18K': Number(goldPricing?.karatTaxRates?.['18K'] ?? legacyTaxRate),
    },
    cache: {
      ...defaultGoldPricingSettings.cache,
      ...(goldPricing?.cache || {}),
    },
  };
};

export const defaultSettings: Settings = {
  company: {
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    countryCode: '',
    zipCode: '',
  },
  site: {
    dateFormat: 'DD-MM-YYYY',
    timeFormat: '12 Hour',
    timezone: '',
    defaultCountry: 'PK',
    language: 'English',
    androidAppLink: '',
    iosAppLink: '',
    copyrightText: `© ${new Date().getFullYear()} Pardah. All rights reserved.`,
    currency: '',
    currencyPosition: 'left',
    digitsAfterDecimal: 2,
    phoneDigitLength: 11,
    paymentGateway: 'none',
    enableLanguageSwitcher: false,
    enableUserAccountCreation: true,
    enablePhoneVerification: true,
    enablePhoneLogin: true,
    enableGoogleLogin: false,
    enableEmailLogin: false,
    googleMapsApiKey: '',
  },
  smtp: {
    host: '',
    port: '',
    username: '',
    password: '',
    fromName: 'Pardah Support',
    fromEmail: 'no-reply@pardah.com',
    encryption: 'tls',
  },
  social: {
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: '',
  },
  theme: {
    logoUrl: '',
    faviconUrl: '',
    loginImageUrl: '',
    colors: {
      headerBackground: '#ffffff',
      headerText: '#000000',
      footerBackground: '#1f2937',
      footerText: '#ffffff',
      primaryButton: '#000000',
      primaryButtonText: '#ffffff',
      secondaryButton: '#f3f4f6',
      secondaryButtonText: '#000000',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
    topBar: {
      enabled: false,
      text: 'FREE SHIPPING ON ORDERS OVER 5000',
      backgroundColor: '#000000',
      textColor: '#ffffff',
    },
    paymentMethods: [],
  },
  features: {
    category: true,
    brands: true,
    collections: true,
    size: true,
    colors: true,
    banners: true,
    coupons: true,
    emailMarketing: true,
    notifications: true,
    blog: true,
    wishlist: true,
    productReviews: true,
    productBundles: true,
    preOrders: true,
    productTemplates: true,
    recentlyViewed: true,
    productRecommendations: true,
    importExport: true,
    abandonedCarts: true,
    customerSegmentation: true,
    liveChat: true,
  },
  pages: {
    aboutUs: true,
    privacyPolicy: true,
    termsOfService: true,
    shippingReturns: true,
    sizeGuide: true,
    storeLocator: true,
    careers: true,
    faqs: true,
    contactUs: true,
  },
  geography: {
    countries: true,
    states: true,
    cities: true,
  },
  payment: {
    enableCOD: true,
    enableLocalPayment: false,
    enableOnlinePayment: false,
    enableAdvancePayment: false,
    advancePaymentType: 'percentage',
    advancePaymentValue: 50, // 50% by default
    enableWallet: false,
    enableLoyaltyPoint: false,
    loyaltyPointValue: 1, 
  },
  giftWrap: {
    enabled: false,
    price: 150,
    description: 'Add a special touch',
  },
  goldPricing: defaultGoldPricingSettings,
  emailNotifications: {
    customerOrderPlaced: true,
    customerOrderPlacedSubject: 'Order Confirmation - Order #{orderId}',
    customerOrderPlacedTemplate: '',
    customerOrderStatusUpdate: true,
    customerOrderStatusUpdateSubject: 'Order Status Update - Order #{orderId}',
    customerOrderStatusUpdateTemplate: '',
    customerOrderDelivered: true,
    customerOrderDeliveredSubject: 'Your Order Has Been Delivered - Order #{orderId}',
    customerOrderDeliveredTemplate: '',
    adminNewOrder: true,
    adminNewOrderEmails: [],
    adminNewOrderSubject: 'New Order Received - Order #{orderId}',
    adminNewOrderTemplate: '',
  },
  seo: {
    siteTitle: 'Pardah - Elegant Abayas & Fashion',
    siteDescription: 'Discover the latest collection of elegant abayas, modest fashion, and Islamic clothing for women. High-quality designs for the modern woman.',
    siteKeywords: ['abaya', 'modest fashion', 'islamic clothing', 'women\'s fashion', 'pardah', 'pakistan fashion'],
    ogSiteName: 'Pardah',
    ogLocale: 'en_US',
    twitterCard: 'summary_large_image',
    organizationName: 'Pardah',
    organizationUrl: '',
    sitemapEnabled: true,
  },
  demoMode: false, // Default: demo mode is disabled
};
