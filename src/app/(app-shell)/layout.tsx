import Providers from '../providers';
import LayoutWrapper from '@/components/LayoutWrapper';
import { getCachedSettings } from '@/lib/server/site-config';

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSettings = await getCachedSettings().catch(() => null);

  return (
    <Providers initialSettings={initialSettings}>
      <LayoutWrapper>{children}</LayoutWrapper>
    </Providers>
  );
}
