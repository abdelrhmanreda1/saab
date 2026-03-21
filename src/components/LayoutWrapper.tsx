'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from './Header';
import PageTransition from './PageTransition';

const Footer = dynamic(() => import('./Footer'), { ssr: false });
const MobileBottomNav = dynamic(() => import('./MobileBottomNav'), { ssr: false });
const LazyLiveChat = dynamic(() => import('./LazyLiveChat'), { ssr: false });
const MobileStickyCart = dynamic(() => import('./MobileStickyCart'), { ssr: false });
const BackToTop = dynamic(() => import('./BackToTop'), { ssr: false });

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  return (
    <>
      {!isAdmin && <Header />}
      <main className={`min-h-screen ${!isAdmin ? 'pb-16 md:pb-0' : ''}`}>
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <MobileBottomNav />}
      {!isAdmin && <MobileStickyCart />}
      {!isAdmin && <BackToTop />}
      {!isAdmin && <LazyLiveChat />}
    </>
  );
}
