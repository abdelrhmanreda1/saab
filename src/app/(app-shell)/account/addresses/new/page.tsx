'use client';

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getCountries, getStates, getCities } from '@/lib/firestore/geography_db';
import { Country, State, City } from '@/lib/firestore/geography';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LanguageContext } from '../../../../context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';
import { validateRequired } from '@/lib/utils/validation';

const DEFAULT_COUNTRY: Country = {
  id: 'saudi-arabia',
  name: 'Saudi Arabia',
  isoCode: 'SA',
  phoneCode: '+966',
  currency: 'SAR',
  status: 'active',
};

const NewAddressPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
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
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: DEFAULT_COUNTRY.name,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const saveAddress = async () => {
    if (settings?.demoMode && demoUser) {
      throw new Error('Saving addresses is unavailable in demo mode.');
    }

    if (!user) {
      throw new Error('You must be logged in to save an address.');
    }

    const idToken = await user.getIdToken();
    const response = await fetch('/api/account/addresses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: address.label,
        fullName: user.displayName || user.email || '',
        phone: user.phoneNumber || '',
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        isDefault: false,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to save address');
    }

    return result.id as string;
  };

  const applyCountries = (fetchedCountries: Country[]) => {
    const activeCountries = fetchedCountries.filter(c => c.status === 'active');
    const availableCountries = activeCountries.length > 0 ? activeCountries : [DEFAULT_COUNTRY];
    setCountries(availableCountries);

    const saudiArabia =
      availableCountries.find((country) => country.isoCode === DEFAULT_COUNTRY.isoCode) ||
      availableCountries.find((country) => country.name === DEFAULT_COUNTRY.name) ||
      availableCountries[0];

    if (saudiArabia) {
      setSelectedCountryId(saudiArabia.id || '');
      setAddress(prev => ({
        ...prev,
        country: prev.country || saudiArabia.name,
      }));
    }
  };

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      const loadCountries = async () => {
        try {
          const fetchedCountries = await getCountries();
          applyCountries(fetchedCountries);
        } catch {
          applyCountries([]);
        }
        setLoading(false);
      };
      loadCountries();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const fetchedCountries = await getCountries();
          applyCountries(fetchedCountries);
        } catch {
          applyCountries([]);
        }
      } else {
        // Check for demo user before redirecting
        if (settings?.demoMode && demoUser) {
          // Demo user already loaded in first useEffect, load countries
          try {
            const fetchedCountries = await getCountries();
            applyCountries(fetchedCountries);
          } catch {
            applyCountries([]);
          }
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, settings?.demoMode, demoUser]);

  // Load states when country changes
  useEffect(() => {
    const loadStates = async () => {
      if (selectedCountryId) {
        try {
          const fetchedStates = await getStates(selectedCountryId);
          setStates(fetchedStates.filter(s => s.status === 'active'));
          // Reset state and city when country changes
          setSelectedStateId('');
          setCities([]);
          setAddress(prev => ({ ...prev, state: '', city: '' }));
        } catch {
          // Error loading states
          setStates([]);
        }
      } else {
        setStates([]);
        setCities([]);
      }
    };
    loadStates();
  }, [selectedCountryId]);

  // Load cities when state changes
  useEffect(() => {
    const loadCities = async () => {
      if (selectedStateId) {
        try {
          const fetchedCities = await getCities(selectedStateId);
          setCities(fetchedCities.filter(c => c.status === 'active'));
          // Reset city when state changes
          setAddress(prev => ({ ...prev, city: '' }));
        } catch {
          // Error loading cities
          setCities([]);
        }
      } else {
        setCities([]);
      }
    };
    loadCities();
  }, [selectedStateId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    
    if (name === 'country') {
      const selectedCountry = countries.find(c => c.name === value);
      if (selectedCountry) {
        setSelectedCountryId(selectedCountry.id || '');
        setAddress(prev => ({ ...prev, country: value, state: '', city: '' }));
      }
    } else if (name === 'state') {
      const selectedState = states.find(s => s.name === value);
      if (selectedState) {
        setSelectedStateId(selectedState.id || '');
        setAddress(prev => ({ ...prev, state: value, city: '' }));
      } else {
        setSelectedStateId('');
        setAddress(prev => ({ ...prev, state: value }));
      }
    } else if (name === 'city') {
      setAddress(prev => ({ ...prev, city: value }));
    } else {
      setAddress(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched({ ...touched, [name]: true });
    
    // Validate required fields
    if (name === 'address' || name === 'city' || name === 'country') {
      const result = validateRequired(value, name.charAt(0).toUpperCase() + name.slice(1));
      if (!result.isValid) {
        setErrors({ ...errors, [name]: result.error || '' });
      } else {
        setErrors({ ...errors, [name]: '' });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId) return;

    // Validate required fields
    const newErrors: Record<string, string> = {};
    const addressResult = validateRequired(address.address, 'Address');
    if (!addressResult.isValid) newErrors.address = addressResult.error || '';
    
    const cityResult = validateRequired(address.city, 'City');
    if (!cityResult.isValid) newErrors.city = cityResult.error || '';
    
    const countryResult = validateRequired(address.country, 'Country');
    if (!countryResult.isValid) newErrors.country = countryResult.error || '';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ address: true, city: true, country: true });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await saveAddress();
      router.push('/account/addresses');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('account.addresses.add_failed') || 'Failed to add address.';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-2 w-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {t('account.addresses.new_title')}
          </h1>
          <p className="text-gray-500">
            {t('account.addresses.new_subtitle')}
          </p>
        </div>
      </div>

      <div className="page-container max-w-2xl">
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
              placeholder={t('account.addresses.label_placeholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
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
              onBlur={handleBlur}
              placeholder={t('account.addresses.street_placeholder')}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none transition-all ${
                touched.address && errors.address ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-black'
              }`}
            />
            {touched.address && errors.address && (
              <p className="mt-1 text-xs text-red-600">{errors.address}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('account.addresses.city')} *
              </label>
              {cities.length > 0 ? (
                <>
                  <select
                    name="city"
                    value={address.city}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none transition-all ${
                      touched.city && errors.city ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-black'
                    }`}
                  >
                    <option value="">
                      {t('account.addresses.city_select_placeholder')}
                    </option>
                    {cities.map(city => (
                      <option key={city.id} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                  {touched.city && errors.city && (
                    <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    name="city"
                    value={address.city}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={t('account.addresses.city_placeholder')}
                    disabled={!selectedCountryId}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      touched.city && errors.city ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-black'
                    }`}
                  />
                  {touched.city && errors.city && (
                    <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('account.addresses.state')} *
              </label>
              {states.length > 0 ? (
                <select
                  name="state"
                  value={address.state}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                >
                  <option value="">
                    {t('account.addresses.state_select_placeholder')}
                  </option>
                  {states.map(state => (
                    <option key={state.id} value={state.name}>{state.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="state"
                  value={address.state}
                  onChange={handleChange}
                  required
                  placeholder={t('account.addresses.state_placeholder')}
                  disabled={selectedCountryId ? false : true}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              )}
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
                placeholder={t('account.addresses.zip_placeholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
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
                onBlur={handleBlur}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none transition-all ${
                  touched.country && errors.country ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-black'
                }`}
              >
                <option value="">Select Country</option>
                {countries.map(country => (
                  <option key={country.id} value={country.name}>{country.name}</option>
                ))}
              </select>
              {touched.country && errors.country && (
                <p className="mt-1 text-xs text-red-600">{errors.country}</p>
              )}
            </div>
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
              {saving ? t('account.addresses.saving') || 'Saving...' : t('account.addresses.save') || 'Save Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewAddressPage;

