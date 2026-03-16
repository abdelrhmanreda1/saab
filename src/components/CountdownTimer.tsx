'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface CountdownTimerProps {
  endTime: Date;
  onComplete?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ endTime, onComplete }) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = endTime.getTime();
      const difference = end - now;

      if (difference <= 0) {
        setIsExpired(true);
        if (onComplete) onComplete();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      };
    };

    const initialTime = calculateTimeLeft();
    setTimeout(() => {
      setTimeLeft(initialTime);
    }, 0);
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onComplete]);

  if (isExpired) {
    return (
      <div className="text-center">
        <span className="text-lg font-bold text-red-600">
          {t('home.offer_expired') || 'Offer Expired'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4">
      {timeLeft.days > 0 && (
        <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 md:px-4 md:py-3 min-w-[60px] md:min-w-[80px]">
          <span className="text-2xl md:text-3xl font-bold text-white">{String(timeLeft.days).padStart(2, '0')}</span>
          <span className="text-[10px] md:text-xs text-white/90 uppercase tracking-wide">
            {t('home.days') || 'Days'}
          </span>
        </div>
      )}
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 md:px-4 md:py-3 min-w-[60px] md:min-w-[80px]">
        <span className="text-2xl md:text-3xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="text-[10px] md:text-xs text-white/90 uppercase tracking-wide">
          {t('home.hours') || 'Hours'}
        </span>
      </div>
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 md:px-4 md:py-3 min-w-[60px] md:min-w-[80px]">
        <span className="text-2xl md:text-3xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="text-[10px] md:text-xs text-white/90 uppercase tracking-wide">
          {t('home.minutes') || 'Minutes'}
        </span>
      </div>
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 md:px-4 md:py-3 min-w-[60px] md:min-w-[80px]">
        <span className="text-2xl md:text-3xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="text-[10px] md:text-xs text-white/90 uppercase tracking-wide">
          {t('home.seconds') || 'Seconds'}
        </span>
      </div>
    </div>
  );
};

export default CountdownTimer;

