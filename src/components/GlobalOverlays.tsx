'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const MobileBottomNav = dynamic(() => import('./MobileBottomNav'), { ssr: false });
const MobileStickyCart = dynamic(() => import('./MobileStickyCart'), { ssr: false });
const BackToTop = dynamic(() => import('./BackToTop'), { ssr: false });

export default function GlobalOverlays() {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <MobileBottomNav />
      <MobileStickyCart />
      <BackToTop />
    </>
  );
}
