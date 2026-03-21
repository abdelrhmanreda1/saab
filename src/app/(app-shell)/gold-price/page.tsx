import type { Metadata } from 'next';
import GoldPriceClient from './GoldPriceClient';

export const metadata: Metadata = {
  title: 'Gold Prices',
  description: 'Track current gold prices by karat and view the latest gram rates used in the store.',
};

const GoldPricePage = () => {
  return <GoldPriceClient />;
};

export default GoldPricePage;
