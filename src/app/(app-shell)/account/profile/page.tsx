'use client';

import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged, updateProfile, User, updateEmail, reauthenticateWithCredential, EmailAuthProvider, signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult, signOut } from 'firebase/auth';
import { app, storage } from '@/lib/firebase';
import { getUserProfile, UserProfile, updateUser, createUserProfile } from '@/lib/firestore/users';
import { Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AccountMobileNav from '@/components/AccountMobileNav';
import Image from 'next/image';
import WalletCard from '@/components/WalletCard';
import { LanguageContext } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import 'react-phone-number-input/style.css';
import { Value } from 'react-phone-number-input';
import dynamic from 'next/dynamic';

const PhoneInput = dynamic(() => import('react-phone-number-input'), { ssr: false });

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | undefined;
  }
}

const ProfilePage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const auth = getAuth(app);
  const { demoUser, loading: authLoading } = useAuth();
  const languageContext = useContext(LanguageContext);
  const { settings } = useSettings();
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );
  
  // Email change state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  
  // Phone change state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState<Value | undefined>(undefined);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneVerificationId, setPhoneVerificationId] = useState<ConfirmationResult | null>(null);
  const [changingPhone, setChangingPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  const [, setVisibleSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
        const profile = await getUserProfile(uid);
        if (profile) {
            setUserProfile(profile);
            return profile;
        }
        return null;
    } catch {
        // Error fetching user profile
        return null;
    }
  }, []);

  useEffect(() => {
    // Wait for AuthContext to finish loading
    if (authLoading) {
      return;
    }

    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      setDisplayName(demoUser.displayName || '');
      fetchUserProfile(demoUser.uid).then(() => {
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || '');
        const profile = await fetchUserProfile(currentUser.uid);

        // Agar Firebase Auth user hai lekin Firestore me profile nahi mili,
        // to yahan minimal profile auto-create kar do (taake DB me user save ho jaye).
        if (!profile) {
          try {
            const inferredLoginType: 'phone' | 'email' | 'google' | undefined =
              currentUser.phoneNumber && !currentUser.email
                ? 'phone'
                : currentUser.providerData.some((p) => p.providerId === 'google.com')
                ? 'google'
                : currentUser.email
                ? 'email'
                : undefined;

            await createUserProfile({
              uid: currentUser.uid,
              email: currentUser.email || null,
              // Agar displayName nahi hai to kam az kam phone ya email se kuch dikh jaye
              displayName: currentUser.displayName || currentUser.phoneNumber || currentUser.email || null,
              photoURL: currentUser.photoURL || null,
              phoneNumber: currentUser.phoneNumber || null,
              loginType: inferredLoginType,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: false,
            });

            const createdProfile = await getUserProfile(currentUser.uid);
            if (createdProfile) {
              setUserProfile(createdProfile);
            }
          } catch {
            // Agar profile create na bhi ho paye to page ko break na karo
          }
        }
      } else {
        // Check for demo user before redirecting (re-check in case it was loaded after initial check)
        if (settings?.demoMode && demoUser) {
          // Load profile for demo user
          setUser(null);
          setDisplayName(demoUser.displayName || '');
          fetchUserProfile(demoUser.uid).then(() => {
            setLoading(false);
          }).catch(() => {
            setLoading(false);
          });
          return;
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, fetchUserProfile, settings?.demoMode, demoUser, authLoading]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (userId) {
      setSaving(true);
      try {
        if (user) {
          await updateProfile(user, { displayName });
        }
        // Also update in Firestore
        await updateUser(userId, { displayName });
        setMessage(t('account.profile.update_success') || 'Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } catch {
        // Error updating profile
        setMessage(t('account.profile.update_failed') || 'Failed to update profile. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage(t('account.profile.image_invalid') || 'Please select a valid image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage(t('common.image_size_error') || 'Image size must be less than 5MB. Please compress the image and try again.');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!file || !userId) return;

    setUploading(true);
    setMessage('');

    try {
      // Delete old image if exists
      const currentPhotoURL = user?.photoURL || userProfile?.photoURL;
      if (currentPhotoURL && currentPhotoURL.includes('firebasestorage.googleapis.com')) {
        try {
          const oldImageRef = ref(storage, currentPhotoURL);
          await deleteObject(oldImageRef);
        } catch {
          // Ignore if old image doesn't exist
        }
      }

      // Upload new image
      const imageRef = ref(storage, `user-profiles/${userId}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);

      // Update Firebase Auth profile (only if user exists)
      if (user) {
        await updateProfile(user, { photoURL: downloadURL });
      }

      // Update Firestore user profile
      await updateUser(userId, { photoURL: downloadURL });

      // Refresh user data
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        setUser(updatedUser);
      }

      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setMessage(t('account.profile.image_upload_success') || 'Profile picture updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      setMessage(t('account.profile.image_upload_failed') || `Failed to upload image: ${errorObj?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    const photoURL = user?.photoURL || userProfile?.photoURL;
    if (!userId || !photoURL) return;

    setUploading(true);
    setMessage('');

    try {
      // Delete image from storage
      if (photoURL && photoURL.includes('firebasestorage.googleapis.com')) {
        try {
          const imageRef = ref(storage, photoURL);
          await deleteObject(imageRef);
        } catch {
          // Ignore if image doesn't exist
        }
      }

      // Update Firebase Auth profile (only if user exists)
      if (user) {
        await updateProfile(user, { photoURL: null });
      }

      // Update Firestore user profile
      await updateUser(userId, { photoURL: null });

      // Refresh user data
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        setUser(updatedUser);
      }

      setPreviewUrl(null);
      setMessage(t('account.profile.image_remove_success') || 'Profile picture removed successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      setMessage(t('account.profile.image_remove_failed') || `Failed to remove image: ${errorObj?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Email change/add handlers
  const handleEmailChange = async () => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId || !newEmail) {
      setMessage(t('account.profile.please_enter_email') || 'Please enter an email address');
      return;
    }

    const currentEmail = user?.email || userProfile?.email || '';
    const isAddingEmail = !currentEmail;

    // If adding email (no current email), no password needed
    // If changing email, password is required (only for Firebase Auth users)
    if (!isAddingEmail && !emailPassword && user) {
      setMessage(t('account.profile.please_enter_password') || 'Please enter your current password');
      return;
    }

    setChangingEmail(true);
    setMessage('');

    try {
      // Phone-only / no-current-email path: update Firestore from the server to avoid
      // local WebChannel write failures during localhost development.
      if (isAddingEmail && user) {
        const idToken = await user.getIdToken(true);
        const response = await fetch('/api/account/update-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ email: newEmail }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to add email');
        }

        await fetchUserProfile(userId);
        setShowEmailModal(false);
        setNewEmail('');
        setEmailPassword('');
        setMessage(t('account.profile.email_add_success') || 'Email added successfully!');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // If changing email (has current email), re-authenticate first (only for Firebase Auth users)
      if (!isAddingEmail && currentEmail && user) {
        const credential = EmailAuthProvider.credential(currentEmail, emailPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update email in Firebase Auth
        await updateEmail(user, newEmail);
      }

      // Update Firestore (always update Firestore, even if just adding)
      await updateUser(userId, { email: newEmail });

      // Refresh user data (only if Firebase Auth user exists)
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        setUser(updatedUser);
      }

      // Refresh profile
      await fetchUserProfile(userId);

      setShowEmailModal(false);
      setNewEmail('');
      setEmailPassword('');
      setMessage(isAddingEmail 
        ? (t('account.profile.email_add_success') || 'Email added successfully!')
        : (t('account.profile.email_update_success') || 'Email updated successfully!')
      );
      setTimeout(() => setMessage(''), 3000);
    } catch (error: unknown) {
      const errorObj = error as { message?: string; code?: string };
      if (errorObj?.code === 'auth/wrong-password') {
        setMessage(t('account.profile.incorrect_password') || 'Incorrect password. Please try again.');
      } else if (errorObj?.code === 'auth/email-already-in-use') {
        setMessage(t('account.profile.email_in_use') || 'This email is already in use.');
      } else if (errorObj?.code === 'auth/requires-recent-login') {
        setMessage(t('account.profile.requires_recent_login') || 'Please log out and log back in to change your email.');
      } else {
        setMessage(t('account.profile.email_update_failed') || `Failed to ${isAddingEmail ? 'add' : 'update'} email: ${errorObj?.message || 'Unknown error'}`);
      }
    } finally {
      setChangingEmail(false);
    }
  };

  // Phone change handlers
  const handlePhoneSendOtp = async () => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId || !newPhone) {
      setMessage(t('account.profile.please_enter_phone') || 'Please enter a valid phone number');
      return;
    }

    setChangingPhone(true);
    setMessage('');

    try {
      // Demo mode check - use mock OTP instead of real SMS
      if (settings?.demoMode) {
        // Mock verification - auto accept any OTP in demo mode
        const mockVerificationId: ConfirmationResult = {
          verificationId: 'demo-mock-verification-id',
          confirm: async (code: string) => {
            if (code && code.length === 6) {
              return {
                user: user,
                operationType: 'signIn' as const,
                providerId: 'phone',
              };
            }
            throw new Error('Invalid code');
          }
        } as ConfirmationResult;
        setPhoneVerificationId(mockVerificationId);
        setPhoneStep('otp');
        setMessage('Demo Mode: Use any 6-digit code (e.g., 123456) to verify');
        setTimeout(() => setMessage(''), 5000);
        setChangingPhone(false);
        return;
      }

      // Initialize reCAPTCHA
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'phone-recaptcha-container', {
          size: 'invisible',
          callback: () => {
            setChangingPhone(false);
          },
        });
      }

      const confirmationResult = await signInWithPhoneNumber(auth, newPhone as string, window.recaptchaVerifier);
      setPhoneVerificationId(confirmationResult);
      setPhoneStep('otp');
      setMessage(t('account.profile.otp_sent') || 'OTP sent to your phone number');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: unknown) {
      const errorObj = error as { message?: string; code?: string };
      if (errorObj?.code === 'auth/too-many-requests') {
        setMessage(t('account.profile.too_many_requests') || 'Too many requests. Please try again later.');
      } else {
        setMessage(`Failed to send OTP: ${errorObj?.message || 'Unknown error'}`);
      }
      
      // Clean up reCAPTCHA
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    } finally {
      setChangingPhone(false);
    }
  };

  const handlePhoneVerifyOtp = async () => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId || !phoneVerificationId || !phoneOtp) {
      setMessage(t('account.profile.please_enter_otp') || 'Please enter the OTP');
      return;
    }

    setChangingPhone(true);
    setMessage('');

    try {
      // Demo mode check - accept any 6-digit OTP
      if (settings?.demoMode && phoneVerificationId.verificationId === 'demo-mock-verification-id') {
        // Mock verification - just proceed with update
        await updateUser(userId, { phoneNumber: newPhone as string });
      } else if (user) {
        await phoneVerificationId.confirm(phoneOtp);
        
        // Update phone number in Firestore
        await updateUser(userId, { phoneNumber: newPhone as string });
      } else {
        throw new Error('User not authenticated');
      }

      // Refresh user data (both Firebase auth user and Firestore profile)
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        setUser(updatedUser);
      }
      await fetchUserProfile(userId);

      // If demo mode, also update demoUser in localStorage so header/profile icon reflect new phone
      if (settings?.demoMode && demoUser && typeof window !== 'undefined') {
        const updatedDemoUser = {
          uid: demoUser.uid,
          phoneNumber: newPhone as string,
          displayName: demoUser.displayName,
        };
        localStorage.setItem('pardah_demo_user', JSON.stringify(updatedDemoUser));
        window.dispatchEvent(new Event('demo-user-updated'));
      }

      // Clean up reCAPTCHA
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }

      setShowPhoneModal(false);
      setNewPhone(undefined);
      setPhoneOtp('');
      setPhoneVerificationId(null);
      setPhoneStep('phone');
      setMessage(t('account.profile.phone_update_success') || 'Phone number updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: unknown) {
      const errorObj = error as { message?: string; code?: string };
      if (errorObj?.code === 'auth/invalid-verification-code') {
        setMessage(t('account.profile.invalid_otp') || 'Invalid OTP. Please try again.');
      } else {
        setMessage(t('account.profile.phone_update_failed') || `Failed to update phone: ${errorObj?.message || 'Unknown error'}`);
      }
    } finally {
      setChangingPhone(false);
    }
  };

  // Intersection Observer for animations
  useEffect(() => {
    const allSections = document.querySelectorAll('[data-section-id]');
    const allSectionIds = Array.from(allSections).map(section => section.getAttribute('data-section-id')).filter(Boolean) as string[];
    if (allSectionIds.length > 0) {
      setVisibleSections(new Set(allSectionIds));
    }

    const observerOptions = {
      root: null,
      rootMargin: '-50px 0px',
      threshold: 0.1,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setVisibleSections((prev) => {
              if (prev.has(sectionId)) return prev;
              return new Set(prev).add(sectionId);
            });
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    const timeoutId = setTimeout(() => {
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => observer.observe(section));
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => observer.unobserve(section));
    };
  }, [loading]);

  if (loading) return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
        <div className="page-container">
          <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
        </div>
      </div>

      <div className="page-container pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sidebar Skeleton */}
          <div className="hidden md:block">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="md:col-span-2 space-y-6">
            {/* Wallet Card Skeleton */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm p-6">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* Profile Details Skeleton */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm p-6">
              <div className="h-7 bg-gray-200 rounded w-40 mb-6 animate-pulse" />
              
              {/* Profile Image & Info Skeleton */}
              <div className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex-grow space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
                  <div className="mt-4 flex gap-3">
                    <div className="h-9 bg-gray-200 rounded-lg w-32 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Form Skeleton */}
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
                <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex justify-end">
                  <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-6 md:py-12 mb-6 md:mb-10">
        <div className="page-container">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-heading font-bold text-gray-900 mb-2 text-center md:text-left">
            {t('account.profile.page_title') || 'My Profile'}
          </h1>
          <p className="text-sm md:text-base text-gray-500 text-center md:text-left">
            {t('account.profile.page_subtitle') || 'Manage your personal information and account settings.'}
          </p>
        </div>
      </div>

      <div className="page-container pb-12">
      
        {/* Mobile Navigation */}
        <AccountMobileNav />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {/* Left Column: Sidebar / Navigation */}
          <div className="hidden md:block">
            <div className="bg-gray-50 rounded-xl p-4">
              <nav className="space-y-2">
                <Link href="/account/profile" className="block px-4 py-2 bg-black text-white rounded-lg font-medium">
                  {t('account.nav_profile')}
                </Link>
                <Link href="/account/orders" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_orders')}
                </Link>
                <Link href="/account/addresses" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_addresses')}
                </Link>
                <Link href="/account/returns" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_returns')}
                </Link>
                <Link href="/account/refunds" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_refunds')}
                </Link>
                <Link href="/account/preferences" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_preferences')}
                </Link>
                <Link href="/wishlist" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_wishlist')}
                </Link>
              </nav>
            </div>
          </div>

          {/* Right Column: Content */}
          <div className="md:col-span-2">
            
            {/* Wallet Section */}
            {userProfile && (
              <div className="mb-6">
                <WalletCard 
                  uid={user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : '')}
                  walletBalance={userProfile.walletBalance || 0}
                  loyaltyPoints={userProfile.loyaltyPoints || 0}
                  onUpdate={() => {
                    const uid = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : '');
                    if (uid) fetchUserProfile(uid);
                  }}
                />
              </div>
            )}

            {/* Profile Details */}
            {(user || (settings?.demoMode && demoUser)) && (
                <div className="bg-white border border-gray-100 rounded-xl md:rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 md:p-6">
                    <h2 className="text-xl md:text-2xl font-heading font-bold mb-4 md:mb-6">
                      {t('account.profile.details_title') || 'Profile Details'}
                    </h2>
                    
                    <div className="mb-4 md:mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="relative">
                            <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                {(previewUrl || user?.photoURL || userProfile?.photoURL) ? (
                                    <Image 
                                    src={previewUrl || user?.photoURL || userProfile?.photoURL || ''} 
                                    alt="Profile" 
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={(e) => {
                                        // Handle Google profile picture rate limit or loading errors
                                        console.warn('Profile image failed to load, showing fallback');
                                        const target = e.target as HTMLImageElement;
                                        if (target) {
                                            target.style.display = 'none';
                                        }
                                        // Show fallback icon instead
                                        const parent = target?.parentElement;
                                        if (parent) {
                                            const fallback = document.createElement('div');
                                            fallback.className = 'absolute inset-0 flex items-center justify-center text-gray-300';
                                            fallback.innerHTML = `
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
                                                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                                                </svg>
                                            `;
                                            parent.appendChild(fallback);
                                        }
                                    }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                                        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-grow w-full">
                            <h3 className="font-medium text-sm md:text-base text-gray-900 mb-1">
                              {user?.displayName || userProfile?.displayName || demoUser?.displayName || t('account.profile.fallback_name') || 'User'}
                            </h3>
                            <div className="space-y-1.5">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <p className="text-xs text-gray-500 break-all">
                                  {(() => {
                                    const authEmail = user?.email;
                                    const profileEmail = userProfile?.email;
                                    return authEmail || profileEmail || (t('account.profile.no_email') || 'No email');
                                  })()}
                                </p>
                                <button
                                  onClick={() => setShowEmailModal(true)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors self-start sm:self-auto"
                                >
                                  {user?.email || userProfile?.email ? (t('account.profile.change') || 'Change') : (t('account.profile.add_email') || 'Add Email')}
                                </button>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <p className="text-xs text-gray-500 break-all">{user?.phoneNumber || userProfile?.phoneNumber || (t('account.profile.no_phone') || 'No phone number')}</p>
                                <button
                                  onClick={() => setShowPhoneModal(true)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors self-start sm:self-auto"
                                >
                                  {t('account.profile.change') || 'Change'}
                                </button>
                              </div>
                            </div>
                            
                            {/* Image Upload Controls */}
                            <div className="mt-4 flex flex-wrap gap-2 md:gap-3">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                    id="profile-image-upload"
                                />
                                <label
                                    htmlFor="profile-image-upload"
                                    className="inline-flex items-center px-3 md:px-4 py-2 text-xs md:text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    {t('account.profile.upload_image') || 'Upload Photo'}
                                </label>
                                {previewUrl && (
                                    <>
                                        <button
                                            onClick={handleImageUpload}
                                            disabled={uploading}
                                            className="px-3 md:px-4 py-2 text-xs md:text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                        >
                                            {uploading && (
                                              <svg
                                                className="animate-spin h-4 w-4"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                ></circle>
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                              </svg>
                                            )}
                                            {uploading ? (t('account.profile.uploading') || 'Uploading...') : (t('account.profile.save_image') || 'Save')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPreviewUrl(null);
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = '';
                                                }
                                            }}
                                            disabled={uploading}
                                            className="px-3 md:px-4 py-2 text-xs md:text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t('account.profile.cancel') || 'Cancel'}
                                        </button>
                                    </>
                                )}
                                {(user?.photoURL || userProfile?.photoURL) && !previewUrl && (
                                    <button
                                        onClick={handleRemoveImage}
                                        disabled={uploading}
                                        className="px-3 md:px-4 py-2 text-xs md:text-sm text-red-600 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t('account.profile.remove_image') || 'Remove'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-100">
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-900 mb-2">
                              {t('account.profile.display_name_label') || 'Display Name'}
                            </label>
                            <input 
                                type="text" 
                                value={displayName} 
                                onChange={(e) => setDisplayName(e.target.value)} 
                                className="w-full border border-gray-200 rounded-lg px-3 md:px-4 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent transition-all text-sm"
                                placeholder={t('account.profile.display_name_placeholder') || 'Enter your display name'}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button 
                                type="submit"
                                disabled={saving}
                                className="w-full sm:w-auto px-4 py-2 text-xs md:text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                                {saving && (
                                  <svg
                                    className="animate-spin h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                )}
                                {saving ? (t('account.profile.saving') || 'Saving...') : (t('account.profile.save') || 'Save Changes')}
                            </button>
                        </div>
                    </form>
                    {message && (
                        <div className={`mt-4 p-3 rounded-lg text-sm text-center ${
                          message.includes('success') 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                            {message}
                        </div>
                    )}
                    </div>
                  </div>
                </div>
            )}

            {/* Mobile Logout Button */}
            <div className="md:hidden mt-6">
              <button
                onClick={async () => {
                  try {
                    if (user) {
                      await signOut(auth);
                    }
                    // Clear demo user if exists
                    if (settings?.demoMode && demoUser) {
                      localStorage.removeItem('pardah_demo_user');
                      window.dispatchEvent(new Event('demo-user-updated'));
                    }
                    router.push('/');
                  } catch {
                    // Failed to logout
                  }
                }}
                className="w-full px-4 py-3 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                {t('account.logout') || t('common.logout') || 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Change/Add Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-gray-900">
                {user?.email || userProfile?.email ? (t('account.profile.change_email') || 'Change Email') : (t('account.profile.add_email') || 'Add Email')}
              </h2>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setNewEmail('');
                  setEmailPassword('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {(user?.email || userProfile?.email) && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t('account.profile.current_email') || 'Current Email'}</label>
                  <input
                    type="email"
                    value={user?.email || userProfile?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  {user?.email || userProfile?.email ? (t('account.profile.new_email') || 'New Email') : (t('account.profile.email_address') || 'Email Address')}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent transition-all text-sm"
                  placeholder={user?.email || userProfile?.email ? (t('account.profile.enter_new_email') || "Enter new email") : (t('account.profile.enter_your_email') || "Enter your email")}
                />
              </div>
              {(user?.email || userProfile?.email) && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t('account.profile.current_password') || 'Current Password'}</label>
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent transition-all text-sm"
                    placeholder={t('account.profile.enter_password') || "Enter your password"}
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setNewEmail('');
                    setEmailPassword('');
                  }}
                  className="px-4 py-2 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('account.profile.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleEmailChange}
                  disabled={changingEmail || !newEmail || (!!(user?.email || userProfile?.email) && !emailPassword)}
                  className="px-4 py-2 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {changingEmail && (
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {changingEmail 
                    ? (user?.email || userProfile?.email ? (t('account.profile.updating') || 'Updating...') : (t('account.profile.adding') || 'Adding...'))
                    : (user?.email || userProfile?.email ? (t('account.profile.update_email') || 'Update Email') : (t('account.profile.add_email') || 'Add Email'))
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phone Change Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-gray-900">{t('account.profile.change_phone') || 'Change Phone Number'}</h2>
              <button
                onClick={() => {
                  setShowPhoneModal(false);
                  setNewPhone(undefined);
                  setPhoneStep('phone');
                  setPhoneOtp('');
                  setPhoneVerificationId(null);
                  if (window.recaptchaVerifier) {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = undefined;
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div id="phone-recaptcha-container"></div>
            {phoneStep === 'phone' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t('account.profile.current_phone') || 'Current Phone'}</label>
                  <input
                    type="text"
                    value={user?.phoneNumber || userProfile?.phoneNumber || demoUser?.phoneNumber || (t('account.profile.no_phone') || 'No phone number')}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t('account.profile.new_phone') || 'New Phone Number'}</label>
                  <PhoneInput
                    international
                    defaultCountry="PK"
                    value={newPhone}
                    onChange={setNewPhone}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent transition-all text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowPhoneModal(false);
                      setNewPhone(undefined);
                      setPhoneStep('phone');
                      if (window.recaptchaVerifier) {
                        window.recaptchaVerifier.clear();
                        window.recaptchaVerifier = undefined;
                      }
                    }}
                    className="px-4 py-2 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('account.profile.cancel') || 'Cancel'}
                  </button>
                  <button
                    onClick={handlePhoneSendOtp}
                    disabled={changingPhone || !newPhone}
                    className="px-4 py-2 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {changingPhone && (
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {changingPhone ? (t('account.profile.sending') || 'Sending...') : (t('account.profile.send_otp') || 'Send OTP')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t('account.profile.enter_otp') || 'Enter OTP'}</label>
                  <input
                    type="text"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent transition-all text-sm text-center"
                    placeholder={t('account.profile.enter_otp_placeholder') || "000000"}
                    maxLength={6}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPhoneStep('phone');
                      setPhoneOtp('');
                      setPhoneVerificationId(null);
                    }}
                    className="px-4 py-2 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('account.profile.back') || 'Back'}
                  </button>
                  <button
                    onClick={handlePhoneVerifyOtp}
                    disabled={changingPhone || !phoneOtp || phoneOtp.length !== 6}
                    className="px-4 py-2 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {changingPhone && (
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {changingPhone ? (t('account.profile.verifying') || 'Verifying...') : (t('account.profile.verify_otp') || 'Verify OTP')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
