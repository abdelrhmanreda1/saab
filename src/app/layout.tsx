import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { generateSEOMetadata } from '@/lib/utils/seo';
import { getCachedPageSEO, getCachedSEOSettings, getCachedSettings } from '@/lib/server/site-config';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, homepageSEO] = await Promise.all([
      getCachedSettings(),
      getCachedSEOSettings(),
      getCachedPageSEO('/'),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || 'Pardah';

    const metadata = generateSEOMetadata({
      globalSEO,
      pageSEO: homepageSEO,
      fallbackTitle: globalSEO?.siteTitle || companyName || '',
      fallbackDescription: globalSEO?.siteDescription || '',
      fallbackImage: globalSEO?.defaultMetaImage || globalSEO?.ogDefaultImage,
      url: '/',
    });

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
    try {
      const settings = await getCachedSettings();
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

export default async function RootLayout({
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
      <body className={`${inter.variable} ${cairo.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
