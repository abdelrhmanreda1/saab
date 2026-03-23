import { getCmsPageSocialMetadata } from '@/lib/utils/social-metadata';

export default async function Head() {
  const metadata = await getCmsPageSocialMetadata({
    slug: 'faq',
    pagePath: '/faq',
    fallbackTitle: 'FAQs',
    fallbackDescription: 'Find answers to common questions about orders, shipping, returns, and store policies.',
  });

  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      {metadata.imageUrl ? <meta property="og:image" content={metadata.imageUrl} /> : null}
      <meta property="og:url" content={metadata.pageUrl} />
      <meta property="og:site_name" content={metadata.siteName} />
    </>
  );
}
