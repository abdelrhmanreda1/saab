import { getRouteSocialMetadata } from '@/lib/utils/social-metadata';

export default async function Head() {
  const metadata = await getRouteSocialMetadata({
    pagePath: '/cart',
    fallbackTitle: 'Shopping Cart',
    fallbackDescription: 'Review your cart and continue to checkout.',
  });

  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      {metadata.imageUrl ? <meta property="og:image" content={metadata.imageUrl} /> : null}
    </>
  );
}
