'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/context/LanguageContext';

const LiveChat = dynamic(() => import('./LiveChat'), { ssr: false });

export default function LazyLiveChat() {
  const { t } = useLanguage();
  const [shouldLoad, setShouldLoad] = useState(false);
  const [openOnLoad, setOpenOnLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const load = () => setShouldLoad(true);

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (
        window as Window & {
          requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        }
      ).requestIdleCallback(load, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(load, 2500);
    }

    return () => {
      if (
        idleId !== null &&
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window
      ) {
        (
          window as Window & {
            cancelIdleCallback: (handle: number) => void;
          }
        ).cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [shouldLoad]);

  useEffect(() => {
    const handleOpen = () => {
      setOpenOnLoad(true);
      setShouldLoad(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('open-live-chat', handleOpen);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('open-live-chat', handleOpen);
      }
    };
  }, []);

  if (shouldLoad) {
    return <LiveChat initiallyOpen={openOnLoad} />;
  }

  return (
    <button
      onClick={() => {
        setOpenOnLoad(true);
        setShouldLoad(true);
      }}
      className="hidden md:flex fixed bottom-6 left-6 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-all items-center justify-center z-50 group"
      aria-label={t('chat.open_live_chat') || 'Open Live Chat'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    </button>
  );
}
