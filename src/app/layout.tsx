import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { generateSEOMetadata } from '@/lib/utils/seo';
import { getBaseUrl } from '@/lib/utils/url';
import { getAllBanners } from '@/lib/firestore/banners_db';
import { getCachedPageSEO, getCachedSEOSettings, getCachedSettings } from '@/lib/server/site-config';
import { pickFirstImage } from '@/lib/utils/metadata-images';

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
    const metadataBase = new URL(getBaseUrl());
    const [settings, seoSettings, homepageSEO, banners] = await Promise.all([
      getCachedSettings(),
      getCachedSEOSettings(),
      getCachedPageSEO('/'),
      getAllBanners().catch(() => []),
    ]);

    const globalSEO = seoSettings || settings?.seo;
    const companyName = settings?.company?.name || 'Pardah';

    const heroImage = pickFirstImage(
      homepageSEO?.metaImage,
      ...banners
        .filter((banner) => banner?.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((banner) => banner.imageUrl)
    );

    const metadata = generateSEOMetadata({
      globalSEO,
      pageSEO: homepageSEO,
      fallbackTitle: homepageSEO?.title || `${companyName} | متجر الذهب والمجوهرات`,
      fallbackDescription: homepageSEO?.description || 'اكتشف الذهب والمجوهرات الفاخرة بتصاميم راقية وأسعار واضحة وتجربة شراء موثوقة.',
      fallbackImage: heroImage,
      url: '/',
      fallbackTitlePriority: 'high',
      fallbackDescriptionPriority: 'high',
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
        metadataBase,
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
      metadataBase,
      ...pwaMetadata,
    };
  } catch {
    try {
      const metadataBase = new URL(getBaseUrl());
      const settings = await getCachedSettings();
      const companyName = settings?.company?.name || 'Pardah';
      const globalSEO = settings?.seo;
      return {
        metadataBase,
        title: globalSEO?.siteTitle || companyName || '',
        description: globalSEO?.siteDescription || '',
        keywords: globalSEO?.siteKeywords,
      };
    } catch {
      const metadataBase = new URL(getBaseUrl());
      return {
        metadataBase,
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
  const criticalStyles = `
    html{background:#fff}body{margin:0;background:#fff;color:#0f172a}
    .page-container{max-width:80rem;margin-inline:auto;padding-inline:1rem}
    @media (min-width:768px){.page-container{padding-inline:2rem}}
    .home-critical-hero{content-visibility:auto;contain-intrinsic-size:900px}
    .home-critical-hero-media{position:relative;isolation:isolate}
    .home-critical-hero-panel{background:linear-gradient(90deg,rgba(14,10,4,.42) 0%,rgba(14,10,4,.18) 44%,rgba(14,10,4,.04) 72%,rgba(14,10,4,0) 100%)}
  `;

  return (
    <html lang="ar" suppressHydrationWarning dir="rtl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalStyles }} />
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
