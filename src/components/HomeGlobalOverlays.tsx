'use client';

import dynamic from 'next/dynamic';

const HomeMobileBottomNav = dynamic(() => import('./HomeMobileBottomNav'), { ssr: false });
const BackToTop = dynamic(() => import('./BackToTop'), { ssr: false });

export default function HomeGlobalOverlays() {
  return (
    <>
      <HomeMobileBottomNav />
      <BackToTop />
    </>
  );
}
