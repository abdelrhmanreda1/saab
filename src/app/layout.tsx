import type { Metadata, Viewport } from "next";
import { Inter, Poppins, Geist_Mono, Roboto, Open_Sans, Montserrat, Tajawal } from "next/font/google";
import "./globals.css";
import { getSettings } from '@/lib/firestore/settings_db';
import { getSEOSettings, getPageSEO } from '@/lib/firestore/seo_db';
import { generateSEOMetadata } from '@/lib/utils/seo';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { SettingsProvider } from '../context/SettingsContext';
import { LanguageProvider } from '../context/LanguageContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { ThemeProvider } from '../components/ThemeProvider';
import LayoutWrapper from '../components/LayoutWrapper';
import { ToastProvider } from '../components/Toast';
import PWARegistration from "../components/PWARegistration";

// Inter - Most popular ecommerce font (used by Shopify, Stripe, etc.)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Poppins - Friendly, modern font for headings (used by Amazon, many fashion brands)
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Additional fonts for theme selection
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Arabic font for RTL languages (clean + readable)
const tajawal = Tajawal({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, homepageSEO] = await Promise.all([
      getSettings(),
      getSEOSettings(),
      getPageSEO('/'), // Check for homepage-specific SEO
    ]);

    // Use SEO settings from seo_settings collection if available, otherwise use settings.seo
    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || 'Pardah';

    // Priority: Homepage Page SEO > Global SEO > Fallback
    const metadata = generateSEOMetadata({
      globalSEO,
      pageSEO: homepageSEO, // Homepage-specific SEO
      fallbackTitle: globalSEO?.siteTitle || companyName || '',
      fallbackDescription: globalSEO?.siteDescription || '',
      fallbackImage: globalSEO?.defaultMetaImage || globalSEO?.ogDefaultImage,
      url: '/',
    });

    // Add favicon and PWA icons if available
    const pwaMetadata = {
      manifest: '/manifest.json',
      appleWebApp: {
        capable: true,
        statusBarStyle: 'default' as const,
        title: companyName,
      },
    };

    if (settings?.theme?.faviconUrl) {
      return {
        ...metadata,
        icons: {
          icon: settings.theme.faviconUrl,
          shortcut: settings.theme.faviconUrl,
          apple: settings.theme.faviconUrl,
        },
        ...pwaMetadata,
      };
    }

    return {
      ...metadata,
      ...pwaMetadata,
    };
  } catch {
    // Error generating metadata
    // Fallback metadata
    try {
      const settings = await getSettings();
      const companyName = settings?.company?.name || 'Pardah';
      const globalSEO = settings?.seo;
      return {
        title: globalSEO?.siteTitle || companyName || '',
        description: globalSEO?.siteDescription || '',
        keywords: globalSEO?.siteKeywords,
      };
    } catch {
      return {
        title: 'Pardah',
        description: '',
      };
    }
  }
}

export function generateViewport(): Viewport {
  return {
    themeColor: '#000000',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" suppressHydrationWarning dir="rtl">
      <head>
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firebasestorage.app" />
        <link rel="preconnect" href="https://firebasestorage.app" crossOrigin="anonymous" />
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} ${geistMono.variable} ${roboto.variable} ${openSans.variable} ${montserrat.variable} ${tajawal.variable} antialiased`}
      >
        <AuthProvider>
          <LanguageProvider defaultLanguageCode="ar">
            <CurrencyProvider>
              <CartProvider>
                <SettingsProvider>
                  <ThemeProvider>
                    <ToastProvider>
                      <PWARegistration />
                      <LayoutWrapper>
                        {children}
                      </LayoutWrapper>
                    </ToastProvider>
                  </ThemeProvider>
                </SettingsProvider>
              </CartProvider>
            </CurrencyProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
