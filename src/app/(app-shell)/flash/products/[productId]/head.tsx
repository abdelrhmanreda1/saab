import { getProductSocialMetadata } from '@/lib/utils/product-social';

type FlashProductHeadProps = {
  params: Promise<{ productId: string }>;
};

export default async function Head({ params }: FlashProductHeadProps) {
  const { productId } = await params;
  const metadata = await getProductSocialMetadata({
    productSlug: productId,
    pagePath: `/flash/products/${productId}`,
    fallbackDescriptionPrefix: 'View flash sale details for',
  });

  if (!metadata) {
    return null;
  }

  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      {metadata.imageUrl && <meta property="og:image" content={metadata.imageUrl} />}
      <meta property="og:url" content={metadata.pageUrl} />
      <meta property="og:site_name" content={metadata.siteName} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metadata.title} />
      <meta name="twitter:description" content={metadata.description} />
      {metadata.imageUrl && <meta name="twitter:image" content={metadata.imageUrl} />}
    </>
  );
}
