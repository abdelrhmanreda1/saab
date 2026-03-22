'use client';

import dynamic from 'next/dynamic';
import HomeHeader from './HomeHeader';

const HomeFooter = dynamic(() => import('./HomeFooter'), {
  ssr: false,
});

const HomeGlobalOverlays = dynamic(() => import('./HomeGlobalOverlays'), {
  ssr: false,
});

export default function HomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomeHeader />
      <main className="min-h-screen pb-16 md:pb-0">
        {children}
      </main>
      <HomeFooter />
      <HomeGlobalOverlays />
    </>
  );
}
