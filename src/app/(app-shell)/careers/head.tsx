import { getCmsPageSocialMetadata } from '@/lib/utils/social-metadata';

export default async function Head() {
  const metadata = await getCmsPageSocialMetadata({
    slug: 'careers',
    pagePath: '/careers',
    fallbackTitle: 'Careers',
    fallbackDescription: 'Explore career opportunities and join our team.',
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
