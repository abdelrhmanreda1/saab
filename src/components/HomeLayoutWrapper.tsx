import HomeHeader from './HomeHeader';
import Footer from './Footer';

export default function HomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomeHeader />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  );
}
