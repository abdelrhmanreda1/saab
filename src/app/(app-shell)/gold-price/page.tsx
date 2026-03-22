import type { Metadata } from 'next';
import GoldPriceClient from './GoldPriceClient';

export const metadata: Metadata = {
  title: 'أسعار الذهب',
  description: 'تابع أسعار الذهب حسب العيارات وشاهد أحدث أسعار الجرام المستخدمة داخل المتجر.',
};

const GoldPricePage = () => {
  return <GoldPriceClient />;
};

export default GoldPricePage;
