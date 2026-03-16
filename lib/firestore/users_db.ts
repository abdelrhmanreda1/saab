import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// This UserProfile interface should ideally be defined in a shared types file.
// For now, it's duplicated here for immediate development.
export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string;
  phoneNumber: string | null;
  role: 'admin' | 'customer';
  createdAt: {
    toDate: () => Date;
  } | null;
  isBlocked?: boolean; // Added for blocking functionality
}

const usersCollectionRef = collection(db, 'users');

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const querySnapshot = await getDocs(usersCollectionRef);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      uid: doc.id,
      displayName: data.displayName || null,
      email: data.email,
      phoneNumber: data.phoneNumber || null,
      role: data.role || 'customer',
      createdAt: data.createdAt ? { toDate: () => data.createdAt.toDate() } : null,
      isBlocked: data.isBlocked || false,
    } as UserProfile;
  });
};

export const addUser = async (userData: Omit<UserProfile, 'uid' | 'createdAt'>): Promise<UserProfile> => {
  const newUser = { ...userData, createdAt: new Date(), role: userData.role || 'customer', isBlocked: false };
  const docRef = await addDoc(usersCollectionRef, newUser);
  return { ...newUser, uid: docRef.id, createdAt: { toDate: () => newUser.createdAt } };
};

export const updateUser = async (uid: string, userData: Partial<UserProfile>): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, userData);
};

export const blockUser = async (uid: string, isBlocked: boolean): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { isBlocked });
};

export const deleteUser = async (uid: string): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  await deleteDoc(userDocRef);
};

