'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { auth, app } from '@/lib/firebase';
import { useSettings } from './SettingsContext';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  demoUser: { uid: string; phoneNumber?: string; displayName?: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { settings } = useSettings();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [demoUser, setDemoUser] = useState<{ uid: string; phoneNumber?: string; displayName?: string } | null>(null);
  const db = getFirestore(app);
  const demoMode = settings?.demoMode || false;

  // Sync demo user from localStorage when demo mode changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedDemoUser = localStorage.getItem('pardah_demo_user');
    if (!storedDemoUser) {
      if (!demoMode) {
        setDemoUser(null);
      }
      return;
    }

    try {
      const demoUserData = JSON.parse(storedDemoUser);
      if (demoMode) {
        setDemoUser(demoUserData);
      } else {
        localStorage.removeItem('pardah_demo_user');
        setDemoUser(null);
      }
    } catch {
      setDemoUser(null);
    }
  }, [demoMode]);

  // Also listen for localStorage changes (in case demo user is saved after mount)
  useEffect(() => {
    if (!demoMode || typeof window === 'undefined') {
      return;
    }
    const syncDemoUserFromStorage = () => {
      const storedDemoUser = localStorage.getItem('pardah_demo_user');
      if (storedDemoUser) {
        try {
          const demoUserData = JSON.parse(storedDemoUser);
          setDemoUser((prevDemoUser) => {
            const hasChanged =
              !prevDemoUser ||
              prevDemoUser.uid !== demoUserData.uid ||
              prevDemoUser.phoneNumber !== demoUserData.phoneNumber ||
              prevDemoUser.displayName !== demoUserData.displayName;

            return hasChanged ? demoUserData : prevDemoUser;
          });
        } catch {
          // ignore parse error
        }
      } else {
        setDemoUser((prevDemoUser) => (prevDemoUser ? null : prevDemoUser));
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pardah_demo_user') {
        syncDemoUserFromStorage();
      }
    };

    const handleDemoUserUpdate = () => {
      syncDemoUserFromStorage();
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('demo-user-updated', handleDemoUserUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('demo-user-updated', handleDemoUserUpdate);
    };
  }, [demoMode]);

  // Handle Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().isAdmin || false);
          } else {
            setIsAdmin(false);
          }
        } catch {
          setIsAdmin(false);
        }
        // Clear demo user if Firebase user exists
        setDemoUser((prevDemoUser) => {
          if (prevDemoUser) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('pardah_demo_user');
            }
            return null;
          }
          return prevDemoUser;
        });
        setLoading(false);
      } else {
        setUser(null);
        setIsAdmin(false);
        // If no Firebase user but demo mode is enabled and demo user exists, keep it
        // Check if demo user exists in localStorage (it should already be loaded)
        // Use functional update to avoid dependency on demoUser state
        if (demoMode && typeof window !== 'undefined') {
          const storedDemoUser = localStorage.getItem('pardah_demo_user');
          if (storedDemoUser) {
            try {
              const demoUserData = JSON.parse(storedDemoUser);
              // Only update if different to avoid infinite loop
              setDemoUser((prevDemoUser) => {
                if (prevDemoUser?.uid === demoUserData.uid) {
                  return prevDemoUser; // No change needed
                }
                return demoUserData;
              });
            } catch {
              // ignore parse error
            }
          } else {
            // Clear demo user if it exists in state but not in localStorage
            setDemoUser((prevDemoUser) => {
              if (prevDemoUser) {
                return null;
              }
              return prevDemoUser;
            });
          }
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [db, demoMode]);

  const value = useMemo(
    () => ({ user, loading, isAdmin, demoUser }),
    [demoUser, isAdmin, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
