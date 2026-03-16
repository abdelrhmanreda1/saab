'use client';

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { UserAddress } from '@/lib/firestore/user_account';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LanguageContext } from '../../../context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';
import AccountMobileNav from '@/components/AccountMobileNav';

const AddressesPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);
  const { demoUser, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const { showError } = useToast();
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const fetchAddresses = useCallback(async (uid: string) => {
    try {
      if (settings?.demoMode && demoUser?.uid === uid) {
        setAddresses([]);
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be logged in to view addresses.');
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/account/addresses', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to fetch addresses');
      }

      setAddresses((result.addresses || []) as UserAddress[]);
    } catch {
      // Error fetching addresses
    } finally {
      setLoading(false);
    }
  }, [auth, demoUser?.uid, settings?.demoMode]);

  useEffect(() => {
    // Wait for AuthContext to finish loading
    if (authLoading) {
      return;
    }

    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      fetchAddresses(demoUser.uid);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchAddresses(currentUser.uid);
      } else {
        // Check for demo user before redirecting (re-check in case it was loaded after initial check)
        if (settings?.demoMode && demoUser) {
          setUser(null);
          fetchAddresses(demoUser.uid);
          return;
        } else {
          router.push('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [auth, router, fetchAddresses, settings?.demoMode, demoUser, authLoading]);

  const handleDelete = async (id: string) => {
    if (window.confirm(t('account.addresses.confirm_delete'))) {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('You must be logged in to delete an address.');
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/account/addresses/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Failed to delete address');
        }

        setAddresses(addresses.filter(addr => addr.id !== id));
      } catch (error) {
        const message = error instanceof Error ? error.message : t('account.addresses.delete_failed') || 'Failed to delete address.';
        showError(message);
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId) return;
    try {
      if (settings?.demoMode && demoUser) {
        throw new Error('Setting a default address is unavailable in demo mode.');
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be logged in to update addresses.');
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/account/addresses/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'set-default' }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to set default address');
      }

      await fetchAddresses(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('account.addresses.set_default_failed') || 'Failed to set default address.';
      showError(message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container">
            <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
          </div>
        </div>

        <div className="page-container pb-12">
          <AccountMobileNav />
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
              <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6">
                    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-6 md:py-12 mb-6 md:mb-10">
        <div className="page-container">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-heading font-bold text-gray-900 mb-2 text-center md:text-left">
            {t('account.title') || 'My Account'}
          </h1>
          <p className="text-sm md:text-base text-gray-500 text-center md:text-left">
            {t('account.addresses.subtitle') || 'Manage your shipping addresses.'}
          </p>
        </div>
      </div>

      <div className="page-container pb-12">
        <AccountMobileNav />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Sidebar / Navigation */}
          <div className="hidden md:block">
            <div className="bg-gray-50 rounded-xl p-4">
              <nav className="space-y-2">
                <Link href="/account/profile" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_profile')}
                </Link>
                <Link href="/account/orders" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_orders')}
                </Link>
                <Link href="/account/addresses" className="block px-4 py-2 bg-black text-white rounded-lg font-medium">
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

          {/* Right Column: Addresses Content */}
          <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-gray-900">
                {t('account.addresses.title') || 'My Addresses'}
              </h2>
              <Link
                href="/account/addresses/new"
                className="px-4 py-2 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors"
              >
                {t('account.addresses.add_new') || 'Add New'}
              </Link>
            </div>

            {addresses.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-300 mx-auto mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <p className="text-gray-500 mb-4">
                  {t('account.addresses.empty_title')}
                </p>
                <Link
                  href="/account/addresses/new"
                  className="inline-block bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
                >
                  {t('account.addresses.empty_cta')}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className={`bg-white p-6 rounded-2xl border-2 ${
                      address.isDefault ? 'border-black' : 'border-gray-100'
                    } shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{address.label}</h3>
                        {address.isDefault && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-black text-white text-xs font-semibold rounded">
                            {t('account.addresses.default_badge') || 'Default'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/account/addresses/edit/${address.id}`)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          {t('common.edit') || 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(address.id!)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          {t('common.delete') || 'Delete'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-gray-600 text-sm">
                      <p className="font-medium text-xs">{address.fullName}</p>
                      <p className="text-xs">{address.address}</p>
                      <p className="text-xs">{address.city}, {address.state} {address.zipCode}</p>
                      <p className="text-xs">{address.country}</p>
                      <p className="mt-2 text-xs">{address.phone}</p>
                    </div>
                    {!address.isDefault && (
                      <button
                        onClick={() => handleSetDefault(address.id!)}
                        className="mt-4 w-full py-2 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        {t('account.addresses.set_default') || 'Set as Default'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddressesPage;

