'use client';

import { useRouter } from 'next/navigation';
import BlogForm from '../../../../components/admin/BlogForm';

const NewPostPage = () => {
  const router = useRouter();

  return (
    <BlogForm 
      onSuccess={() => router.push('/admin/posts')}
      onCancel={() => router.back()}
    />
  );
};

export default NewPostPage;
