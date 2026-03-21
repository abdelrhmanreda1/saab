import HomeProviders from './providers';
import HomeLayoutWrapper from '@/components/HomeLayoutWrapper';
import { getCachedSettings } from '@/lib/server/site-config';

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSettings = await getCachedSettings().catch(() => null);

  return (
    <HomeProviders initialSettings={initialSettings}>
      <HomeLayoutWrapper>{children}</HomeLayoutWrapper>
    </HomeProviders>
  );
}
