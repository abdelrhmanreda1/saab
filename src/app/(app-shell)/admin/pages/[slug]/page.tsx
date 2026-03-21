import { PAGE_SLUGS } from '@/lib/firestore/pages';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pageTitle = PAGE_SLUGS[slug as keyof typeof PAGE_SLUGS] || 'Page Editor';
  return {
    title: `${pageTitle} - Admin`,
  };
}

// Since we are using a dynamic route, we need to allow all slugs defined in PAGE_SLUGS
export async function generateStaticParams() {
  return Object.keys(PAGE_SLUGS).map((slug) => ({
    slug,
  }));
}

export { default } from './PageEditor';
