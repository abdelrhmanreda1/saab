import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <h1 className="text-9xl md:text-[12rem] font-heading font-bold text-gray-200 mb-4">
            404
          </h1>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-4">
            Page Not Found
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/"
            className="px-6 py-3 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors"
          >
            Go to Homepage
          </Link>
          <Link
            href="/shop"
            className="px-6 py-3 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Continue Shopping
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

