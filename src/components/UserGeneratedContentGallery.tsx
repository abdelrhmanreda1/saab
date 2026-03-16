'use client';

import React, { useState, useEffect } from 'react';
import { getProductUserGeneratedContent } from '@/lib/firestore/reviews_enhanced_db';
import { UserGeneratedContent } from '@/lib/firestore/reviews_enhanced';
import Image from 'next/image';

interface UserGeneratedContentGalleryProps {
  productId: string;
}

const UserGeneratedContentGallery: React.FC<UserGeneratedContentGalleryProps> = ({ productId }) => {
  const [content, setContent] = useState<UserGeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<UserGeneratedContent | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const fetchedContent = await getProductUserGeneratedContent(productId, true);
        setContent(fetchedContent);
      } catch {
        // Failed to fetch user-generated content
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [productId]);

  if (loading) {
    return <div className="text-center py-4">Loading gallery...</div>;
  }

  if (content.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Customer Photos</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {content.map((item) => (
          <div
            key={item.id}
            className="relative aspect-square cursor-pointer rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
            onClick={() => setSelectedContent(item)}
          >
            {item.type === 'photo' ? (
              <Image
                src={item.mediaUrl}
                alt={item.caption || 'Customer photo'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
            )}
            {item.isFeatured && (
              <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded">
                Featured
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal for full view */}
      {selectedContent && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedContent(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            {selectedContent.type === 'photo' ? (
              <Image
                src={selectedContent.mediaUrl}
                alt={selectedContent.caption || 'Customer photo'}
                width={800}
                height={800}
                className="object-contain max-h-[90vh]"
              />
            ) : (
              <video src={selectedContent.mediaUrl} controls className="max-h-[90vh]">
                Your browser does not support video.
              </video>
            )}
            {selectedContent.caption && (
              <p className="text-white mt-4 text-center">{selectedContent.caption}</p>
            )}
            <button
              onClick={() => setSelectedContent(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserGeneratedContentGallery;

