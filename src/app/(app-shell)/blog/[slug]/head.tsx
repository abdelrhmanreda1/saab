import { getBlogPostSocialMetadata } from '@/lib/utils/social-metadata';

type BlogHeadProps = {
  params: Promise<{ slug: string }>;
};

export default async function Head({ params }: BlogHeadProps) {
  const { slug } = await params;
  const metadata = await getBlogPostSocialMetadata(slug);

  if (!metadata) {
    return null;
  }

  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta property="og:type" content="article" />
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
