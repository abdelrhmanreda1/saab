'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const Header = dynamic(() => import('./Header'), { ssr: false });
const Footer = dynamic(() => import('./Footer'), { ssr: false });
const MobileBottomNav = dynamic(() => import('./MobileBottomNav'), { ssr: false });
const MobileStickyCart = dynamic(() => import('./MobileStickyCart'), { ssr: false });
const BackToTop = dynamic(() => import('./BackToTop'), { ssr: false });

export default function LayoutChrome() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return null;
  }

  return (
    <>
      <Header />
      <Footer />
      <MobileBottomNav />
      <MobileStickyCart />
      <BackToTop />
    </>
  );
}
