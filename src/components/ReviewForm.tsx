'use client';

import React, { useState } from 'react';
import { addReview } from '@/lib/firestore/reviews';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

interface ReviewFormProps {
  productId: string;
  onReviewSubmitted: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ productId, onReviewSubmitted }) => {
  const { user, demoUser } = useAuth();
  const { settings } = useSettings();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId) {
      setError('You must be logged in to submit a review.');
      return;
    }
    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }
    if (comment.trim() === '') {
      setError('Please enter a comment.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addReview({
        productId,
        userId: userId,
        userName: user?.displayName || demoUser?.displayName || user?.email || demoUser?.phoneNumber || 'Anonymous',
        rating,
        comment,
      });
      setSuccess('Review submitted successfully!');
      setRating(0);
      setComment('');
      onReviewSubmitted(); // Notify parent component to refresh reviews
    } catch (err: unknown) {
      // Failed to submit review
      // Check if it's a permissions error
      const errorObj = err as { message?: string; code?: string };
      if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
        setError('Unable to submit review due to permissions. Please contact support.');
      } else {
      setError('Failed to submit review. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-heading font-bold mb-2 text-gray-900">Write a Review</h3>
      <p className="text-sm text-gray-500 mb-4">Share your thoughts with other customers.</p>
      
      {!user && !(settings?.demoMode && demoUser) ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          Please <a href="/login" className="underline font-semibold">log in</a> to submit a review.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Your Rating:
          </label>
            <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`transition-transform hover:scale-110 ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
                >
                  <svg
                    className="w-8 h-8"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
              </svg>
                </button>
            ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {rating === 5 && 'Excellent!'}
                {rating === 4 && 'Very Good'}
                {rating === 3 && 'Good'}
                {rating === 2 && 'Fair'}
                {rating === 1 && 'Poor'}
              </p>
            )}
          </div>
          
          <div>
            <label htmlFor="comment" className="block text-gray-700 text-sm font-semibold mb-2">
              Your Review:
          </label>
          <textarea
            id="comment"
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors resize-none"
              placeholder="Share your experience with this product..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">{comment.length} characters</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              {success}
        </div>
          )}
          
        <button
          type="submit"
            className={`w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
            disabled={loading || rating === 0 || comment.trim() === ''}
        >
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
      )}
    </div>
  );
};

export default ReviewForm;
