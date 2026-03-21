'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { scheduleNonCriticalTask } from '@/lib/utils/schedule';

type FirebaseUser = import('firebase/auth').User;

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
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    const authTask = scheduleNonCriticalTask(() => {
      void (async () => {
        try {
          const [{ onAuthStateChanged }, firebaseModule] = await Promise.all([
            import('firebase/auth'),
            import('@/lib/firebase'),
          ]);

          if (cancelled) {
            return;
          }

          unsubscribe = onAuthStateChanged(firebaseModule.auth, (firebaseUser) => {
            if (cancelled) {
              return;
            }

            if (firebaseUser) {
              setUser(firebaseUser);
              setLoading(false);
              setIsAdmin(false);

              scheduleNonCriticalTask(() => {
                void (async () => {
                  try {
                    const [{ doc, getDoc, getFirestore }, { app }] = await Promise.all([
                      import('firebase/firestore'),
                      import('@/lib/firebase'),
                    ]);

                    if (cancelled) {
                      return;
                    }

                    const userDocRef = doc(getFirestore(app), 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (!cancelled) {
                      setIsAdmin(userDoc.exists() ? Boolean(userDoc.data().isAdmin) : false);
                    }
                  } catch {
                    if (!cancelled) {
                      setIsAdmin(false);
                    }
                  }
                })();
              }, 250);

              setDemoUser((prevDemoUser) => {
                if (prevDemoUser) {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('pardah_demo_user');
                  }
                  return null;
                }
                return prevDemoUser;
              });
              return;
            }

            setUser(null);
            setIsAdmin(false);

            if (demoMode && typeof window !== 'undefined') {
              const storedDemoUser = localStorage.getItem('pardah_demo_user');
              if (storedDemoUser) {
                try {
                  const demoUserData = JSON.parse(storedDemoUser);
                  setDemoUser((prevDemoUser) => {
                    if (prevDemoUser?.uid === demoUserData.uid) {
                      return prevDemoUser;
                    }
                    return demoUserData;
                  });
                } catch {
                  // ignore parse error
                }
              } else {
                setDemoUser((prevDemoUser) => (prevDemoUser ? null : prevDemoUser));
              }
            }

            setLoading(false);
          });
        } catch {
          if (!cancelled) {
            setLoading(false);
            setUser(null);
            setIsAdmin(false);
          }
        }
      })();
    }, 50);

    return () => {
      cancelled = true;
      authTask.cancel();
      unsubscribe();
    };
  }, [demoMode]);

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
