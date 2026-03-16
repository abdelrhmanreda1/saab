'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { auth, app } from '@/lib/firebase';
import { getSettings } from '@/lib/firestore/settings_db';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  demoUser: { uid: string; phoneNumber?: string; displayName?: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [demoUser, setDemoUser] = useState<{ uid: string; phoneNumber?: string; displayName?: string } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoModeChecked, setDemoModeChecked] = useState(false);
  const db = getFirestore(app);

  // Load demo mode and demo user once on mount
  useEffect(() => {
    // Check for demo mode
    const checkDemoMode = async () => {
      try {
        const settings = await getSettings();
        const isDemoMode = settings?.demoMode || false;
        setDemoMode(isDemoMode);
        
        // Check for demo user in localStorage (check regardless of demo mode to handle edge cases)
        if (typeof window !== 'undefined') {
          const storedDemoUser = localStorage.getItem('pardah_demo_user');
          if (storedDemoUser) {
            try {
              const demoUserData = JSON.parse(storedDemoUser);
              // Only set demo user if demo mode is enabled
              if (isDemoMode) {
                setDemoUser(demoUserData);
              } else {
                // Clear demo user if demo mode is disabled
                localStorage.removeItem('pardah_demo_user');
              }
            } catch {
              // Failed to parse demo user
            }
          }
        }
      } catch {
        setDemoMode(false);
      } finally {
        setDemoModeChecked(true);
      }
    };
    checkDemoMode();
  }, []); // Run only once on mount

  // Also listen for localStorage changes (in case demo user is saved after mount)
  useEffect(() => {
    if (!demoMode || typeof window === 'undefined') {
      return;
    }
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pardah_demo_user') {
        if (e.newValue) {
          try {
            const demoUserData = JSON.parse(e.newValue);
            setDemoUser(demoUserData);
          } catch {
            // ignore parse error
          }
        } else {
          setDemoUser(null);
        }
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically (for same-tab updates since storage event doesn't fire for same tab)
    const interval = setInterval(() => {
      const storedDemoUser = localStorage.getItem('pardah_demo_user');
      if (storedDemoUser) {
        try {
          const demoUserData = JSON.parse(storedDemoUser);
          const hasChanged =
            !demoUser ||
            demoUser.uid !== demoUserData.uid ||
            demoUser.phoneNumber !== demoUserData.phoneNumber ||
            demoUser.displayName !== demoUserData.displayName;

          if (hasChanged) {
            setDemoUser(demoUserData);
          }
        } catch {
          // ignore parse error
        }
      } else if (demoUser) {
        setDemoUser(null);
      }
    }, 500); // Check every 500ms

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [demoMode, demoUser]);

  // Handle Firebase Auth state changes
  useEffect(() => {
    // Wait for demo mode check to complete before setting up Firebase Auth listener
    if (!demoModeChecked) {
      return;
    }
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
  }, [db, demoModeChecked, demoMode]); // Removed demoUser from dependencies to prevent infinite loop

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, demoUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
