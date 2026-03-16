// d:\pardah\app\lib\auth.ts

import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from './firebase'; // Adjust path as needed
import { User } from './firestore'; // Import the User interface

const auth = getAuth(app);
const db = getFirestore(app);

export const loginAdmin = async (email: string, password: string): Promise<FirebaseUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if the user has admin role
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
      if (userData.isAdmin) {
        return user;
      } else {
        await signOut(auth); // Log out non-admin users
        throw new Error('Access Denied: Not an admin user.');
      }
    } else {
      await signOut(auth); // Log out if user data not found
      throw new Error('Access Denied: User data not found.');
    }
  } catch (error) {
    // Failed to login admin
    throw error;
  }
};

export const logoutAdmin = async (): Promise<void> => {
  await signOut(auth);
};

export const onAdminAuthStateChanged = (callback: (user: FirebaseUser | null, isAdmin: boolean) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        callback(user, userData.isAdmin ?? false);
      } else {
        callback(user, false); // User data not found, not an admin
      }
    } else {
      callback(null, false); // No user logged in
    }
  });
};

// Optional: Function to create an admin user (should only be used once or by a super-admin)
// In a real application, this would be done securely, e.g., via Firebase Cloud Functions
export const createAdminUser = async (email: string, password: string, displayName: string) => {
  // This function is for initial setup/testing. In production, consider Cloud Functions for security.
  // For now, we'll just create a user and mark them as admin in Firestore.
  // This assumes you have Firebase Authentication enabled for Email/Password.
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Set isAdmin to true in Firestore
    // This part would ideally be handled by a Cloud Function after user creation
    // to prevent client-side manipulation of admin status.
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add other user fields as necessary
    }, { merge: true });

    // Admin user created and marked in Firestore
    return user;
  } catch (error) {
    // Failed to create admin user
    throw error;
  }
};
