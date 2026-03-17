'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { 
  getAuth, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  GoogleAuthProvider, 
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  createUserWithEmailAndPassword,
  ConfirmationResult,
  updateProfile,
  UserCredential,
  onAuthStateChanged
} from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserProfile, getUserProfile } from '@/lib/firestore/users';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | undefined;
  }
}

const SAUDI_DIAL_CODE = '+966';
const getSaudiNationalNumber = (phone?: string) => {
  if (!phone) return '';
  return phone.startsWith(SAUDI_DIAL_CODE) ? phone.slice(SAUDI_DIAL_CODE.length) : phone.replace(/^\+?966/, '');
};
const buildSaudiPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${SAUDI_DIAL_CODE}${digits}` : '';
};

const LoginForm = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const { user, demoUser, loading: authLoading } = useAuth();
  const isArabic =
    typeof document !== 'undefined'
      ? document.documentElement.dir === 'rtl' || document.documentElement.lang?.toLowerCase() === 'ar'
      : false;
  
  // Check if user account creation is enabled
  const isAccountCreationEnabled = settings?.site?.enableUserAccountCreation !== false;
  
  // This storefront is configured for phone-only authentication.
  const enablePhoneLogin = true;
  const enableGoogleLogin = false;
  const enableEmailLogin = false;
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp' | 'email' | 'email-otp' | 'name' | 'google-name'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  // Optional email during name step (mainly for phone login users)
  const [nameStepEmail, setNameStepEmail] = useState('');
  const [pendingUser, setPendingUser] = useState<{uid: string; email?: string | null; phoneNumber?: string | null; photoURL?: string | null} | null>(null);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email' | 'google' | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [, setRecaptchaReady] = useState(false);
  
  // Update step if phone login is disabled and we're on phone step
  useEffect(() => {
    if (step === 'phone' && !enablePhoneLogin) {
      if (enableEmailLogin) {
        setStep('email');
      } else if (enableGoogleLogin) {
        // Stay on phone step but Google button will be shown
        setStep('phone');
      }
    }
  }, [enablePhoneLogin, enableEmailLogin, enableGoogleLogin, step]);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/account/profile';

  const auth = getAuth(app);

  // Redirect if user is already logged in (normal or demo)
  // BUT sirf initial login screens pe (phone/email) – OTP ya name step ke dauran redirect mat karo,
  // warna race condition se name/email page skip ho jata hai.
  useEffect(() => {
    if (authLoading) {
      // Wait for auth to finish loading
      return;
    }

    // Sirf in steps pe auto-redirect allow karo:
    // - phone / email / email-otp (jab banda seedha /login kholta hai aur already logged-in hai)
    const isInitialLoginScreen =
      step === 'phone' || step === 'email' || step === 'email-otp';

    if (!isInitialLoginScreen) {
      // OTP, name ya google-name waghera pe kabhi yahan se redirect nahi karna
      return;
    }

    if (user || demoUser) {
      router.push('/account/profile');
    }
  }, [user, demoUser, authLoading, router, step]);

  // Check for redirect result on mount (for Google login)
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        // Wait a bit for auth state to settle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          
          // Check if user profile exists
          let existingUser = null;
          try {
            existingUser = await getUserProfile(user.uid);
          } catch {
            // User doesn't exist or error fetching
          }
          
          // If existing user, login directly
          if (existingUser) {
            if (existingUser.role === 'admin') {
              router.push('/admin');
            } else {
              router.push(returnUrl);
            }
            setLoading(false);
            return;
          }
          
          // If user doesn't exist and account creation is disabled, block it
          if (!existingUser && !isAccountCreationEnabled) {
            setError(t('login.account_creation_disabled') || "Account creation is currently disabled. Please contact support.");
            setLoading(false);
            return;
          }
          
          // New Google user - create profile immediately and redirect (skip extra name step for smoother UX)
          try {
            await createUserProfile({
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null,
              phoneNumber: user.phoneNumber || null,
              loginType: 'google',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: false,
            });
          } catch {
            // Even if profile creation fails, user is authenticated; continue to redirect
          }

          router.push(returnUrl);
          return;
        } else {
          // No redirect result – maybe user already signed in (auth.currentUser) or redirect failed
          const currentUser = auth.currentUser;

          // If we already have a Firebase user with Google provider, treat it as successful login
          if (currentUser && currentUser.providerData.some(p => p.providerId === 'google.com')) {
            try {
              const existingUser = await getUserProfile(currentUser.uid);
              if (existingUser) {
                if (existingUser.role === 'admin') {
                  router.push('/admin');
                } else {
                  router.push(returnUrl);
                }
                setLoading(false);
                return;
              }

              // Create profile if it doesn't exist
              await createUserProfile({
                uid: currentUser.uid,
                email: currentUser.email || null,
                displayName: currentUser.displayName || null,
                photoURL: currentUser.photoURL || null,
                phoneNumber: currentUser.phoneNumber || null,
                loginType: 'google',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                isAdmin: false,
              });

              router.push(returnUrl);
              setLoading(false);
              return;
            } catch {
              // Failed to handle current Google user
            }
          }
        }
      } catch (error: unknown) {
        // Failed to redirect result
        const errorObj = error as { code?: string; message?: string };
        
        // Even if getRedirectResult fails, check if user is already authenticated
        // (sometimes redirect completes but getRedirectResult doesn't return the result)
        const currentUser = auth.currentUser;
        
        if (currentUser && currentUser.providerData.some(p => p.providerId === 'google.com')) {
          try {
            const existingUser = await getUserProfile(currentUser.uid);
            if (existingUser) {
              if (existingUser.role === 'admin') {
                router.push('/admin');
              } else {
                router.push(returnUrl);
              }
              setLoading(false);
              return;
            }
            
            // Create profile if it doesn't exist
            await createUserProfile({
              uid: currentUser.uid,
              email: currentUser.email || null,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              phoneNumber: currentUser.phoneNumber || null,
              loginType: 'google',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: false,
            });
            
            router.push(returnUrl);
            setLoading(false);
            return;
          } catch {
            // Failed to handle Google user in error fallback
          }
        }
        
        if (errorObj?.code !== 'auth/popup-closed-by-user' && errorObj?.code !== 'auth/cancelled-popup-request') {
          setError(t('login.google_failed') || 'Failed to sign in with Google.');
        }
      } finally {
        setLoading(false);
      }
    };

    checkRedirectResult();
    
    // Also listen for auth state changes (sometimes user gets authenticated but getRedirectResult doesn't return)
    // This is a fallback for when redirect completes but getRedirectResult doesn't catch it
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
        // Check if we're on login page and user just authenticated
        if (typeof window !== 'undefined' && window.location.pathname === '/login') {
          try {
            const existingUser = await getUserProfile(firebaseUser.uid);
            if (existingUser) {
              if (existingUser.role === 'admin') {
                router.push('/admin');
              } else {
                router.push(returnUrl);
              }
              return;
            }
            
            // Create profile if it doesn't exist
            await createUserProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || null,
              displayName: firebaseUser.displayName || null,
              photoURL: firebaseUser.photoURL || null,
              phoneNumber: firebaseUser.phoneNumber || null,
              loginType: 'google',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: false,
            });
            
            router.push(returnUrl);
          } catch {
            // Failed to handle Google user via onAuthStateChanged
          }
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [auth, router, returnUrl, t, isAccountCreationEnabled]);

  // Don't pre-initialize reCAPTCHA - create it only when needed (like demo site)
  useEffect(() => {
    // Check if reCAPTCHA is already ready
    if (!window.recaptchaVerifier) {
      setRecaptchaReady(true);
    }
  }, []);

  const handlePhoneLogin = async () => {
    try {
      setError(null);
      
      if (!phoneNumber) {
        setError(t('login.enter_phone') || "Please enter a valid phone number");
        return;
      }

      // Validate phone number format (E.164)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        setError(t('login.error_invalid_phone') || 'Invalid phone number format. Please include country code (e.g., +923001234567)');
        return;
      }

      if (!phoneNumber.startsWith('+966')) {
        setError('Only Saudi phone numbers are allowed.');
        return;
      }

      setLoading(true);

      // Demo mode check - use mock OTP instead of real SMS (check BEFORE reCAPTCHA)
      if (settings?.demoMode) {
        // Mock verification - auto accept any OTP in demo mode
        // Store a mock verification ID
        const mockVerificationId = {
          verificationId: 'demo-mock-verification-id',
          confirm: async (code: string) => {
            // In demo mode, accept any 6-digit code
            if (code && code.length === 6) {
              // Create a mock user result
              const mockUser = {
                uid: 'demo-user-' + Date.now(),
                phoneNumber: phoneNumber as string,
                email: null,
                photoURL: null,
              };
              return {
                user: mockUser,
                operationType: 'signIn' as const,
                providerId: 'phone',
              } as UserCredential;
            }
            throw new Error('Invalid code');
          }
        } as ConfirmationResult;
        setVerificationId(mockVerificationId);
        setStep('otp');
        setLoading(false);
        // Show demo mode modal
        setShowDemoModal(true);
        return;
      }

      // Create reCAPTCHA verifier only when needed (like demo site - invisible)
      // Only initialize if NOT in demo mode
      if (!window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible', // Invisible reCAPTCHA like demo site
            'callback': () => {
              setRecaptchaReady(true);
            }
          });
        } catch {
          setError(t('login.recaptcha_error') || 'Failed to initialize reCAPTCHA. Please refresh the page.');
          setLoading(false);
          return;
        }
      }

      const appVerifier = window.recaptchaVerifier;
      
      try {
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        setVerificationId(confirmationResult);
        setStep('otp');
        setLoading(false);
        // Clear reCAPTCHA after successful OTP send (like demo site)
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch {
            // Ignore cleanup errors
          }
          window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
        }
      } catch (renderError: Error | unknown) {
        throw renderError;
      }
    } catch (error: unknown) {
      // Failed to sign in with phone
       const errorObj = error as { code?: string; message?: string };
       
       let errorMessage = errorObj.message || "An unknown error occurred";
       
       // Handle specific Firebase errors
       if (errorObj.code === 'auth/invalid-app-credential' || 
           errorObj.code === 'auth/captcha-check-failed' ||
           errorObj.code === 'auth/missing-app-credential') {
         errorMessage = t('login.error_recaptcha_invalid') || 'reCAPTCHA verification failed. Please refresh the page and try again.';
         // Reset verifier on invalid credential
         if (window.recaptchaVerifier) {
           try {
             window.recaptchaVerifier.clear();
           } catch {
             // Ignore cleanup errors
           }
           window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
         }
         // Re-initialize reCAPTCHA after error
         setTimeout(() => {
           const container = document.getElementById('recaptcha-container');
           if (container) {
             // Clear container and re-initialize
             container.innerHTML = '';
             // Re-initialize reCAPTCHA without page reload
            const initializeRecaptcha = async () => {
              if (!window.recaptchaVerifier) {
                try {
                  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible', // Invisible like demo site
                    'callback': () => {
                      setRecaptchaReady(true);
                    }
                  });
                } catch {
                  // Ignore reCAPTCHA re-init errors; user can retry
                }
              }
            };
             initializeRecaptcha();
           }
         }, 2000);
       } else if (errorObj.code === 'auth/invalid-phone-number') {
         errorMessage = t('login.error_invalid_phone') || 'Invalid phone number. Please check and try again.';
      } else if (errorObj.code === 'auth/too-many-requests') {
        errorMessage = t('login.error_too_many_requests') || 'Too many requests. Please wait a few minutes before trying again.';
        // Clear verifier and reset state for too-many-requests
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch {
            // Ignore cleanup errors
          }
          window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
        }
      } else if (errorObj.code === 'auth/quota-exceeded') {
         errorMessage = t('login.error_quota_exceeded') || 'SMS quota exceeded. Please try again later.';
       }
       
       setError(errorMessage);
       // Reset captcha if error occurs
       if (window.recaptchaVerifier) {
         try {
           window.recaptchaVerifier.clear();
         } catch {
           // Ignore cleanup errors
         }
         // Re-init will happen on next render via useEffect
         window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
       }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOtpSend = async () => {
    try {
      setError(null);
      
      if (!email) {
        setError(t('login.email_required') || 'Email is required');
        return;
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError(t('login.email_invalid') || 'Invalid email address');
        return;
      }
      
      setLoading(true);
      
      // Check if user exists in Firestore
      try {
        // Check Firestore directly for loginType
        try {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const loginType = userData.loginType;
            
            if (loginType === 'google') {
              setError(t('login.use_google') || 'This email is registered with Google. Please use Google login to sign in.');
              setLoading(false);
              return;
            }
            // If loginType is 'phone' or 'email' or null, continue with OTP flow
          }
        } catch {
          // Permission error or other issue - ignore and continue with OTP
          // This is expected if user is not authenticated
        }
        
        // User doesn't exist or check failed - proceed with OTP for new user
        const response = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          setError(result.error || 'Failed to send OTP');
          setLoading(false);
          return;
        }
        
        setStep('email-otp');
        setLoading(false);
      } catch (err: unknown) {
        // If all checks fail, still try to send OTP (might be new user)
        try {
          const response = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          
          const result = await response.json();
          
          if (!result.success) {
            setError(result.error || 'Failed to send OTP');
            setLoading(false);
            return;
          }
          
          setStep('email-otp');
          setLoading(false);
        } catch {
          setError(err instanceof Error ? err.message : 'Failed to send OTP');
          setLoading(false);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
      setLoading(false);
    }
  };

  const handleEmailOtpVerify = async () => {
    try {
      setError(null);
      
      if (!otp || otp.length !== 6) {
        setError(t('login.enter_code') || "Please enter the 6-digit verification code");
        return;
      }
      
      setLoading(true);
      
      // Verify OTP
      const response = await fetch('/api/send-otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Invalid OTP');
        setLoading(false);
        return;
      }
      
      // OTP verified - proceed to name step
      setPendingUser({ uid: '', email });
      setLoginMethod('email');
      setStep('name');
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setError(null);
      
      if (!otp) {
        setError(t('login.enter_code') || "Please enter the verification code");
        return;
      }
      
      setLoading(true);

      if (verificationId) {
        // Demo mode check - accept any 6-digit OTP
        if (settings?.demoMode && verificationId.verificationId === 'demo-mock-verification-id') {
          // Mock verification - create a demo user with consistent UID based on phone
          // Use phone number hash to generate consistent UID for same phone number
          const phoneStr = phoneNumber as string;
          let phoneHash = 0;
          for (let i = 0; i < phoneStr.length; i++) {
            const char = phoneStr.charCodeAt(i);
            phoneHash = ((phoneHash << 5) - phoneHash) + char;
            phoneHash = phoneHash & phoneHash; // Convert to 32-bit integer
          }
          const mockUser = {
            uid: `demo-${Math.abs(phoneHash)}`,
            phoneNumber: phoneStr,
            email: null,
            photoURL: null,
          };
          
          // Check if user profile exists
          let existingUser: { id: string; displayName?: string | null; role?: string; email?: string | null } | null = null;
          try {
            // Try to find existing user by phone
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              existingUser = {
                id: userDoc.id,
                ...userDoc.data(),
              } as { id: string; displayName?: string | null; role?: string; email?: string | null };
              // Use existing UID
              mockUser.uid = userDoc.id;
            }
          } catch {
            // Ignore errors
          }
          
          // If existing user and profile is complete, login directly
          if (existingUser) {
            const hasName = !!existingUser.displayName;
            const hasEmail = !!existingUser.email;

            // Agar naam ya email missing hai to onboarding (name/email step) pe le jao
            if (!hasName || !hasEmail) {
              setPendingUser({
                uid: mockUser.uid,
                email: existingUser.email || mockUser.email,
                phoneNumber: mockUser.phoneNumber,
                photoURL: mockUser.photoURL,
              });
              setLoginMethod('phone');
              setStep('name');
              setLoading(false);
              return;
            }

            // Store demo user in localStorage for existing users
            const demoUserData = {
              uid: mockUser.uid,
              phoneNumber: mockUser.phoneNumber,
              displayName: existingUser?.displayName || '',
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem('pardah_demo_user', JSON.stringify(demoUserData));
            }
            
            // Small delay to ensure localStorage is saved and AuthContext can pick it up
            setTimeout(() => {
              const userRole = existingUser?.role;
              if (userRole === 'admin') {
                window.location.href = '/admin';
              } else {
                window.location.href = returnUrl || '/';
              }
            }, 200);
            setLoading(false);
            return;
          }
          
          // New user - ask for name
          setPendingUser({
            uid: mockUser.uid,
            email: mockUser.email,
            phoneNumber: mockUser.phoneNumber,
            photoURL: mockUser.photoURL,
          });
          setLoginMethod('phone');
          setStep('name');
          setLoading(false);
          return;
        }
        
        const result = await verificationId.confirm(otp);
        const user = result.user;
        
        // Check if user profile exists
        let existingUser = null;
        try {
          existingUser = await getUserProfile(user.uid);
        } catch {
          // User doesn't exist
        }
        
        // If user doesn't exist and account creation is disabled, block it
        if (!existingUser && !isAccountCreationEnabled) {
          setError(t('login.account_creation_disabled') || "Account creation is currently disabled. Please contact support.");
          setLoading(false);
          return;
        }
        
        // If existing user with complete profile, login directly
        if (existingUser) {
          const hasName = !!existingUser.displayName;
          const hasEmail = !!existingUser.email;

          if (hasName && hasEmail) {
            if (existingUser.role === 'admin') {
              router.push('/admin');
            } else {
              router.push(returnUrl);
            }
            return;
          }
        }
        
        // New or incomplete profile user - ask for name/email
        setPendingUser({
          uid: user.uid,
          email: user.email || existingUser?.email || null,
          phoneNumber: user.phoneNumber || existingUser?.phoneNumber || null,
          photoURL: user.photoURL || null,
        });
        setLoginMethod('phone');
        setStep('name');
      }
    } catch (error: unknown) {
      // Failed to verify OTP
       const errorMessage = error instanceof Error ? error.message : (t('login.invalid_code') || "Invalid verification code");
       setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    try {
      setError(null);
      
      if (!userName || userName.trim().length < 2) {
        setError(t('login.name_required') || 'Please enter your name (at least 2 characters)');
        return;
      }
      
      setLoading(true);
      
      if (loginMethod === 'email' && pendingUser && email) {
        // Create account with email using a temporary password
        // Note: User will need to set password later via password reset
        try {
          // Generate a secure random password
          const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!@#';
          
          const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
          const user = userCredential.user;
          
          // Create user profile
          await createUserProfile({
            uid: user.uid,
            email: user.email || null,
            displayName: userName.trim(),
            photoURL: null,
            phoneNumber: null,
            loginType: 'email',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            isAdmin: false,
          });
          
          // User is now logged in, redirect
          router.push(returnUrl);
        } catch (err: unknown) {
          const errorObj = err as { code?: string; message?: string };
          if (errorObj?.code === 'auth/email-already-in-use') {
            setError(t('login.email_exists') || 'This email is already registered. Please use email OTP to sign in.');
            setStep('email');
          } else {
            setError(errorObj?.message || 'Failed to create account');
          }
          setLoading(false);
        }
      } else if (loginMethod === 'phone' && pendingUser) {
        // User already authenticated via phone, just create profile
        try {
          // Demo mode: Just create Firestore profile without Firebase Auth user
          if (settings?.demoMode) {
            try {
              // In demo mode, create profile directly without Firebase Auth
              await createUserProfile({
                uid: pendingUser.uid,
                email: pendingUser.email || null,
                displayName: userName.trim(),
                photoURL: pendingUser.photoURL || null,
                phoneNumber: pendingUser.phoneNumber || null,
                loginType: 'phone',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                isAdmin: false,
              }, true); // Pass isDemoMode = true
              
              // Store demo user in localStorage
              const demoUserData = {
                uid: pendingUser.uid,
                phoneNumber: pendingUser.phoneNumber,
                displayName: userName.trim(),
              };
              if (typeof window !== 'undefined') {
                localStorage.setItem('pardah_demo_user', JSON.stringify(demoUserData));
              }
              
              // Small delay to ensure localStorage is saved and AuthContext can pick it up
              setTimeout(() => {
                window.location.href = returnUrl || '/';
              }, 200);
              return;
            } catch (profileError: unknown) {
              const errorObj = profileError as { message?: string; code?: string };
              setError(errorObj?.message || 'Failed to create account. Please try again.');
              setLoading(false);
              return;
            }
          }
          
          // Normal mode: Update Firebase Auth profile with displayName
          const currentUser = auth.currentUser;
          if (currentUser && userName.trim()) {
            await updateProfile(currentUser, { displayName: userName.trim() });
          }

          if (!currentUser) {
            throw new Error('Authenticated user not found');
          }

          const idToken = await currentUser.getIdToken(true);
          const response = await fetch('/api/auth/complete-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              displayName: userName.trim(),
              email: (nameStepEmail && nameStepEmail.trim()) || pendingUser.email || '',
              loginType: 'phone',
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to create profile');
          }

          if (result.role === 'admin') {
            router.push('/admin');
          } else {
            router.push(returnUrl);
          }
        } catch (profileError: unknown) {
          const errorObj = profileError as { message?: string; code?: string };
          setError(errorObj?.message || 'Failed to create profile');
          setLoading(false);
        }
      } else if (loginMethod === 'google' && pendingUser) {
        // User authenticated via Google, just update profile with confirmed name
        try {
          await createUserProfile({
            uid: pendingUser.uid,
            email: pendingUser.email || null,
            displayName: userName.trim(),
            photoURL: pendingUser.photoURL || null,
            phoneNumber: pendingUser.phoneNumber || null,
            loginType: 'google',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            isAdmin: false,
          });
          
          const dbUser = await getUserProfile(pendingUser.uid);
          if (dbUser?.role === 'admin') {
            router.push('/admin');
          } else {
            router.push(returnUrl);
          }
        } catch {
          // Profile might already exist, just redirect
          router.push(returnUrl);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete signup');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      
      // Check if account creation is enabled
      if (!isAccountCreationEnabled) {
        setError(t('login.account_creation_disabled') || "Account creation is currently disabled. Please contact support.");
        return;
      }
      
      if (loading) {
        return;
      }
      
      setLoading(true);
      const provider = new GoogleAuthProvider();
      
      // Add additional scopes if needed
      provider.addScope('profile');
      provider.addScope('email');

      // Try popup first (more reliable than redirect for localhost)
      // If popup fails, fallback to redirect
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if user profile exists
        let existingUser = null;
        try {
          existingUser = await getUserProfile(user.uid);
        } catch {
          // User doesn't exist or error fetching
        }
        
        // If existing user, login directly
        if (existingUser) {
          if (existingUser.role === 'admin') {
            router.push('/admin');
          } else {
            router.push(returnUrl);
          }
          setLoading(false);
          return;
        }
        
        // If user doesn't exist and account creation is disabled, block it
        if (!existingUser && !isAccountCreationEnabled) {
          setError(t('login.account_creation_disabled') || "Account creation is currently disabled. Please contact support.");
          setLoading(false);
          return;
        }
        
        // New Google user - create profile immediately
        await createUserProfile({
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          phoneNumber: user.phoneNumber || null,
          loginType: 'google',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          isAdmin: false,
        });
        
        router.push(returnUrl);
        setLoading(false);
        return;
        
      } catch (popupError: unknown) {
        const popupErrorObj = popupError as { code?: string; message?: string };
        
        // If popup is blocked or fails, fallback to redirect
        if (popupErrorObj?.code === 'auth/popup-blocked' || popupErrorObj?.code === 'auth/popup-closed-by-user') {
          // Use redirect instead of popup
          await signInWithRedirect(auth, provider);
          // Note: After signInWithRedirect, the page will redirect to Google
          // and then come back. The checkRedirectResult useEffect will handle the result.
          return;
        } else {
          // Re-throw other errors to be handled by outer catch
          throw popupError;
        }
      }
    } catch (err: unknown) {
      // Failed to sign in with Google
      const errorMessage = err instanceof Error ? err.message : (t('login.google_failed') || 'Failed to sign in with Google.');
      const errorObj = err as { code?: string; message?: string };
      console.error('Google sign-in failed:', {
        code: errorObj?.code,
        message: errorObj?.message || errorMessage,
      });
      
      // Handle specific error codes
      if (errorObj?.code === 'auth/popup-closed-by-user' || errorObj?.code === 'auth/cancelled-popup-request') {
        // User closed the popup, don't show error
        setError(null);
      } else if (errorObj?.code === 'auth/popup-blocked') {
        setError(t('login.popup_blocked') || 'Popup was blocked. Please allow popups for this site and try again.');
      } else if (errorObj?.code === 'auth/unauthorized-domain') {
        setError('Google login is not authorized for this domain yet. Add localhost to Firebase Authentication > Settings > Authorized domains.');
      } else if (errorObj?.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled in Firebase Authentication > Sign-in method.');
      } else if (errorMessage.includes('permissions') || errorObj?.code === 'permission-denied') {
        setError(t('login.permissions_error') || 'Unable to complete login due to permissions. Please contact support.');
      } else if (errorObj?.code === 'auth/account-exists-with-different-credential') {
        setError(t('login.account_exists') || 'An account already exists with the same email address but different sign-in credentials.');
      } else {
        setError(t('login.google_failed') || 'Failed to sign in with Google. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Demo Mode Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 md:p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-yellow-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-xl font-heading font-bold text-gray-900 text-center mb-3">
              Demo Mode
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Phone verification is disabled in demo mode. Use any 6-digit code to verify.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 text-center font-medium">
                Example: <span className="font-mono bg-white px-2 py-1 rounded border">123456</span>
              </p>
            </div>
            <button
              onClick={() => setShowDemoModal(false)}
              className="w-full bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Mobile Top - Image */}
      <div className="block lg:hidden w-full relative bg-gray-900 aspect-video max-h-[320px]">
        <Link
          href="/"
          className={`absolute top-4 ${isArabic ? 'left-4' : 'right-4'} z-20 text-xs font-semibold text-white/90 hover:text-white transition-colors bg-black/35 backdrop-blur px-3 py-2 rounded-full`}
        >
          {t('login.back_home') || 'Back to Home'}
        </Link>
        {settings?.theme?.loginImageUrl && (
          <Image
            src={settings?.theme?.loginImageUrl}
            alt="Login"
            fill
            priority
            fetchPriority="high"
            loading="eager"
            quality={80}
            sizes="100vw"
            className="object-contain opacity-95"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className={`p-6 text-white max-w-xl ${isArabic ? 'text-right' : 'text-left'}`}>
            <h2 className="text-2xl font-heading font-bold mb-2">
              {t('login.sidebar_title') || (isArabic ? 'ذهب بثقة' : 'Gold you can trust')}
            </h2>
            <p className="text-sm text-gray-200">
              {t('login.sidebar_description') ||
                (isArabic
                  ? 'تسوّق مجوهرات ذهبية أنيقة بتسعير واضح حسب العيار وخدمة موثوقة.'
                  : 'Shop elegant gold jewelry with transparent pricing by karat and reliable service.')}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Left Side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gray-900">
        {settings?.theme?.loginImageUrl && (
          <Image
            src={settings?.theme?.loginImageUrl}
            alt="Login"
            fill
            priority
            fetchPriority="high"
            loading="eager"
            quality={80}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className={`p-10 xl:p-12 text-white max-w-lg ${isArabic ? 'text-right' : 'text-left'}`}>
            <h2 className="text-3xl xl:text-4xl font-heading font-bold mb-3">
              {t('login.sidebar_title') || (isArabic ? 'ذهب بثقة' : 'Gold you can trust')}
            </h2>
            <p className="text-base xl:text-lg text-gray-200">
              {t('login.sidebar_description') ||
                (isArabic
                  ? 'تسوّق مجوهرات ذهبية أنيقة بتسعير واضح حسب العيار وخدمة موثوقة.'
                  : 'Shop elegant gold jewelry with transparent pricing by karat and reliable service.')}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-start justify-center pt-10 sm:pt-12 lg:pt-24 xl:pt-28 pb-10 px-6 sm:px-10 lg:px-16 relative min-h-0 lg:min-h-screen">
         <Link href="/" className="hidden lg:block absolute top-8 right-8 text-sm font-medium text-gray-500 hover:text-black transition-colors">
            {t('login.back_home') || 'Back to Home'}
         </Link>

        <div className={`w-full max-w-md ${isArabic ? 'text-right' : ''}`}>
          <div className={`${isArabic ? 'text-right' : 'text-center lg:text-left'} mb-4`}>
            <h1 className="text-4xl font-heading font-bold text-gray-900 tracking-tight mb-0.5">
              {step === 'phone' 
                ? (t('login.welcome_back') || 'Welcome Back')
                : step === 'email' || step === 'email-otp'
                ? (t('login.sign_in_email') || 'Sign In with Email')
                : step === 'otp'
                ? (t('login.verify_phone') || 'Verify Phone')
                : step === 'name' || step === 'google-name'
                ? (t('login.complete_profile') || 'Complete Your Profile')
                : (t('login.welcome_back') || 'Welcome Back')}
            </h1>
            <p className="text-gray-500 text-sm mb-0">
              {step === 'phone' 
                ? (t('login.enter_details') || 'Please enter your details to sign in.')
                : step === 'email'
                ? (t('login.enter_email_otp') || 'Enter your email to receive a verification code.')
                : step === 'email-otp'
                ? (t('login.enter_code_email') || 'Enter the verification code sent to your email.')
                : step === 'otp'
                ? (t('login.code_sent', { phone: String(phoneNumber) }) || `We sent a code to ${phoneNumber}. Please enter it below.`)
                : step === 'name'
                ? (t('login.enter_name_instruction') || 'Please enter your name to complete your profile.')
                : step === 'google-name'
                ? (t('login.confirm_name_instruction') || 'Please confirm your name to complete your profile.')
                : (t('login.enter_details') || 'Please enter your details to sign in.')}
            </p>
          </div>
          
          {/* Invisible reCAPTCHA container - hidden but required for Firebase */}
          <div id="recaptcha-container" className="absolute -left-[9999px] opacity-0 pointer-events-none"></div>

          {step === 'phone' ? (
            <div className="space-y-4">
              {/* Check if any login method is enabled */}
              {!enablePhoneLogin && !enableGoogleLogin && !enableEmailLogin ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                  {t('login.no_login_methods_enabled') || 'No login methods are enabled. Please contact administrator.'}
                </div>
              ) : (
                <>
                  {/* Phone Login Form - Only show if enabled */}
                  {enablePhoneLogin && (
                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handlePhoneLogin(); }}>
                      <div className="space-y-2">
                        <div className="phone-input-container">
                          <div className="saudi-phone-field">
                            <span className="saudi-phone-prefix" aria-hidden="true">
                              <Image src="/flags/sa.svg" alt="Saudi Arabia" width={24} height={18} className="saudi-flag-image" />
                            </span>
                            <input
                              type="tel"
                              inputMode="numeric"
                              autoComplete="tel-national"
                              value={getSaudiNationalNumber(phoneNumber)}
                              onChange={(e) => setPhoneNumber(buildSaudiPhoneNumber(e.target.value))}
                              className="PhoneInputInput placeholder-gray-400"
                              placeholder="5XXXXXXXX"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        style={{
                          backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
                          color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
                        }}
                        className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                      >
                        {loading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('login.sending_code') || 'Sending Code...'}
                          </span>
                        ) : (t('login.send_code') || 'Send Verification Code')}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          ) : step === 'email' ? (
            <div className="space-y-8">
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleEmailOtpSend(); }}>
                <div className="space-y-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={t('login.enter_email') || 'Enter your email address'}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
                    color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
                  }}
                  className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('login.sending_code') || 'Sending Code...'}
                    </span>
                  ) : (t('login.send_otp') || 'Send OTP')}
                </button>
              </form>
              
              {enablePhoneLogin && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      setStep('phone');
                      setError(null);
                      setEmail('');
                    }}
                    className="text-sm font-medium text-gray-500 hover:text-black transition-colors"
                  >
                    ← {t('login.switch_to_phone') || 'Use Phone Instead'}
                  </button>
                </div>
              )}

            </div>
          ) : step === 'email-otp' ? (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleEmailOtpVerify(); }}>
              <div className="space-y-2">
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">{t('login.verification_code') || 'Verification Code'}</label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-lg tracking-widest text-center"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                  }}
                />
                <p className="text-xs text-gray-500 text-center mt-2">
                  {t('login.code_instruction_email') || `Enter the 6-digit code sent to ${email}.`}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  style={{
                    backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
                    color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
                  }}
                  className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  {loading ? (t('login.verifying') || 'Verifying...') : (t('login.verify') || 'Verify')}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                    setOtp('');
                  }}
                  className="w-full py-3 text-sm font-medium text-gray-500 hover:text-black transition-colors"
                >
                  ← {t('login.change_email') || 'Change Email'}
                </button>
              </div>
            </form>
          ) : step === 'name' || step === 'google-name' ? (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleNameSubmit(); }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {step === 'google-name' ? (t('login.confirm_name') || 'Confirm Your Name') : (t('login.enter_name') || 'Enter Your Name')}
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoFocus
                    minLength={2}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={t('login.name_placeholder') || 'Your full name'}
                  />
                  <p className="text-xs text-gray-500">
                    {step === 'google-name'
                      ? (t('login.confirm_name_instruction') || 'Please confirm or edit your name.')
                      : (t('login.name_instruction') || 'This will be displayed on your profile.')}
                  </p>
                </div>

                {/* Optional email field (especially for phone login users) */}
                <div className="space-y-2">
                  <label htmlFor="name-step-email" className="block text-sm font-medium text-gray-700">
                    {t('login.optional_email_label') || 'Email (optional)'}
                  </label>
                  <input
                    id="name-step-email"
                    name="name-step-email"
                    type="email"
                    value={nameStepEmail}
                    onChange={(e) => setNameStepEmail(e.target.value)}
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={t('login.optional_email_placeholder') || 'Enter your email (optional)'}
                  />
                  <p className="text-xs text-gray-500">
                    {t('login.optional_email_help') || 'Add your email to receive order updates and login using email later.'}
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || userName.trim().length < 2}
                style={{
                  backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
                  color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
                }}
                className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('login.creating_account') || 'Creating Account...'}
                  </span>
                ) : (t('login.continue') || 'Continue')}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); verifyOtp(); }}>
               <div className="space-y-2">
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">{t('login.verification_code') || 'Verification Code'}</label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-lg tracking-widest text-center"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    // Only allow numbers
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                  }}
                />
                <p className="text-xs text-gray-500 text-center mt-2">
                    {t('login.code_instruction') || 'Enter the 6-digit code sent to your phone.'}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  style={{
                    backgroundColor: settings?.theme?.colors?.primaryButton || '#000000',
                    color: settings?.theme?.colors?.primaryButtonText || '#ffffff',
                  }}
                  className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  {loading ? (t('login.verifying') || 'Verifying...') : (t('login.verify_signin') || 'Verify & Sign In')}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                  }}
                  className="w-full py-3 text-sm font-medium text-gray-500 hover:text-black transition-colors"
                >
                  ← {t('login.change_phone') || 'Change Phone Number'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">
              {t('login.terms_agreement') || 'By signing in, you agree to our Terms of Service and Privacy Policy.'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Saudi phone input styles */}
      <style jsx global>{`
        .saudi-phone-field {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .saudi-phone-prefix {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding-right: 0.5rem;
          margin-right: 0.25rem;
          border-right: 1px solid #e5e7eb;
          min-width: 2rem;
        }
        .saudi-flag-image {
          width: 1.5rem;
          height: 1.125rem;
          object-fit: cover;
          border-radius: 2px;
          box-shadow: 0 0 1px rgba(0, 0, 0, 0.35);
        }
        .PhoneInputInput {
          flex: 1;
          min-width: 0;
          background-color: transparent;
          border: none;
          padding: 0;
          font-size: 1rem;
          line-height: 1.5rem;
          color: #111827;
        }
        .PhoneInputInput:focus {
          outline: none;
        }
        .phone-input-container {
            border: 1px solid #e5e7eb;
            border-radius: 0.75rem;
            padding: 0.875rem 1rem;
            transition: all 0.2s;
        }
        .phone-input-container:focus-within {
            border-color: #000;
            ring: 1px solid #000;
            box-shadow: 0 0 0 1px #000;
        }
      `}</style>
    </div>
  );
};

const LoginPage = () => {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-500">Loading Login...</p>
            </div>
        </div>
    }>
      <LoginForm />
    </Suspense>
  );
};

export default LoginPage;

