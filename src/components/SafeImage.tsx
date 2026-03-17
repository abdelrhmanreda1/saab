'use client';

import { getDirectImageUrl, getProxyImageUrl } from '@/lib/utils/image';

type SafeImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  fetchPriority?: 'high' | 'low' | 'auto';
};

export default function SafeImage({
  src,
  alt = '',
  onError,
  fetchPriority,
  loading,
  ...props
}: SafeImageProps) {
  const primarySrc = getDirectImageUrl(src);
  const fallbackSrc = getProxyImageUrl(src);
  const resolvedSrc = primarySrc || fallbackSrc;

  if (!resolvedSrc) {
    return null;
  }

  const resolvedFetchPriority =
    fetchPriority || (loading === 'eager' ? 'high' : 'auto');

  return (
    // Edge was inconsistent with some remote assets; use a plain img with direct->proxy fallback.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchPriority={resolvedFetchPriority}
      referrerPolicy="no-referrer"
      onError={(event) => {
        if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
          event.currentTarget.src = fallbackSrc;
          return;
        }

        onError?.(event);
      }}
    />
  );
}
