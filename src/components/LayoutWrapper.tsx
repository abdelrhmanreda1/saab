import PageTransition from './PageTransition';
import HeaderChrome from './HeaderChrome';
import FooterChrome from './FooterChrome';
import GlobalOverlays from './GlobalOverlays';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeaderChrome />
      <main className="min-h-screen pb-16 md:pb-0">
        <PageTransition>{children}</PageTransition>
      </main>
      <FooterChrome />
      <GlobalOverlays />
    </>
  );
}
