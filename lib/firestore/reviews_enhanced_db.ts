import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where, increment } from 'firebase/firestore';
import { Review, ProductQA, UserGeneratedContent } from './reviews_enhanced';

// ========== ENHANCED REVIEWS ==========
const reviewsCollectionRef = collection(db, 'reviews');

export const addReview = async (review: Omit<Review, 'id' | 'createdAt' | 'updatedAt' | 'helpfulCount' | 'helpfulUsers'>): Promise<string> => {
  const newReviewRef = await addDoc(reviewsCollectionRef, {
    ...review,
    helpfulCount: 0,
    helpfulUsers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newReviewRef.id;
};

export const getReview = async (id: string): Promise<Review | null> => {
  const reviewDocRef = doc(db, 'reviews', id);
  const reviewDoc = await getDoc(reviewDocRef);
  if (reviewDoc.exists()) {
    return { id: reviewDoc.id, ...reviewDoc.data() } as Review;
  }
  return null;
};

export const getReviewsByProductId = async (
  productId: string,
  filters?: {
    rating?: number;
    verifiedPurchase?: boolean;
    sortBy?: 'newest' | 'oldest' | 'helpful' | 'rating';
  }
): Promise<Review[]> => {
  let q = query(reviewsCollectionRef, where('productId', '==', productId));
  
  if (filters?.rating) {
    q = query(reviewsCollectionRef, where('productId', '==', productId), where('rating', '==', filters.rating));
  }
  
  if (filters?.verifiedPurchase !== undefined) {
    q = query(reviewsCollectionRef, where('productId', '==', productId), where('verifiedPurchase', '==', filters.verifiedPurchase));
  }
  
  // Apply sorting
  const sortField = filters?.sortBy === 'helpful' ? 'helpfulCount' : 
                    filters?.sortBy === 'rating' ? 'rating' : 
                    'createdAt';
  const sortOrder = filters?.sortBy === 'oldest' ? 'asc' : 'desc';
  
  q = query(q, orderBy(sortField, sortOrder));
  
  const querySnapshot = await getDocs(q);
  let reviews = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
  
  // Client-side filtering for verifiedPurchase if rating filter is also applied
  if (filters?.verifiedPurchase !== undefined && filters?.rating) {
    reviews = reviews.filter(r => r.verifiedPurchase === filters.verifiedPurchase);
  }
  
  return reviews;
};

export const getAllReviews = async (limitCount?: number, minRating?: number): Promise<Review[]> => {
  let q = query(reviewsCollectionRef, orderBy('createdAt', 'desc'));
  
  if (minRating) {
    // Note: Firestore doesn't support >= in a single query easily, so we'll filter client-side
    q = query(reviewsCollectionRef, orderBy('createdAt', 'desc'));
  }
  
  if (limitCount) {
    // Note: limit() needs to be used with orderBy, which we already have
    // We'll apply limit client-side if needed
  }
  
  const querySnapshot = await getDocs(q);
  let reviews = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
  
  // Filter by minRating if provided
  if (minRating) {
    reviews = reviews.filter(r => r.rating >= minRating);
  }
  
  // Apply limit if provided
  if (limitCount) {
    reviews = reviews.slice(0, limitCount);
  }
  
  return reviews;
};

export const updateReview = async (id: string, review: Partial<Omit<Review, 'id' | 'createdAt'>>): Promise<void> => {
  const reviewDocRef = doc(db, 'reviews', id);
  await updateDoc(reviewDocRef, {
    ...review,
    updatedAt: new Date(),
  });
};

export const deleteReview = async (id: string): Promise<void> => {
  const reviewDocRef = doc(db, 'reviews', id);
  await deleteDoc(reviewDocRef);
};

export const markReviewHelpful = async (reviewId: string, userId: string): Promise<void> => {
  const reviewDocRef = doc(db, 'reviews', reviewId);
  const review = await getReview(reviewId);
  
  if (review && !review.helpfulUsers?.includes(userId)) {
    const currentUsers = review.helpfulUsers || [];
    await updateDoc(reviewDocRef, {
      helpfulCount: increment(1),
      helpfulUsers: [...currentUsers, userId],
      updatedAt: new Date(),
    });
  }
};

export const unmarkReviewHelpful = async (reviewId: string, userId: string): Promise<void> => {
  const reviewDocRef = doc(db, 'reviews', reviewId);
  const review = await getReview(reviewId);
  
  if (review && review.helpfulUsers?.includes(userId)) {
    const currentUsers = review.helpfulUsers.filter(id => id !== userId);
    await updateDoc(reviewDocRef, {
      helpfulCount: increment(-1),
      helpfulUsers: currentUsers,
      updatedAt: new Date(),
    });
  }
};

// ========== PRODUCT Q&A ==========
const qaCollectionRef = collection(db, 'product_qa');

export const addProductQuestion = async (qa: Omit<ProductQA, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newQARef = await addDoc(qaCollectionRef, {
    ...qa,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newQARef.id;
};

export const getProductQuestion = async (id: string): Promise<ProductQA | null> => {
  const qaDocRef = doc(db, 'product_qa', id);
  const qaDoc = await getDoc(qaDocRef);
  if (qaDoc.exists()) {
    return { id: qaDoc.id, ...qaDoc.data() } as ProductQA;
  }
  return null;
};

export const getProductQuestions = async (productId: string, publicOnly?: boolean): Promise<ProductQA[]> => {
  let q = query(qaCollectionRef, where('productId', '==', productId), orderBy('createdAt', 'desc'));
  if (publicOnly) {
    q = query(qaCollectionRef, where('productId', '==', productId), where('isPublic', '==', true), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductQA));
};

export const answerProductQuestion = async (id: string, answer: string, answeredBy: string, answeredByName: string): Promise<void> => {
  const qaDocRef = doc(db, 'product_qa', id);
  await updateDoc(qaDocRef, {
    answer,
    answeredBy,
    answeredByName,
    answeredAt: new Date(),
    updatedAt: new Date(),
  });
};

export const deleteProductQuestion = async (id: string): Promise<void> => {
  const qaDocRef = doc(db, 'product_qa', id);
  await deleteDoc(qaDocRef);
};

// ========== USER-GENERATED CONTENT ==========
const ugcCollectionRef = collection(db, 'user_generated_content');

export const addUserGeneratedContent = async (content: Omit<UserGeneratedContent, 'id' | 'createdAt' | 'updatedAt' | 'likes'>): Promise<string> => {
  const newContentRef = await addDoc(ugcCollectionRef, {
    ...content,
    likes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newContentRef.id;
};

export const getUserGeneratedContent = async (id: string): Promise<UserGeneratedContent | null> => {
  const contentDocRef = doc(db, 'user_generated_content', id);
  const contentDoc = await getDoc(contentDocRef);
  if (contentDoc.exists()) {
    return { id: contentDoc.id, ...contentDoc.data() } as UserGeneratedContent;
  }
  return null;
};

export const getProductUserGeneratedContent = async (productId: string, approvedOnly?: boolean): Promise<UserGeneratedContent[]> => {
  let q = query(ugcCollectionRef, where('productId', '==', productId), orderBy('createdAt', 'desc'));
  if (approvedOnly) {
    q = query(ugcCollectionRef, where('productId', '==', productId), where('isApproved', '==', true), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserGeneratedContent));
};

export const updateUserGeneratedContent = async (id: string, content: Partial<Omit<UserGeneratedContent, 'id' | 'createdAt'>>): Promise<void> => {
  const contentDocRef = doc(db, 'user_generated_content', id);
  await updateDoc(contentDocRef, {
    ...content,
    updatedAt: new Date(),
  });
};

export const deleteUserGeneratedContent = async (id: string): Promise<void> => {
  const contentDocRef = doc(db, 'user_generated_content', id);
  await deleteDoc(contentDocRef);
};

