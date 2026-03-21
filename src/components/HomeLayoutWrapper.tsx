import HomeHeader from './HomeHeader';
import HomeFooter from './HomeFooter';

export default function HomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomeHeader />
      <main className="min-h-screen">
        {children}
      </main>
      <HomeFooter />
    </>
  );
}
