'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import LiveChat from './LiveChat';
import MobileStickyCart from './MobileStickyCart';
import BackToTop from './BackToTop';
import PageTransition from './PageTransition';

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
      {!isAdmin && <LiveChat />}
    </>
  );
}
