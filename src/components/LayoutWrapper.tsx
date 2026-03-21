import dynamic from 'next/dynamic';
import PageTransition from './PageTransition';

const LayoutChrome = dynamic(() => import('./LayoutChrome'), {
  ssr: false,
  loading: () => <div aria-hidden className="h-16 md:h-[136px]" />,
});

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LayoutChrome />
      <main className="min-h-screen pb-16 md:pb-0">
        <PageTransition>{children}</PageTransition>
      </main>
    </>
  );
}
