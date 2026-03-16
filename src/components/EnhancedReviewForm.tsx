'use client';

import React, { useState } from 'react';
import { addReview } from '@/lib/firestore/reviews_enhanced_db';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { getOrdersByUserId } from '@/lib/firestore/orders_db';
import Image from 'next/image';

interface EnhancedReviewFormProps {
  productId: string;
  onReviewSubmitted: () => void;
}

const EnhancedReviewForm: React.FC<EnhancedReviewFormProps> = ({ productId, onReviewSubmitted }) => {
  const { user, demoUser } = useAuth();
  const { settings } = useSettings();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verifiedPurchase, setVerifiedPurchase] = useState(false);

  // Check if user has purchased this product
  React.useEffect(() => {
    const checkPurchase = async () => {
      const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
      if (userId) {
        try {
          const orders = await getOrdersByUserId(userId);
          const hasPurchased = orders.some(order => 
            order.items.some(item => item.productId === productId) && 
            (order.status === 'delivered' || order.status === 'shipped')
          );
          setVerifiedPurchase(hasPurchased);
        } catch {
          // Failed to check purchase
        }
      }
    };
    checkPurchase();
  }, [user, demoUser, settings?.demoMode, productId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 5); // Max 5 photos
      setPhotos(files);
      const previews = files.map(file => URL.createObjectURL(file));
      setPhotoPreviews(previews);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
  };

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
      // Upload photos
      const uploadedPhotos = [];
      for (const photo of photos) {
        const photoRef = ref(storage, `reviews/${productId}/${userId}/${Date.now()}_${photo.name}`);
        await uploadBytes(photoRef, photo);
        const url = await getDownloadURL(photoRef);
        uploadedPhotos.push({
          url,
          uploadedAt: Timestamp.now(),
        });
      }

      await addReview({
        productId,
        userId: userId,
        userName: user?.displayName || demoUser?.displayName || user?.email || demoUser?.phoneNumber || 'Anonymous',
        userEmail: user?.email || undefined,
        rating,
        comment,
        photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
        verifiedPurchase,
      });

      setSuccess('Review submitted successfully!');
      setRating(0);
      setComment('');
      setPhotos([]);
      setPhotoPreviews([]);
      onReviewSubmitted();
    } catch {
      // Failed to submit review
      setError('Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Write a Review</h3>
      {!user && !(settings?.demoMode && demoUser) && (
        <p className="text-red-500 mb-4">Please log in to submit a review.</p>
      )}
      {verifiedPurchase && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          ✓ Verified Purchase
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Rating:</label>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-6 h-6 cursor-pointer ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
                onClick={() => user && setRating(star)}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="comment" className="block text-gray-700 text-sm font-bold mb-2">
            Your Comment:
          </label>
          <textarea
            id="comment"
            rows={4}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Share your thoughts about the product..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={!user || loading}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Photos (Optional, max 5):
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            disabled={!user || loading || photos.length >= 5}
            className="mb-2"
          />
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative w-20 h-20">
                  <Image src={preview} alt={`Preview ${index + 1}`} width={80} height={80} className="w-full h-full object-cover rounded" unoptimized />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        {success && <p className="text-green-500 text-xs italic mb-4">{success}</p>}
        <button
          type="submit"
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
            (!user || loading) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={!user || loading}
        >
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
};

export default EnhancedReviewForm;

