import HomeHeader from './HomeHeader';
import HomeFooter from './HomeFooter';
import HomeGlobalOverlays from './HomeGlobalOverlays';

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
