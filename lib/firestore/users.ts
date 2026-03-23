import { db, getFirebaseAuth } from '../firebase';
import { collection, getDocs, Timestamp, doc, setDoc, getDoc, updateDoc, increment, addDoc, deleteDoc } from "firebase/firestore";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  isAdmin?: boolean;
  role?: 'admin' | 'customer' | string;
  loginType?: 'google' | 'email' | 'phone'; // Track how user created account
  createdAt: Timestamp | { toDate: () => Date } | null;
  updatedAt?: Timestamp;
  walletBalance?: number;
  loyaltyPoints?: number;
  isBlocked?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string;
  phoneNumber: string | null;
  photoURL?: string | null;
  role: 'admin' | 'customer';
  createdAt: {
    toDate: () => Date;
  } | null;
  isBlocked?: boolean;
  walletBalance?: number;
  loyaltyPoints?: number;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

const getCurrentUserToken = async (uid: string): Promise<string | null> => {
  const auth = await getFirebaseAuth();
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    return null;
  }

  try {
    return await currentUser.getIdToken(true);
  } catch {
    return null;
  }
};

const mapApiProfileToUserProfile = (data: Record<string, unknown>): UserProfile => {
  const createdAtValue = data.createdAt as { _seconds?: number; _nanoseconds?: number; toDate?: () => Date } | null | undefined;
  const createdAt =
    createdAtValue && typeof createdAtValue.toDate === 'function'
      ? { toDate: () => createdAtValue.toDate!() }
      : createdAtValue && typeof createdAtValue._seconds === 'number'
      ? {
          toDate: () =>
            new Date(
              createdAtValue._seconds! * 1000 +
                Math.floor((createdAtValue._nanoseconds || 0) / 1_000_000)
            ),
        }
      : null;

  return {
    uid: (data.uid as string) || '',
    displayName: (data.displayName as string) || null,
    email: (data.email as string) || '',
    phoneNumber: (data.phoneNumber as string) || null,
    photoURL: (data.photoURL as string) || null,
    role: ((data.role as 'admin' | 'customer') || ((data.isAdmin as boolean) ? 'admin' : 'customer')),
    createdAt,
    isBlocked: Boolean(data.isBlocked),
    walletBalance: Number(data.walletBalance || 0),
    loyaltyPoints: Number(data.loyaltyPoints || 0),
    address: (data.address as UserProfile['address']) || undefined,
  };
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
          uid: doc.id,
          displayName: data.displayName || null,
          email: data.email || '',
          phoneNumber: data.phoneNumber || null,
          role: (data.isAdmin ? 'admin' : 'customer') as 'admin' | 'customer',
          createdAt: data.createdAt ? { toDate: () => data.createdAt.toDate() } : null,
          isBlocked: data.isBlocked || false,
      } as UserProfile;
  });
};

export const createUserProfile = async (user: User, isDemoMode?: boolean) => {
  if (!isDemoMode) {
    const token = await getCurrentUserToken(user.uid);
    if (token) {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          phoneNumber: user.phoneNumber,
          loginType: user.loginType,
          address: user.address,
        }),
      });

      if (response.ok) {
        return;
      }
    }
  }

  const userRef = doc(db, 'users', user.uid);
  try {
    // Check if user exists first to not overwrite wallet/points
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const existingData = userSnap.data();
        const mergedData = {
          ...user,
          walletBalance: existingData.walletBalance || 0,
          loyaltyPoints: existingData.loyaltyPoints || 0,
          updatedAt: Timestamp.now()
        };

        if (isDemoMode) {
          await setDoc(userRef, mergedData, { merge: true });
        } else {
          await updateDoc(userRef, mergedData);
        }
        return;
    }
  } catch {
    // If Firestore read is flaky in local dev, continue with a direct merge write.
  }

  await setDoc(userRef, {
      ...user,
      walletBalance: 0,
      loyaltyPoints: 0,
      updatedAt: Timestamp.now()
  }, { merge: true });
};

// Wallet & Loyalty Functions

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const token = await getCurrentUserToken(uid);
    if (token) {
        try {
            const response = await fetch('/api/account/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const result = await response.json();
            if (response.ok && result.success && result.profile) {
                return mapApiProfileToUserProfile(result.profile as Record<string, unknown>);
            }
        } catch {
            // Fall back to client Firestore below.
        }
    }

    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            return {
                uid: data.uid || uid,
                displayName: data.displayName || null,
                email: data.email || '',
                phoneNumber: data.phoneNumber || null,
                photoURL: data.photoURL || null,
                role: (data.isAdmin ? 'admin' : 'customer') as 'admin' | 'customer',
                createdAt: data.createdAt ? { toDate: () => data.createdAt.toDate() } : null,
                isBlocked: data.isBlocked || false,
                walletBalance: data.walletBalance || 0,
                loyaltyPoints: data.loyaltyPoints || 0,
                address: data.address || undefined,
            } as UserProfile;
        }
    } catch {
        return null;
    }
    return null;
};

export const addFundsToWallet = async (uid: string, amount: number) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        walletBalance: increment(amount),
        updatedAt: Timestamp.now()
    });
};

export const deductFundsFromWallet = async (uid: string, amount: number) => {
    const userRef = doc(db, 'users', uid);
    // You might want to check balance first, but for simplicity here:
    await updateDoc(userRef, {
        walletBalance: increment(-amount),
        updatedAt: Timestamp.now()
    });
};

export const addLoyaltyPoints = async (uid: string, points: number) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        loyaltyPoints: increment(points),
        updatedAt: Timestamp.now()
    });
};

export const redeemLoyaltyPoints = async (uid: string, points: number, conversionRate: number = 1) => {
    
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) throw new Error("User not found");
    
    const data = userSnap.data();
    const currentPoints = data.loyaltyPoints || 0;
    
    if (currentPoints < points) {
        throw new Error("Insufficient loyalty points");
    }
    
    const walletAmount = points * conversionRate;
    
    await updateDoc(userRef, {
        loyaltyPoints: increment(-points),
        walletBalance: increment(walletAmount),
        updatedAt: Timestamp.now()
    });
    
    return walletAmount;
};

// User Management Functions (from users_db.ts)

export const addUser = async (userData: Omit<UserProfile, 'uid' | 'createdAt'>): Promise<UserProfile> => {
  const now = Timestamp.now();
  const newUserData = {
    ...userData,
    role: userData.role || 'customer',
    isBlocked: false,
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(collection(db, 'users'), newUserData);
  return { 
    ...userData,
    uid: docRef.id, 
    createdAt: { toDate: () => now.toDate() },
    role: userData.role || 'customer',
    isBlocked: false,
  };
};

export const updateUser = async (uid: string, userData: Partial<UserProfile>): Promise<void> => {
  const token = await getCurrentUserToken(uid);
  if (token) {
    const response = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      return;
    }
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    ...userData,
    updatedAt: Timestamp.now(),
  });
};

export const blockUser = async (uid: string, isBlocked: boolean): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { 
    isBlocked,
    updatedAt: Timestamp.now(),
  });
};

export const deleteUser = async (uid: string): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  await deleteDoc(userDocRef);
};
