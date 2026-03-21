'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-10 h-10 text-red-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-4">
            Something went wrong!
          </h2>
          <p className="text-gray-500 text-lg mb-2">
            We&apos;re sorry, but something unexpected happened.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 font-mono mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={reset}
            className="px-6 py-3 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-3 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-md mx-auto">
          <Link href="/shop" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Shop
          </Link>
          <Link href="/categories" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Categories
          </Link>
          <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Blog
          </Link>
          <Link href="/contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}

