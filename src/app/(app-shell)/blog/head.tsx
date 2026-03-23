import { getBlogIndexSocialMetadata } from '@/lib/utils/social-metadata';

export default async function Head() {
  const metadata = await getBlogIndexSocialMetadata();

  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      {metadata.imageUrl ? <meta property="og:image" content={metadata.imageUrl} /> : null}
      <meta property="og:url" content={metadata.pageUrl} />
      <meta property="og:site_name" content={metadata.siteName} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metadata.title} />
      <meta name="twitter:description" content={metadata.description} />
      {metadata.imageUrl ? <meta name="twitter:image" content={metadata.imageUrl} /> : null}
    </>
  );
}
