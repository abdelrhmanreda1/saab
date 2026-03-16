'use client';

import { useRouter, useParams } from 'next/navigation';
import BlogForm from '../../../../../components/admin/BlogForm';

const EditPostPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  return (
    <BlogForm 
      postId={id}
      onSuccess={() => router.push('/admin/posts')}
      onCancel={() => router.back()}
    />
  );
};

export default EditPostPage;
