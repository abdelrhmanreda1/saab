'use client';

import { useEffect, useRef, useState } from 'react';

export default function HomeSectionViewportGate({
  children,
  minHeightClass = 'min-h-[240px]',
  rootMargin = '240px',
}: {
  children: React.ReactNode;
  minHeightClass?: string;
  rootMargin?: string;
}) {
  const [isReady, setIsReady] = useState(false);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isReady) return;
    const node = placeholderRef.current;
    if (!node) return;

    const onReady = () => setIsReady(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onReady();
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isReady, rootMargin]);

  useEffect(() => {
    if (isReady) return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(() => setIsReady(true), { timeout: 2500 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timeoutId = window.setTimeout(() => setIsReady(true), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [isReady]);

  if (isReady) {
    return <>{children}</>;
  }

  return <div ref={placeholderRef} className={minHeightClass} aria-hidden="true" />;
}
