import React from 'react';

interface SkeletonLoaderProps {
  type?: 'product' | 'blog' | 'testimonial' | 'category' | 'text';
  count?: number;
}

export default function SkeletonLoader({ type = 'product', count = 1 }: SkeletonLoaderProps) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (type === 'product') {
    return (
      <>
        {skeletons.map((index) => (
          <div key={index} className="animate-pulse">
            <div className="flex flex-col rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <div className="relative aspect-[3/4] w-full bg-gray-200" />
              <div className="p-3 md:p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === 'blog') {
    return (
      <>
        {skeletons.map((index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-200">
              <div className="relative h-48 w-full bg-gray-200" />
              <div className="p-6 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === 'testimonial') {
    return (
      <div className="animate-pulse">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <div className="flex gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-5 h-5 md:w-6 md:h-6 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="space-y-3 mb-6">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-4/6" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-2 h-2 bg-gray-200 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'category') {
    return (
      <>
        {skeletons.map((index) => (
          <div key={index} className="animate-pulse">
            <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden bg-gray-200" />
          </div>
        ))}
      </>
    );
  }

  if (type === 'text') {
    return (
      <>
        {skeletons.map((index) => (
          <div key={index} className="animate-pulse space-y-2">
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
          </div>
        ))}
      </>
    );
  }

  return null;
}

