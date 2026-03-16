'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Review, getReviewsByProductId } from '@/lib/firestore/reviews';

interface ReviewListProps {
  productId: string;
  reviewsRefreshKey: number;
}

const ReviewList: React.FC<ReviewListProps> = ({ productId, reviewsRefreshKey }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [filterRating, setFilterRating] = useState<number | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedReviews = await getReviewsByProductId(productId).catch(err => {
          // Failed to fetch reviews
          throw err;
        });
        setReviews(fetchedReviews);
      } catch (err: unknown) {
        // Failed to fetch reviews
        // Check if it's a permissions error
        const errorObj = err as { message?: string; code?: string };
        if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
          setError("Unable to load reviews due to permissions.");
        } else {
        setError("Failed to load reviews.");
        }
        // Set empty array on error to prevent UI issues
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchReviews();
    }
  }, [productId, reviewsRefreshKey]);

  // Calculate rating statistics
  const ratingStats = useMemo(() => {
    if (reviews.length === 0) return null;
    
    const total = reviews.length;
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
    const distribution = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
      percentage: (reviews.filter(r => r.rating === star).length / total) * 100
    }));

    return { total, average, distribution };
  }, [reviews]);

  // Sort and filter reviews
  const sortedAndFilteredReviews = useMemo(() => {
    let filtered = [...reviews];
    
    // Filter by rating
    if (filterRating !== null) {
      filtered = filtered.filter(r => r.rating === filterRating);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          const bTime = (b.createdAt as { toMillis?: () => number; seconds?: number })?.toMillis ? (b.createdAt as { toMillis: () => number }).toMillis() : ((b.createdAt as { seconds?: number })?.seconds || 0) * 1000;
          const aTime = (a.createdAt as { toMillis?: () => number; seconds?: number })?.toMillis ? (a.createdAt as { toMillis: () => number }).toMillis() : ((a.createdAt as { seconds?: number })?.seconds || 0) * 1000;
          return bTime - aTime;
        case 'oldest':
          const aTimeOld = (a.createdAt as { toMillis?: () => number; seconds?: number })?.toMillis ? (a.createdAt as { toMillis: () => number }).toMillis() : ((a.createdAt as { seconds?: number })?.seconds || 0) * 1000;
          const bTimeOld = (b.createdAt as { toMillis?: () => number; seconds?: number })?.toMillis ? (b.createdAt as { toMillis: () => number }).toMillis() : ((b.createdAt as { seconds?: number })?.seconds || 0) * 1000;
          return aTimeOld - bTimeOld;
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [reviews, sortBy, filterRating]);

  if (loading) {
    return <div className="text-center py-8">Loading reviews...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-300 mx-auto mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
        <p className="text-gray-500 text-lg">No reviews yet.</p>
        <p className="text-gray-400 text-sm mt-2">Be the first to review this product!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Rating Summary */}
      {ratingStats && (
        <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="text-center md:text-left">
              <div className="text-5xl font-bold text-gray-900 mb-1">{ratingStats.average.toFixed(1)}</div>
              <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-5 h-5 ${
                      star <= Math.round(ratingStats.average) ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600">{ratingStats.total} {ratingStats.total === 1 ? 'review' : 'reviews'}</p>
            </div>
            
            <div className="flex-1 w-full md:w-auto">
              <div className="space-y-2">
                {ratingStats.distribution.map(({ star, count, percentage }) => (
                  <button
                    key={star}
                    onClick={() => setFilterRating(filterRating === star ? null : star)}
                    className={`w-full flex items-center gap-3 text-sm hover:opacity-80 transition-opacity ${
                      filterRating === star ? 'opacity-100' : 'opacity-70'
                    }`}
                  >
                    <span className="text-gray-600 w-8">{star} star</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          filterRating === star ? 'bg-black' : 'bg-gray-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-gray-600 text-xs w-12 text-right">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'highest' | 'lowest')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-black"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
        </div>
        {filterRating && (
          <button
            onClick={() => setFilterRating(null)}
            className="text-sm text-gray-600 hover:text-black flex items-center gap-1"
          >
            <span>Clear filter</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {sortedAndFilteredReviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No reviews found with selected filter.
          </div>
        ) : (
          sortedAndFilteredReviews.map((review) => (
            <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-sm">
                        {review.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{review.userName}</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                <svg
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {(() => {
                    const createdAt = review.createdAt as { toDate?: () => Date } | undefined;
                    if (createdAt?.toDate) {
                      return createdAt.toDate().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      });
                    } else if (createdAt && 'seconds' in createdAt && typeof (createdAt as { seconds: number }).seconds === 'number') {
                      return new Date((createdAt as { seconds: number }).seconds * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                    }
                    return 'Recently';
                  })()}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">{review.comment}</p>
            </div>
          ))
        )}
        </div>
    </div>
  );
};

export default ReviewList;
