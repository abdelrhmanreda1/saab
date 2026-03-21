'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

type Testimonial = {
  id: string;
  userName: string;
  comment: string;
  rating: number;
  verifiedPurchase: boolean;
};

export default function HomeTestimonialsCarousel({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  const current = testimonials[currentIndex];
  if (!current) return null;

  return (
    <div className="max-w-4xl mx-auto relative">
      <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <div className="flex items-center gap-1 mb-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <svg
              key={index}
              className={`w-5 h-5 md:w-6 md:h-6 ${index < current.rating ? 'text-yellow-400' : 'text-gray-300'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <p className="text-lg md:text-xl text-gray-700 mb-6 italic">
          &quot;{current.comment}&quot;
        </p>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">{current.userName}</p>
            {current.verifiedPurchase && (
              <p className="mt-1 text-sm text-green-600">
                {t('home.verified_purchase') || 'Verified Purchase'}
              </p>
            )}
          </div>
          {testimonials.length > 1 && (
            <div className="flex gap-3 justify-center md:justify-end">
              {testimonials.map((testimonial, index) => (
                <button
                  key={testimonial.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-4 rounded-full transition-all ${
                    index === currentIndex ? 'bg-gray-900 w-10' : 'bg-gray-300 hover:bg-gray-400 w-4'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
