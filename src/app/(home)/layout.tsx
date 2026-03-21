import HomeProviders from './providers';
import HomeLayoutWrapper from '@/components/HomeLayoutWrapper';
import { getCachedDefaultCurrency, getCachedSettings } from '@/lib/server/site-config';

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [initialSettings, initialCurrency] = await Promise.all([
    getCachedSettings().catch(() => null),
    getCachedDefaultCurrency().catch(() => null),
  ]);

  return (
    <HomeProviders
      initialSettings={initialSettings}
      initialCurrency={
        initialCurrency
          ? {
              code: initialCurrency.code,
              name: initialCurrency.name,
              symbol: initialCurrency.symbol,
              symbolPosition: initialCurrency.symbolPosition,
              decimalPlaces: initialCurrency.decimalPlaces,
            }
          : null
      }
    >
      <HomeLayoutWrapper>{children}</HomeLayoutWrapper>
    </HomeProviders>
  );
}
