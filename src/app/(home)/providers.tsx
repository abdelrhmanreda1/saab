import { HomeProviders as LightweightHomeProviders } from './home-context';
import type { Settings } from '@/lib/firestore/settings';

export default function HomeProviders({
  children,
  initialSettings,
  initialCurrency,
}: {
  children: React.ReactNode;
  initialSettings: Settings | null;
  initialCurrency?: {
    code?: string;
    name?: string;
    symbol?: string;
    symbolPosition?: 'left' | 'right';
    decimalPlaces?: number;
  } | null;
}) {
  return (
    <LightweightHomeProviders initialSettings={initialSettings} initialCurrency={initialCurrency}>
      {children}
    </LightweightHomeProviders>
  );
}
