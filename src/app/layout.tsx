import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { generateSEOMetadata } from '@/lib/utils/seo';
import { getCachedPageSEO, getCachedSEOSettings, getCachedSettings } from '@/lib/server/site-config';
import { getAllBanners } from '@/lib/firestore/banners_db';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, seoSettings, homepageSEO, banners] = await Promise.all([
      getCachedSettings(),
      getCachedSEOSettings(),
      getCachedPageSEO('/'),
      getAllBanners().catch(() => []),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || 'Pardah';
    const activeBannerImage = banners.find((banner) => banner.isActive && banner.imageUrl)?.imageUrl;

    const metadata = generateSEOMetadata({
      globalSEO,
      pageSEO: homepageSEO,
      fallbackTitle: globalSEO?.siteTitle || companyName || '',
      fallbackDescription: globalSEO?.siteDescription || '',
      fallbackImage: activeBannerImage || globalSEO?.defaultMetaImage || globalSEO?.ogDefaultImage,
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
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
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
      metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
      ...pwaMetadata,
    };
  } catch {
    try {
      const settings = await getCachedSettings();
      const companyName = settings?.company?.name || 'Pardah';
      const globalSEO = settings?.seo;
      return {
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
        title: globalSEO?.siteTitle || companyName || '',
        description: globalSEO?.siteDescription || '',
        keywords: globalSEO?.siteKeywords,
      };
    } catch {
      return {
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
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
