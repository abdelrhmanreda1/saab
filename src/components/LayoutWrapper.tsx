'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import PageTransition from './PageTransition';

const LiveChat = dynamic(() => import('./LiveChat'), { ssr: false });
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
      {!isAdmin && <LiveChat />}
    </>
  );
}
