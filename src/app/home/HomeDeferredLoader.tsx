'use client';

import dynamic from 'next/dynamic';

const HomeDeferredSections = dynamic(() => import('./HomeDeferredSections'), {
  ssr: false,
});

export default function HomeDeferredLoader() {
  return <HomeDeferredSections />;
}
