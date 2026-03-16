'use client';

import React, { useState, useEffect } from 'react';
import { getReviewsByProductId, markReviewHelpful, unmarkReviewHelpful } from '@/lib/firestore/reviews_enhanced_db';
import { Review } from '@/lib/firestore/reviews_enhanced';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import Dialog from './ui/Dialog';
import Image from 'next/image';

interface EnhancedReviewListProps {
  productId: string;
  reviewsRefreshKey: number;
}

const EnhancedReviewList: React.FC<EnhancedReviewListProps> = ({ productId, reviewsRefreshKey }) => {
  const { user, demoUser } = useAuth();
  const { settings } = useSettings();
  const { t } = useLanguage();
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    rating?: number;
    verifiedPurchase?: boolean;
    sortBy?: 'newest' | 'oldest' | 'helpful' | 'rating';
  }>({ sortBy: 'newest' });

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const fetchedReviews = await getReviewsByProductId(productId, filters);
        setReviews(fetchedReviews);
      } catch {
        // Failed to fetch reviews
        setError('Failed to load reviews.');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchReviews();
    }
  }, [productId, reviewsRefreshKey, filters]);

  const handleHelpful = async (reviewId: string) => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId) {
      setShowInfoDialog(true);
      return;
    }

    const review = reviews.find(r => r.id === reviewId);
    if (review?.helpfulUsers?.includes(userId)) {
      await unmarkReviewHelpful(reviewId, userId);
    } else {
      await markReviewHelpful(reviewId, userId);
    }
    
    // Refresh reviews
    const fetchedReviews = await getReviewsByProductId(productId, filters);
    setReviews(fetchedReviews);
  };

  if (loading) {
    return <div className="text-center py-4">Loading reviews...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">{error}</div>;
  }

  if (reviews.length === 0) {
    return <div className="text-center py-4 text-gray-500">No reviews yet.</div>;
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Filter by Rating</label>
            <select
              value={filters.rating || ''}
              onChange={(e) => setFilters({ ...filters, rating: e.target.value ? parseInt(e.target.value) : undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Sort By</label>
            <select
              value={filters.sortBy || 'newest'}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as 'newest' | 'oldest' | 'helpful' | 'rating' })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="helpful">Most Helpful</option>
              <option value="rating">Highest Rating</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verifiedOnly"
              checked={filters.verifiedPurchase === true}
              onChange={(e) => setFilters({ ...filters, verifiedPurchase: e.target.checked ? true : undefined })}
              className="w-4 h-4"
            />
            <label htmlFor="verifiedOnly" className="text-sm text-gray-600">Verified Purchase Only</label>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">{review.userName}</p>
                {review.verifiedPurchase && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    Verified Purchase
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-gray-700 mb-2">{review.comment}</p>
            
            {/* Review Photos */}
            {review.photos && review.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {review.photos.map((photo, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded overflow-hidden">
                    <Image src={photo.url} alt={`Review photo ${idx + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <p className="text-sm text-gray-500">
                {review.createdAt.toDate().toLocaleDateString()}
              </p>
              <button
                onClick={() => review.id && handleHelpful(review.id)}
                className={`flex items-center gap-1 text-sm ${
                  review.helpfulUsers?.includes(user?.uid || '') 
                    ? 'text-blue-600 font-medium' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.645 1.05-1.102 1.444a.75.75 0 0 1-.416.25c-.25.05-.5.1-.75.15a9.04 9.04 0 0 1-2.862 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 0 0-.322 1.672v2.75a.75.75 0 0 1-.75.75h-4.5A2.25 2.25 0 0 1 3 17.25v-1.5A2.25 2.25 0 0 1 5.25 13.5h1.383Z" />
                </svg>
                Helpful ({review.helpfulCount || 0})
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={t('common.error') || 'Error'}
        message={t('products.qa.login_to_helpful') || 'Please log in to mark reviews as helpful.'}
        type="error"
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default EnhancedReviewList;

