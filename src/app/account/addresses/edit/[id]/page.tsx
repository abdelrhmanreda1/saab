'use client';

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getCountries } from '@/lib/firestore/geography_db';
import { Country } from '@/lib/firestore/geography';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { LanguageContext } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';

const DEFAULT_COUNTRY: Country = {
  id: 'saudi-arabia',
  name: 'Saudi Arabia',
  isoCode: 'SA',
  phoneCode: '+966',
  currency: 'SAR',
  status: 'active',
};

const EditAddressPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const params = useParams();
  const addressId = params?.id as string;
  const auth = getAuth(app);
  const { demoUser } = useAuth();
  const { settings } = useSettings();
  const { showError } = useToast();
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const [address, setAddress] = useState({
    label: '',
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    isDefault: false,
  });

  const getAvailableCountries = (fetchedCountries: Country[]) => {
    const activeCountries = fetchedCountries.filter((country) => country.status === 'active');
    return activeCountries.length > 0 ? activeCountries : [DEFAULT_COUNTRY];
  };

  const fetchAddressFromApi = async (firebaseUser: User, id: string) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(`/api/account/addresses/${id}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to fetch address');
    }

    return result.address as typeof address;
  };

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      const loadData = async () => {
        try {
          const fetchedCountries = await getCountries();
          
          setCountries(getAvailableCountries(fetchedCountries));
          router.push('/account/addresses');
        } catch {
          // Error fetching data
          router.push('/account/addresses');
        }
        setLoading(false);
      };
      loadData();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const [fetchedAddress, fetchedCountries] = await Promise.all([
            fetchAddressFromApi(currentUser, addressId),
            getCountries(),
          ]);
          
          setAddress({
            label: fetchedAddress.label,
            fullName: fetchedAddress.fullName,
            phone: fetchedAddress.phone,
            address: fetchedAddress.address,
            city: fetchedAddress.city,
            state: fetchedAddress.state,
            zipCode: fetchedAddress.zipCode,
            country: fetchedAddress.country || DEFAULT_COUNTRY.name,
            isDefault: fetchedAddress.isDefault,
          });
          setCountries(getAvailableCountries(fetchedCountries));
        } catch {
          // Error fetching data
          router.push('/account/addresses');
        }
      } else {
        // Check for demo user before redirecting
        if (settings?.demoMode && demoUser) {
          // Demo user already loaded in first useEffect, load address
          const loadData = async () => {
            try {
              const fetchedCountries = await getCountries();
              setCountries(getAvailableCountries(fetchedCountries));
              router.push('/account/addresses');
            } catch {
              // Error fetching data
              router.push('/account/addresses');
            }
            setLoading(false);
          };
          loadData();
          return;
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, addressId, settings?.demoMode, demoUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setAddress(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId) return;

    setSaving(true);
    try {
      if (settings?.demoMode && demoUser) {
        throw new Error('Editing addresses is unavailable in demo mode.');
      }

      if (!user) {
        throw new Error('You must be logged in to update an address.');
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/account/addresses/${addressId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(address),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to update address');
      }

      router.push('/account/addresses');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update address.';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl py-12">
      <div className="mb-6">
        <Link
          href="/account/addresses"
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('account.addresses.back')}
        </Link>
      </div>

      <h1 className="text-4xl font-heading font-bold mb-8">
        {t('account.addresses.edit_title')}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('account.addresses.label')} *
          </label>
          <input
            type="text"
            name="label"
            value={address.label}
            onChange={handleChange}
            required
            placeholder={t('account.addresses.edit_placeholder') || "e.g., Home, Work, Office"}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('account.addresses.full_name')} *
          </label>
          <input
            type="text"
            name="fullName"
            value={address.fullName}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('account.addresses.phone')} *
          </label>
          <input
            type="tel"
            name="phone"
            value={address.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('account.addresses.street')} *
          </label>
          <input
            type="text"
            name="address"
            value={address.address}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('account.addresses.city')} *
            </label>
            <input
              type="text"
              name="city"
              value={address.city}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('account.addresses.state')} *
            </label>
            <input
              type="text"
              name="state"
              value={address.state}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('account.addresses.zip')}
            </label>
            <input
              type="text"
              name="zipCode"
              value={address.zipCode}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('account.addresses.country')} *
            </label>
            <select
              name="country"
              value={address.country}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">{DEFAULT_COUNTRY.name}</option>
              {countries.map(country => (
                <option key={country.id} value={country.name}>{country.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="isDefault"
            checked={address.isDefault}
            onChange={handleChange}
            className="w-5 h-5"
          />
          <label className="text-sm text-gray-700">
            {t('account.addresses.set_default_checkbox')}
          </label>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.push('/account/addresses')}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            {t('account.addresses.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
            {saving ? t('account.addresses.updating') || 'Updating...' : t('account.addresses.update') || 'Update Address'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditAddressPage;

