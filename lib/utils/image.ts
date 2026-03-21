const normalizeImageUrl = (url?: string | null): string => {
  if (!url) {
    return '';
  }

  return url.trim();
};

export const getDirectImageUrl = (url?: string | null): string => {
  return normalizeImageUrl(url);
};

export const getProxyImageUrl = (url?: string | null): string => {
  const normalizedUrl = normalizeImageUrl(url);
  if (!normalizedUrl) {
    return '';
  }

  if (
    normalizedUrl.startsWith('/') ||
    normalizedUrl.startsWith('data:') ||
    normalizedUrl.startsWith('blob:')
  ) {
    return normalizedUrl;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return `/api/image-proxy?url=${encodeURIComponent(normalizedUrl)}`;
    }
  } catch {
    return normalizedUrl;
  }

  return normalizedUrl;
};

export const getSafeImageUrl = (url?: string | null): string => getDirectImageUrl(url);
