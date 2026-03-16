import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { app } from '../firebase';

export interface Review {
  id?: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5 stars
  comment: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const db = getFirestore(app);
const reviewsCollection = collection(db, 'reviews');

export const addReview = async (review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newReview: Omit<Review, 'id'> = {
    ...review,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(reviewsCollection, newReview);
  return docRef.id;
};

export const getReviewsByProductId = async (productId: string): Promise<Review[]> => {
  const q = query(reviewsCollection, where('productId', '==', productId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
};

export const updateReview = async (reviewId: string, reviewData: Partial<Omit<Review, 'id' | 'createdAt'>>) => {
  const reviewRef = doc(db, 'reviews', reviewId);
  await updateDoc(reviewRef, {
    ...reviewData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteReview = async (reviewId: string) => {
  const reviewRef = doc(db, 'reviews', reviewId);
  await deleteDoc(reviewRef);
};
