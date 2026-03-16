// d:\pardah\app\lib\firestore\coupons.ts

import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';

export interface Coupon {
  id?: string; // ID is optional when creating a new coupon
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderAmount?: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  isActive: boolean;
  usageLimit?: number; // Total usage limit for all users
  perUserLimit?: number; // Usage limit per user
  usedCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const couponsCollection = collection(db, 'coupons');

// Add a new coupon
export const addCoupon = async (coupon: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'usedCount'>): Promise<string> => {
  const newCoupon: Omit<Coupon, 'id'> = {
    ...coupon,
    usedCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(couponsCollection, newCoupon);
  return docRef.id;
};

// Get a single coupon by ID
export const getCoupon = async (id: string): Promise<Coupon | null> => {
  const docRef = doc(db, 'coupons', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Coupon;
  }
  return null;
};

// Get a coupon by code
export const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  const q = query(couponsCollection, where('code', '==', code));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Coupon;
  }
  return null;
};

// Get all coupons
export const getAllCoupons = async (): Promise<Coupon[]> => {
  const querySnapshot = await getDocs(couponsCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Coupon[];
};

// Update an existing coupon
export const updateCoupon = async (id: string, updates: Partial<Omit<Coupon, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'coupons', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

// Delete a coupon
export const deleteCoupon = async (id: string): Promise<void> => {
  const docRef = doc(db, 'coupons', id);
  await deleteDoc(docRef);
};

// Increment coupon usage count
export const incrementCouponUsage = async (couponCode: string): Promise<void> => {
  const coupon = await getCouponByCode(couponCode);
  if (coupon && coupon.id) {
    const docRef = doc(db, 'coupons', coupon.id);
    await updateDoc(docRef, {
      usedCount: (coupon.usedCount || 0) + 1,
      updatedAt: Timestamp.now(),
    });
  }
};

// Get user's coupon usage count from orders
export const getUserCouponUsage = async (userId: string, couponCode: string): Promise<number> => {
  const { getOrdersByUserId } = await import('./orders_db');
  const orders = await getOrdersByUserId(userId);
  return orders.filter(order => order.couponCode === couponCode).length;
};
