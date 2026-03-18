'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Link from 'next/link';
import Image from 'next/image';
import { OrderStatus, OrderItem, Order } from '@/lib/firestore/orders';
// Note: Old payment components are kept for backward compatibility but not used in provider-based flow
// Stripe now uses provider-based pattern (order create → redirect → success)
// import PayPalPayment from '../../components/PaymentOptions/PayPalPayment';
// import RazorpayPayment from '../../components/PaymentOptions/RazorpayPayment';
// import FlutterwavePayment from '../../components/PaymentOptions/FlutterwavePayment';
// const PaystackPayment = dynamic(() => import('../../components/PaymentOptions/PaystackPayment'), { 
//   ssr: false 
// });
import { getCouponByCode, getUserCouponUsage } from '@/lib/firestore/coupons';
import { calculateTaxes } from '@/lib/utils/tax';
import { getAllLocalPaymentMethods } from '@/lib/firestore/internationalization_db';
import { LocalPaymentMethod } from '@/lib/firestore/internationalization';
import LocalPaymentMethodComponent from '../../components/PaymentOptions/LocalPaymentMethod';
import { getAllPaymentGateways } from '@/lib/firestore/payment_gateways_db';
import { PaymentGateway } from '@/lib/firestore/payment_gateways';
import { getAllFreeShippingRules, getAllFlashSales } from '@/lib/firestore/campaigns_db';
import { FreeShippingRule, FlashSale } from '@/lib/firestore/campaigns';
import { createUserProfile, getUserProfile, UserProfile } from '@/lib/firestore/users';
import { Timestamp } from 'firebase/firestore';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { Settings } from '@/lib/firestore/settings';
import { getSettings } from '@/lib/firestore/settings_db';
import { getUserAddresses } from '@/lib/firestore/user_account_db';
import { UserAddress } from '@/lib/firestore/user_account';
import { getCountries, getStates, getCities } from '@/lib/firestore/geography_db';
import { Country, State, City } from '@/lib/firestore/geography';
import { getAllShippingZones, getAllShippingRates, calculateShippingCost } from '@/lib/firestore/shipping_db';
import { ShippingZone, ShippingRate } from '@/lib/firestore/shipping';
import { useLanguage } from '../../context/LanguageContext';
import { getProductPriceWithVariant } from '@/lib/utils/product-pricing';
import { isGoldPricedProduct } from '@/lib/utils/gold-pricing';
import {
  getAuth,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  updateProfile,
  linkWithPhoneNumber,
} from 'firebase/auth';
import { app } from '@/lib/firebase';
import Dialog from '../../components/ui/Dialog';
const FALLBACK_WHATSAPP_ORDER_NUMBER = '201062915367';
const SAUDI_ONLY_FALLBACK_COUNTRY: Country = {
  id: 'fallback-sa',
  name: 'Saudi Arabia',
  isoCode: 'SA',
  phoneCode: '+966',
  currency: 'SAR',
  status: 'active',
};
const SAUDI_COUNTRY_NAME = SAUDI_ONLY_FALLBACK_COUNTRY.name;
const normalizeLocationValue = (value?: string | null) => (value || '').trim().toLowerCase();
const SAUDI_DIAL_CODE = '+966';
const getSaudiNationalNumber = (phone?: string) => {
  if (!phone) return '';
  return phone.startsWith(SAUDI_DIAL_CODE) ? phone.slice(SAUDI_DIAL_CODE.length) : phone.replace(/^\+?966/, '');
};
const buildSaudiPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${SAUDI_DIAL_CODE}${digits}` : '';
};

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | undefined;
  }
}

// Stripe will be loaded dynamically from database when gateway is selected

const CheckoutPage = () => {
  const { cart, getCartTotal, clearCart } = useCart();
  const { formatPrice, defaultCurrency } = useCurrency();
  const { user, demoUser } = useAuth();
  const { settings: authSettings } = useSettings();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: '',
    email: '',
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [, setShippingZones] = useState<ShippingZone[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedShippingRate, setSelectedShippingRate] = useState<ShippingRate | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'stripe' | string>('cod');
  const [localPaymentMethods, setLocalPaymentMethods] = useState<LocalPaymentMethod[]>([]);
  const [selectedLocalPaymentMethod, setSelectedLocalPaymentMethod] = useState<LocalPaymentMethod | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedPaymentGateway, setSelectedPaymentGateway] = useState<PaymentGateway | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [confirmedLocalPaymentMethod, setConfirmedLocalPaymentMethod] = useState<LocalPaymentMethod | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [, setUserProfile] = useState<UserProfile | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  // Phone Verification State
  const initialPhone = user?.phoneNumber || (authSettings?.demoMode && demoUser ? demoUser.phoneNumber : undefined);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(!!initialPhone);
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  // Store original logged-in user UID before phone verification (to prevent duplicate profiles)
  // Use ref to ensure we have the value immediately (state updates are async)
  const originalLoggedInUserIdRef = useRef<string | null>(null);
  const [originalLoggedInUserId, setOriginalLoggedInUserId] = useState<string | null>(null);
  
  // Dialog states
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogTitle, setInfoDialogTitle] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'info' | 'success' | 'error' | 'warning'>('info');

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; type: 'percentage' | 'fixed' } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // Tax State
  const [taxAmount, setTaxAmount] = useState(0);
  const [taxBreakdown, setTaxBreakdown] = useState<Array<{ taxRate: { id?: string; name: string; rate: number; type: string }; amount: number }>>([]);
  
  // Free Shipping State
  const [freeShippingRule, setFreeShippingRule] = useState<FreeShippingRule | null>(null);
  
  // Products state for price recalculation
  const [products, setProducts] = useState<Product[]>([]);
  // Flash sales state
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const getCurrentAuthUser = () => getAuth(app).currentUser || user;
  const getWhatsAppOrderNumber = () => {
    const rawNumber = settings?.company?.phone || FALLBACK_WHATSAPP_ORDER_NUMBER;
    return rawNumber.replace(/\D/g, '');
  };
  const detectPreferredCountry = () => {
    return 'SA';
  };
  const fetchCurrentAccountProfile = async () => {
    const currentAuthUser = getCurrentAuthUser();
    if (!currentAuthUser) {
      return null;
    }

    try {
      const idToken = await currentAuthUser.getIdToken();
      const response = await fetch('/api/account/profile', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data?.profile || null;
    } catch {
      return null;
    }
  };
  
  // Load products and flash sales for price recalculation
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedProducts, fetchedFlashSales] = await Promise.all([
          getAllProducts(),
          getAllFlashSales(true) // activeOnly = true
        ]);
        setProducts(fetchedProducts);
        setFlashSales(fetchedFlashSales);
      } catch {
        // Failed to load data
        setProducts([]);
        setFlashSales([]);
      }
    };
    loadData();
  }, []);
  
  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const fetchedCountries = await getCountries();
        const activeCountries = fetchedCountries.filter(c => c.status === 'active');
        const saudiCountries = activeCountries.filter(country =>
          country.isoCode?.toUpperCase() === 'SA' ||
          normalizeLocationValue(country.name) === normalizeLocationValue(SAUDI_COUNTRY_NAME)
        );
        const finalCountries = saudiCountries.length > 0 ? saudiCountries : [SAUDI_ONLY_FALLBACK_COUNTRY];
        setCountries(finalCountries);
      } catch {
        // Failed to load countries
        setCountries([SAUDI_ONLY_FALLBACK_COUNTRY]);
        setSelectedCountryId('');
      }
    };
    loadCountries();
  }, []);

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
          setShippingInfo(prev => ({ ...prev, state: '', city: '' }));
        } catch {
          // Failed to load states
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
          setShippingInfo(prev => ({ ...prev, city: '' }));
          setSelectedCityId('');
          
          // If we have a saved city name, try to find and set its ID
          if (shippingInfo.city && fetchedCities.length > 0) {
            const matchingCity = fetchedCities.find(c => c.name === shippingInfo.city);
            if (matchingCity?.id) {
              setSelectedCityId(matchingCity.id);
            }
          }
        } catch {
          // Failed to load cities
          setCities([]);
        }
      } else {
        setCities([]);
      }
    };
    loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStateId]);

  // Load shipping zones and rates when country/state/city changes
  useEffect(() => {
    const loadShippingOptions = async () => {
      if (!selectedCountryId && !shippingInfo.country) return;
      
      try {
        const zones = await getAllShippingZones(true);
        
        // Find zone that matches - prioritize city > state > country
        // More specific zones (with city/state) should be matched first
        const matchingZones = zones.filter(zone => {
          const countryName = shippingInfo.country;
          const countryId = selectedCountryId;
          const stateName = shippingInfo.state;
          const stateId = selectedStateId;
          const cityName = shippingInfo.city;
          const normalizedCountryName = normalizeLocationValue(countryName);
          const normalizedStateName = normalizeLocationValue(stateName);
          const normalizedCityName = normalizeLocationValue(cityName);
          
          // Check country match
          const countryMatch = zone.countries.some(countryValue => {
            const normalizedZoneCountry = normalizeLocationValue(countryValue);
            const matchedCountry = countries.find(country =>
              country.id === countryValue ||
              normalizeLocationValue(country.name) === normalizedZoneCountry ||
              normalizeLocationValue(country.isoCode) === normalizedZoneCountry
            );

            return (
              countryValue === countryId ||
              normalizedZoneCountry === normalizedCountryName ||
              normalizeLocationValue(matchedCountry?.name) === normalizedCountryName ||
              normalizeLocationValue(matchedCountry?.isoCode) === normalizedCountryName
            );
          });
          
          if (!countryMatch) return false;
          
          // If zone has specific states, check state match
          if (zone.states && zone.states.length > 0) {
            if (!stateId && !stateName) return false;
            const stateMatch = zone.states.some(stateValue => {
              const normalizedZoneState = normalizeLocationValue(stateValue);
              const matchedState = states.find(state =>
                state.id === stateValue || normalizeLocationValue(state.name) === normalizedZoneState
              );

              return (
                stateValue === stateId ||
                normalizedZoneState === normalizedStateName ||
                normalizeLocationValue(matchedState?.name) === normalizedStateName
              );
            });
            if (!stateMatch) return false;
          }
          
          // If zone has specific cities, check city match
          if (zone.cities && zone.cities.length > 0) {
            if (!cityName) return false;
            const cityMatch = zone.cities.some(cityValue => {
              const normalizedZoneCity = normalizeLocationValue(cityValue);
              const matchedCity = cities.find(city =>
                city.id === cityValue || normalizeLocationValue(city.name) === normalizedZoneCity
              );

              return (
                normalizedZoneCity === normalizedCityName ||
                normalizeLocationValue(matchedCity?.name) === normalizedCityName
              );
            });
            if (!cityMatch) return false;
          }
          
          return true;
        });
        
        // Sort by specificity: city-specific > state-specific > country-only
        matchingZones.sort((a, b) => {
          const aSpecificity = (a.cities?.length || 0) * 3 + (a.states?.length || 0) * 2 + (a.countries?.length || 0);
          const bSpecificity = (b.cities?.length || 0) * 3 + (b.states?.length || 0) * 2 + (b.countries?.length || 0);
          return bSpecificity - aSpecificity; // More specific first
        });
        
        const matchingZone = matchingZones[0]; // Get the most specific match
        
        if (matchingZone?.id) {
          setShippingZones([matchingZone]);
          const rates = await getAllShippingRates(matchingZone.id, true);
          setShippingRates(rates);
          
          // Auto-select first rate if available
          if (rates.length > 0 && !selectedShippingRate) {
            const firstRate = rates[0];
            setSelectedShippingRate(firstRate);
            
            // Calculate shipping cost
            const cartTotal = getCartTotal();
            const cartWeight = cart.reduce((sum, item) => sum + 0.5 * item.quantity, 0);
            const result = await calculateShippingCost(matchingZone.id, cartWeight, cartTotal);
            setShippingCost(result.cost);
          }
        } else {
          setShippingZones([]);
          setShippingRates([]);
          setSelectedShippingRate(null);
          setShippingCost(0);
        }
      } catch {
        // Failed to load shipping options
        setShippingZones([]);
        setShippingRates([]);
        setSelectedShippingRate(null);
        setShippingCost(0);
      }
    };
    
    loadShippingOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryId, selectedStateId, shippingInfo.country, shippingInfo.state, shippingInfo.city, countries, states, cities]);

  // Load local payment methods, gateways, and free shipping rules
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const [methods, gateways, rules] = await Promise.all([
          getAllLocalPaymentMethods(true, shippingInfo.state || 'PK').catch((err: unknown) => {
            // Failed to load local payment methods
            // If permissions error, return empty array gracefully
            const errorObj = err as { message?: string; code?: string };
            if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
              // Permission denied for local payment methods. Continuing without them.
            }
            return [];
          }),
          getAllPaymentGateways(true, shippingInfo.state || 'PK').catch((err: unknown) => {
            // Failed to load payment gateways
            // If permissions error, return empty array gracefully
            const errorObj = err as { message?: string; code?: string };
            if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
              // Permission denied for payment gateways. Continuing without them.
            }
            return [];
          }),
          getAllFreeShippingRules(true).catch((err: unknown) => {
            // Failed to load free shipping rules
            // If permissions error, return empty array gracefully
            const errorObj = err as { message?: string; code?: string };
            if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
              // Permission denied for free shipping rules. Continuing without them.
            }
            return [];
          })
        ]);
        setLocalPaymentMethods(methods);
        setPaymentGateways(gateways);
        // Use the rule with the lowest threshold (first one since they're ordered by threshold asc)
        if (rules.length > 0) {
          setFreeShippingRule(rules[0]);
        }
      } catch (error: unknown) {
        // Failed to load payment methods
        // Set empty arrays on error to prevent UI issues
        setLocalPaymentMethods([]);
        setPaymentGateways([]);
        // Check if it's a permissions error
        const errorObj = error as { message?: string; code?: string };
        if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
        // Permission denied for payment methods. Continuing with default payment options.
        }
      }
    };
    loadPaymentMethods();
  }, [shippingInfo.state]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingInfo((prevInfo) => ({ ...prevInfo, [name]: value }));
  };

  const nextStep = () => {
    // Check if phone verification is required and not completed
    if (currentStep === 1 && authSettings?.site?.enablePhoneVerification) {
      const userPhone = user?.phoneNumber || (authSettings?.demoMode && demoUser ? demoUser.phoneNumber : null);
      if (!isPhoneVerified && !userPhone && !shippingInfo.phone) {
        setInfoDialogTitle(t('checkout.error') || 'Error');
        setInfoDialogMessage(t('checkout.phone_verification_required') || 'Phone verification is required to continue.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        return;
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Helper function to load and set state/city IDs from address
  const loadStateAndCityIds = async (address: { country?: string; state?: string; city?: string }) => {
    if (address.country && countries.length > 0) {
      // Match by full name OR ISO code for robustness
      const country = countries.find(
        c => c.name === address.country || c.isoCode === address.country
      );
      if (country?.id) {
        setSelectedCountryId(country.id);
        
        // Load states for the selected country
        try {
          const fetchedStates = await getStates(country.id);
          const activeStates = fetchedStates.filter(s => s.status === 'active');
          setStates(activeStates);
          
          // Find and set state ID (and sync shippingInfo.state)
          if (address.state && activeStates.length > 0) {
            const matchingState = activeStates.find(s => s.name === address.state);
            if (matchingState?.id) {
              setSelectedStateId(matchingState.id);
              setShippingInfo(prev => ({
                ...prev,
                state: matchingState.name,
              }));
              
              // Load cities for the selected state
              try {
                const fetchedCities = await getCities(matchingState.id);
                const activeCities = fetchedCities.filter(c => c.status === 'active');
                setCities(activeCities);
                
                // Find and set city ID (and sync shippingInfo.city)
                if (address.city && activeCities.length > 0) {
                  const matchingCity = activeCities.find(c => c.name === address.city);
                  if (matchingCity?.id) {
                    setSelectedCityId(matchingCity.id);
                    setShippingInfo(prev => ({
                      ...prev,
                      city: matchingCity.name,
                    }));
                  }
                }
              } catch {
                // Failed to load cities
                setCities([]);
              }
            }
          }
        } catch {
          // Failed to load states
          setStates([]);
        }
      }
    }
  };

  // Handle address selection from saved addresses
  const handleAddressSelect = async (addressId: string) => {
    const selectedAddress = savedAddresses.find(addr => addr.id === addressId);
    if (selectedAddress) {
      setSelectedAddressId(addressId);
      setShippingInfo(prev => ({
        ...prev,
        fullName: selectedAddress.fullName,
        phone: selectedAddress.phone,
        address: selectedAddress.address,
        city: selectedAddress.city,
        state: selectedAddress.state,
        zipCode: selectedAddress.zipCode,
        country: SAUDI_COUNTRY_NAME,
      }));
      
      // Load state and city IDs
      await loadStateAndCityIds(selectedAddress);
    }
  };

  // Ensure default / selected saved address correctly loads country/state/city once countries are available
  useEffect(() => {
    if (!shippingInfo.country || countries.length === 0) return;

    const sourceAddress =
      (selectedAddressId && savedAddresses.find(addr => addr.id === selectedAddressId)) || {
        country: shippingInfo.country,
        state: shippingInfo.state,
        city: shippingInfo.city,
      };

    if (sourceAddress && sourceAddress.country) {
      // Fire and forget; errors are handled inside loadStateAndCityIds
      void loadStateAndCityIds(sourceAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, selectedAddressId, shippingInfo.country, shippingInfo.state, shippingInfo.city, savedAddresses]);

  // Load user profile and populate shipping info when user is logged in
  useEffect(() => {
    const loadUserProfile = async () => {
      const userId = user?.uid || (authSettings?.demoMode && demoUser ? demoUser.uid : null);
      const currentAuthUser = getCurrentAuthUser();
      if (userId) {
        try {
          const [fetchedUserProfile, fetchedSettings, fetchedAddresses] = await Promise.all([
            getUserProfile(userId),
            getSettings(),
            getUserAddresses(userId).catch(() => []) // Load saved addresses
          ]);
          
          if (fetchedUserProfile) {
            setUserProfile(fetchedUserProfile);
            setWalletBalance(fetchedUserProfile.walletBalance || 0);
            // Populate shipping info from user profile
            setShippingInfo(prev => ({
              ...prev,
              fullName: fetchedUserProfile.displayName || currentAuthUser?.displayName || demoUser?.displayName || prev.fullName || '',
              email: fetchedUserProfile.email || currentAuthUser?.email || prev.email || '',
              phone: fetchedUserProfile.phoneNumber || currentAuthUser?.phoneNumber || demoUser?.phoneNumber || prev.phone || '',
              // If user has saved address, populate it
              address: fetchedUserProfile.address?.street || prev.address || '',
              city: fetchedUserProfile.address?.city || prev.city || '',
              state: fetchedUserProfile.address?.state || prev.state || '',
              zipCode: fetchedUserProfile.address?.zipCode || prev.zipCode || '',
              country: prev.country || SAUDI_COUNTRY_NAME,
            }));
            // Try to find and set country/state IDs if available
            if (countries.length > 0) {
              const country = countries.find(c => c.isoCode?.toUpperCase() === 'SA');
              if (country?.id) {
                setSelectedCountryId(country.id);
              }
            }
          } else {
            // Fallback to Firebase Auth data if profile doesn't exist
            setShippingInfo(prev => ({
              ...prev,
              fullName: currentAuthUser?.displayName || prev.fullName || '',
              email: currentAuthUser?.email || prev.email || '',
              phone: currentAuthUser?.phoneNumber || prev.phone || '',
            }));
          }
          
          // Set saved addresses
          if (fetchedAddresses && fetchedAddresses.length > 0) {
            setSavedAddresses(fetchedAddresses);
            // Auto-select default address if available
            const defaultAddress = fetchedAddresses.find(addr => addr.isDefault);
            if (defaultAddress && defaultAddress.id) {
              // Directly set the address info instead of calling handleAddressSelect
              setSelectedAddressId(defaultAddress.id);
              setShippingInfo(prev => ({
                ...prev,
                fullName: defaultAddress.fullName,
                phone: defaultAddress.phone,
                address: defaultAddress.address,
                city: defaultAddress.city,
                state: defaultAddress.state,
                zipCode: defaultAddress.zipCode,
                country: SAUDI_COUNTRY_NAME,
              }));
              // Load state and city IDs
              loadStateAndCityIds(defaultAddress);
            }
          }
          
          if (fetchedSettings) {
            setSettings(fetchedSettings);
          }
        } catch {
          // Failed to load user profile or settings
          // Fallback to Firebase Auth data on error
          setShippingInfo(prev => ({
            ...prev,
            fullName: currentAuthUser?.displayName || prev.fullName || '',
            email: currentAuthUser?.email || prev.email || '',
            phone: currentAuthUser?.phoneNumber || prev.phone || '',
          }));
        }
      }
    };

    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, demoUser, authSettings?.demoMode, countries]);

  useEffect(() => {
    const currentAuthUser = getCurrentAuthUser();
    if (currentAuthUser?.email && !shippingInfo.email) {
      setShippingInfo(prev => ({
        ...prev,
        email: prev.email || currentAuthUser.email || '',
      }));
    }
  }, [user, shippingInfo.email]);

  useEffect(() => {
    const loadProfileEmail = async () => {
      if (shippingInfo.email) {
        return;
      }

      const profile = await fetchCurrentAccountProfile();
      const profileEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';

      if (profileEmail) {
        setShippingInfo(prev => ({
          ...prev,
          email: prev.email || profileEmail,
        }));
      }
    };

    void loadProfileEmail();
  }, [user, demoUser, shippingInfo.email]);

  useEffect(() => {
    if (countries.length === 0 || shippingInfo.country) {
      return;
    }

    const preferredCountryCode = detectPreferredCountry();
    if (!preferredCountryCode) {
      return;
    }

    const matchedCountry = countries.find(
      country => country.isoCode?.toUpperCase() === preferredCountryCode
    );

    if (!matchedCountry?.name) {
      return;
    }

    setSelectedCountryId(matchedCountry.id || '');
    setShippingInfo(prev => ({
      ...prev,
      country: matchedCountry.name,
    }));
  }, [countries, shippingInfo.country, shippingInfo.phone, phoneNumber, settings, authSettings?.site?.defaultCountry]);

  // Skip phone verification if user is already logged in and has phone
  // But if phone verification is required, ensure it's verified
  useEffect(() => {
    const userPhone = user?.phoneNumber || (authSettings?.demoMode && demoUser ? demoUser.phoneNumber : null);
    const requirePhoneVerification = authSettings?.site?.enablePhoneVerification;
    
    if (userPhone || shippingInfo.phone) {
      setIsPhoneVerified(true);
      setPhoneNumber(userPhone || shippingInfo.phone || '');
      setShippingInfo(prev => ({ ...prev, phone: userPhone || prev.phone || '' }));
      // Auto-advance to next step if user is logged in and we're on step 1
      // But only if phone verification is not required OR phone is already verified
      if (currentStep === 1 && (!requirePhoneVerification || isPhoneVerified)) {
        setCurrentStep(2);
      }
    } else if ((user || (authSettings?.demoMode && demoUser)) && !userPhone && !shippingInfo.phone) {
      // User is logged in but no phone number - reset verification
      setIsPhoneVerified(false);
      // If phone verification is required, stay on step 1
      if (requirePhoneVerification && currentStep > 1) {
        setCurrentStep(1);
      }
    }
  }, [user, currentStep, shippingInfo.phone, authSettings?.demoMode, authSettings?.site?.enablePhoneVerification, demoUser, isPhoneVerified]);

  // Don't pre-initialize reCAPTCHA - create it only when needed (like demo site)
  useEffect(() => {
    // Check if reCAPTCHA is already ready
    if (!window.recaptchaVerifier) {
    }
  }, []);

  // Step 1: Phone Verification Handlers
  const handleSendOtp = async () => {
    if (!phoneNumber) {
      setOtpError(t('checkout.error_phone_required') || 'Please enter a valid phone number');
      return;
    }

    setOtpError(null);
    setSendingOtp(true);

    try {
      const auth = getAuth(app);
      const phoneNumberString = String(phoneNumber);
      
      // Validate phone number format (should be E.164 format from react-phone-number-input)
      if (!phoneNumberString.startsWith('+')) {
        setOtpError(t('checkout.error_invalid_phone') || 'Invalid phone number format. Please include country code.');
        setSendingOtp(false);
        return;
      }

      if (!phoneNumberString.startsWith('+966')) {
        setOtpError(t('checkout.error_saudi_only') || 'Only Saudi phone numbers are allowed.');
        setSendingOtp(false);
        return;
      }
      
      // IMPORTANT: If user is already logged in (e.g., via Google), we should link phone to existing account
      // But for now, we'll handle this in handleVerifyOtp after verification

      // Demo mode check - use mock OTP instead of real SMS (check BEFORE reCAPTCHA)
      if (authSettings?.demoMode) {
        // Mock verification - auto accept any OTP in demo mode
        // Store a mock verification ID with a minimal shape and cast through unknown
        const mockVerificationId = {
          verificationId: 'demo-mock-verification-id',
          confirm: async (code: string) => {
            // In demo mode, accept any 6-digit code
            if (code && code.length === 6) {
              // Create a mock user result
              const mockUser = {
                uid: 'demo-user-' + Date.now(),
                phoneNumber: phoneNumberString,
                email: null,
                photoURL: null,
              };
              return {
                user: mockUser,
                operationType: 'signIn' as const,
                providerId: 'phone',
              };
            }
            throw new Error('Invalid code');
          }
        } as unknown as ConfirmationResult;
        setVerificationId(mockVerificationId);
        setOtpSent(true);
        setOtp(''); // Clear previous OTP
        setSendingOtp(false);
        // Show demo mode modal
        setShowDemoModal(true);
        return;
      }

      // Create reCAPTCHA verifier only when needed (like demo site - invisible)
      if (!window.recaptchaVerifier) {
        try {
          const container = document.getElementById('recaptcha-container');
          if (!container) {
            setOtpError(t('checkout.error_recaptcha_not_ready') || 'reCAPTCHA container not found. Please refresh the page.');
            setSendingOtp(false);
            return;
          }
          
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible', // Invisible reCAPTCHA like demo site
            'callback': () => {
            }
          });
        } catch {
          setOtpError(t('checkout.error_recaptcha_failed') || 'Failed to initialize reCAPTCHA. Please refresh the page.');
          setSendingOtp(false);
          return;
        }
      }

      const appVerifier = window.recaptchaVerifier;

      // CRITICAL: Store original logged-in user UID BEFORE phone verification
      // and decide whether to LINK phone to existing Google user or create pure phone account.
      const originalUser = user || auth.currentUser;
      const originalUid = originalUser?.uid || null;

      // Check if user has Google provider (to ensure we're catching Google logins)
      const hasGoogleProvider =
        originalUser?.providerData?.some((p) => p.providerId === 'google.com') || false;

      if (originalUid) {
        // Store in both ref (immediate) and state (for re-renders)
        originalLoggedInUserIdRef.current = originalUid;
        setOriginalLoggedInUserId(originalUid);
      } else {
        originalLoggedInUserIdRef.current = null;
        setOriginalLoggedInUserId(null);
      }

      // Send OTP
      let confirmationResult: ConfirmationResult;
      if (originalUser && hasGoogleProvider) {
        confirmationResult = await linkWithPhoneNumber(originalUser, phoneNumberString, appVerifier);
      } else {
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumberString, appVerifier);
      }

      setVerificationId(confirmationResult);
      setOtpSent(true);
      setOtp(''); // Clear previous OTP
    } catch (error: unknown) {
      // Failed to send OTP
      const errorObj = error as { code?: string; message?: string };
      
      // Reset captcha if error occurs (like login page)
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {
          // Ignore cleanup errors
        }
        // Re-init will happen on next render via useEffect
        window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
      }

      let errorMessage = t('checkout.error_sending_otp') || 'Failed to send OTP. Please try again.';
      
      if (errorObj.code === 'auth/invalid-phone-number') {
        errorMessage = t('checkout.error_invalid_phone') || 'Invalid phone number. Please check and try again.';
      } else if (errorObj.code === 'auth/too-many-requests') {
        errorMessage = t('checkout.error_too_many_requests') || 'Too many requests. Please wait a few minutes before trying again.';
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
        errorMessage = t('checkout.error_quota_exceeded') || 'SMS quota exceeded. Please try again later.';
      } else if (errorObj.code === 'auth/internal-error') {
        errorMessage = t('checkout.error_internal') || 'An internal error occurred. Please try again or refresh the page.';
      } else if (errorObj.code === 'auth/invalid-app-credential') {
        errorMessage = t('checkout.error_recaptcha_invalid') || 'reCAPTCHA verification failed. Please refresh the page and try again.';
        // Reset verifier on invalid credential
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch {
            // Ignore cleanup errors
          }
          window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
        }
      } else if (errorObj.code === 'auth/captcha-check-failed') {
        errorMessage = t('checkout.error_recaptcha_failed') || 'reCAPTCHA verification failed. Please try again.';
        // Reset verifier
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch {
            // Ignore cleanup errors
          }
          window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
        }
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
      
      setOtpError(errorMessage);
      setOtpSent(false);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError(t('checkout.error_otp_length') || 'Please enter a valid 6-digit OTP code.');
      return;
    }

    if (!verificationId) {
      setOtpError(t('checkout.error_no_verification') || 'Verification session expired. Please request a new OTP.');
      return;
    }

    setOtpError(null);
    setVerifyingOtp(true);

    try {
      // Demo mode check - accept any 6-digit OTP
      if (authSettings?.demoMode && verificationId.verificationId === 'demo-mock-verification-id') {
        // Mock verification - create a demo user with consistent UID based on phone
        // Use phone number hash to generate consistent UID for same phone number
        const phoneStr = String(phoneNumber || '');
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
        let existingUser: { id: string; displayName?: string | null; role?: string } | null = null;
        try {
          // Try to find existing user by phone
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            existingUser = { id: userDoc.id, ...userDoc.data() } as { id: string; displayName?: string | null; role?: string };
            // Use existing UID
            mockUser.uid = userDoc.id;
          }
        } catch {
          // Ignore errors
        }
        
        // Phone verified successfully
        setIsPhoneVerified(true);
        setShippingInfo(prev => ({ ...prev, phone: phoneStr }));
        
        // If existing user, update profile if needed
        if (existingUser) {
          try {
            // Preserve existing isAdmin status
            const isAdminStatus = existingUser.role === 'admin';
            await createUserProfile({
              uid: mockUser.uid,
              email: null,
              displayName: existingUser.displayName || null,
              photoURL: null,
              phoneNumber: phoneStr,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: isAdminStatus,
            }, true); // Pass isDemoMode = true
          } catch {
            // Ignore profile update errors
          }
        } else {
          // New user - profile will be created in step 2
        }
        
        // Move to next step
        nextStep();
        setVerifyingOtp(false);
        return;
      }
      
      const result = await verificationId.confirm(otp);
      const verifiedPhone = result.user.phoneNumber || String(phoneNumber || '');
      
      // Phone verified successfully
      setIsPhoneVerified(true);
      setShippingInfo(prev => ({ ...prev, phone: verifiedPhone }));
      
      // CRITICAL: Check if user was already logged in BEFORE phone verification (e.g., via Google)
      // Use stored originalLoggedInUserId because auth.currentUser is now the phone-verified user
      // Also, AuthContext user has been updated to phone user by onAuthStateChanged
      // Use ref value first (immediate), then fallback to state, then demo user
      // Check if phone verification created a new user (different UID) when user was already logged in
      // CRITICAL: Use ref value for immediate check (state might not be updated yet)
      const hasOriginalUser = originalLoggedInUserIdRef.current || originalLoggedInUserId;
      const shouldUpdateGoogleProfile = hasOriginalUser && hasOriginalUser !== result.user.uid;
      
      if (shouldUpdateGoogleProfile) {
        // User was already logged in with different provider (e.g., Google)
        // Phone verification created a new user, but we need to update existing user's profile
        // CRITICAL: Update existing Google user's profile, NOT the new phone user's profile
        // Use hasOriginalUser (from ref) instead of originalUserId (from state)
        const googleUserUid = hasOriginalUser;
        try {
          const existingProfile = await getUserProfile(googleUserUid);
          if (existingProfile) {
            // Preserve existing isAdmin status and other data
            const isAdminStatus = existingProfile.role === 'admin';
            
            // Update existing Google user's profile with phone number
            await createUserProfile({
              uid: googleUserUid, // Use existing Google UID, NOT result.user.uid (new phone UID)
              email: existingProfile.email || null,
              displayName: existingProfile.displayName || null,
              photoURL: existingProfile.photoURL || null,
              phoneNumber: verifiedPhone, // Add phone number to existing Google profile
              createdAt: existingProfile.createdAt ? Timestamp.fromDate(existingProfile.createdAt.toDate()) : Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: isAdminStatus,
            });
            // Note: We don't link phone credential to Google user here because:
            // 1. signInWithPhoneNumber already created a new phone user
            // 2. Linking would require signing out phone user and signing back in with Google
            // 3. Firestore profile is the source of truth, and we've updated it correctly
            // 4. The phone user in Firebase Auth will exist but won't have a Firestore profile
            // 5. Future logins will use Google, and the profile will have the phone number
          }
        } catch (profileError: unknown) {
          // Failed to update existing profile, continue with checkout
          const errorObj = profileError as { message?: string; code?: string };
          if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
            // Profile update failed due to permissions. Continuing with checkout.
          }
        }
        
        // IMPORTANT: Don't create profile for phone-verified user since we updated existing Google user
        // Skip the else block that creates profile for phone-verified user
        // Just move to next step - profile is already updated above
      } else {
        // No existing logged-in user BEFORE phone verification, proceed with phone-verified user profile creation/update
        // Note: signInWithPhoneNumber automatically signs in the user, so result.user is the authenticated user
        // BUT: Double-check that originalUserId is truly null (not just not set in state)
        // If originalUserId is null/undefined, then this is a fresh phone login, create profile
        // CRITICAL: Check both ref and state - if either exists, don't create phone user profile
        // This prevents creating phone user profile when originalLoggedInUserId exists but condition didn't match
        if (!originalLoggedInUserIdRef.current && !originalLoggedInUserId) {
          // Only create profile if we're sure there was no original user
          if (result.user.uid) {
            try {
              // Check if user profile already exists
              const existingProfile = await getUserProfile(result.user.uid);
              
              if (!existingProfile) {
                // Create new customer account for phone-verified user
                await createUserProfile({
                  uid: result.user.uid,
                  email: result.user.email || null,
                  displayName: result.user.displayName || null,
                  photoURL: result.user.photoURL || null,
                  phoneNumber: verifiedPhone,
                  createdAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                  isAdmin: false,
                });
              } else {
                // Update phone number if it changed
                if (existingProfile.phoneNumber !== verifiedPhone) {
                  // Preserve existing isAdmin status
                  const isAdminStatus = existingProfile.role === 'admin';
                  await createUserProfile({
                    uid: result.user.uid,
                    email: result.user.email || null,
                    displayName: existingProfile.displayName || result.user.displayName || null,
                    photoURL: result.user.photoURL || null,
                    phoneNumber: verifiedPhone,
                    createdAt: existingProfile.createdAt ? Timestamp.fromDate(existingProfile.createdAt.toDate()) : Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    isAdmin: isAdminStatus, // Preserve existing admin status
                  });
                }
              }
              
            } catch (profileError: unknown) {
              // Log error but don't block checkout if profile creation fails
              // Failed to create/update user profile
              const errorObj = profileError as { message?: string; code?: string };
              if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
                // User profile creation failed due to permissions. Continuing with checkout.
              }
            }
          }
        } else {
          // originalLoggedInUserId exists but condition didn't match - this shouldn't happen
          // But to be safe, don't create phone user profile
        }
      }
       
      // Clean up reCAPTCHA
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
        } catch {
          // Ignore cleanup errors
        }
      }
      
      // Move to next step
      nextStep();
    } catch (error: unknown) {
    // Failed to verify OTP
      const errorObj = error as { code?: string; message?: string };
      
      let errorMessage = t('checkout.error_invalid_otp') || 'Invalid OTP. Please try again.';
      
      if (errorObj.code === 'auth/invalid-verification-code') {
        errorMessage = t('checkout.error_invalid_otp') || 'Invalid verification code. Please check and try again.';
      } else if (errorObj.code === 'auth/code-expired') {
        errorMessage = t('checkout.error_otp_expired') || 'Verification code expired. Please request a new one.';
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
      
      setOtpError(errorMessage);
      setOtp('');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step 2: Name & Email Validation
  const validateStep2 = async () => {
    if (!shippingInfo.fullName) {
      setInfoDialogTitle(t('common.error') || 'Error');
      setInfoDialogMessage(t('checkout.error_full_name_required') || 'Please enter your full name');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    
    // Save name to user profile if user is logged in or phone is verified
    // CRITICAL: Use originalLoggedInUserId if it exists (Google user), otherwise use current user (phone user)
    // This ensures we update the correct profile (Google user's profile, not phone user's profile)
    // Use ref value first (immediate), then fallback to state
    const originalUid = originalLoggedInUserIdRef.current || originalLoggedInUserId;
    const currentUserId = originalUid || user?.uid || (authSettings?.demoMode && demoUser ? demoUser.uid : null);
    if (currentUserId || isPhoneVerified) {
      try {
        if (currentUserId) {
          // User is logged in, update profile
          // If originalLoggedInUserId exists, use that (Google user), otherwise use current user (phone user)
          const profileToUpdate = originalUid || currentUserId;
          const currentProfile = await getUserProfile(profileToUpdate);
          if (currentProfile) {
            // Preserve existing isAdmin status
            const isAdminStatus = currentProfile.role === 'admin';
            await createUserProfile({
              uid: profileToUpdate, // Use original Google UID if exists, otherwise phone UID
              email: shippingInfo.email || currentProfile.email || user?.email || demoUser?.phoneNumber || null,
              displayName: shippingInfo.fullName,
              photoURL: currentProfile.photoURL || user?.photoURL || null,
              phoneNumber: shippingInfo.phone || currentProfile.phoneNumber || user?.phoneNumber || demoUser?.phoneNumber || null,
              createdAt: currentProfile.createdAt ? Timestamp.fromDate(currentProfile.createdAt.toDate()) : Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: isAdminStatus, // Preserve existing admin status
            });

            // Also update Firebase Auth displayName so header/account me naam show ho
            // But only if we're using the current user (not originalLoggedInUserId)
            // If originalLoggedInUserId exists, we don't want to update phone user's auth profile
            if (user && !originalLoggedInUserId) {
              try {
                await updateProfile(user, {
                  displayName: shippingInfo.fullName,
                });
              } catch {
                // Ignore auth profile update errors, checkout should continue
              }
            }
          }
        } else if (isPhoneVerified && shippingInfo.phone) {
          // Phone verified but AuthContext me user abhi null ho sakta hai,
          // is liye direct Firebase Auth se currentUser le kar profile update karte hain.
          // CRITICAL: Use originalLoggedInUserId if it exists (Google user), not phone user
          const authInstance = getAuth(app);
          const currentAuthUser = authInstance.currentUser;
          
          // Use original Google user UID if exists, otherwise use phone user UID
          // Use ref value first (immediate), then fallback to state
          const originalUid = originalLoggedInUserIdRef.current || originalLoggedInUserId;
          const profileUidToUpdate = originalUid || currentAuthUser?.uid;

          if (profileUidToUpdate) {
            const existingProfile = await getUserProfile(profileUidToUpdate);

            const isAdminStatus = existingProfile?.role === 'admin' || false;
            const existingEmail = existingProfile?.email || currentAuthUser?.email || null;
            const existingPhone =
              existingProfile?.phoneNumber || currentAuthUser?.phoneNumber || shippingInfo.phone;

            await createUserProfile({
              uid: profileUidToUpdate, // Use original Google UID if exists, otherwise phone UID
              email: shippingInfo.email || existingEmail,
              displayName: shippingInfo.fullName || existingProfile?.displayName || null,
              photoURL: existingProfile?.photoURL || currentAuthUser?.photoURL || null,
              phoneNumber: existingPhone,
              createdAt:
                existingProfile?.createdAt && 'toDate' in existingProfile.createdAt
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    Timestamp.fromDate((existingProfile.createdAt as any).toDate())
                  : Timestamp.now(),
              updatedAt: Timestamp.now(),
              isAdmin: isAdminStatus,
            });

            // Firebase Auth displayName bhi update karein, but only if not using originalLoggedInUserId
            // (don't update phone user's auth profile if we're updating Google user's Firestore profile)
            if (currentAuthUser && !originalLoggedInUserId) {
              try {
                await updateProfile(currentAuthUser, {
                  displayName: shippingInfo.fullName,
                });
              } catch {
                // Ignore auth profile update errors
              }
            }
          }
        }
      } catch (error: unknown) {
        // Don't block checkout if profile update fails
        // Failed to save name to profile
        const errorObj = error as { message?: string; code?: string };
        if (errorObj?.message?.includes('permissions') || errorObj?.code === 'permission-denied') {
          // Name save failed due to permissions. Continuing with checkout.
        }
      }
    }
    
    // Email is optional, so we don't validate it
    nextStep();
  };

  // Step 3: Address Validation
  const validateStep3 = () => {
    if (!shippingInfo.address || !shippingInfo.city || !shippingInfo.state || !shippingInfo.zipCode || !shippingInfo.country) {
      setInfoDialogTitle(t('common.error') || 'Error');
      setInfoDialogMessage(t('checkout.error_address_required') || 'Please fill in all address fields');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    nextStep();
  };

  // Step 4: Shipping Method Validation
  const validateStep4 = () => {
    if (shippingRates.length > 0 && !selectedShippingRate) {
      setInfoDialogTitle(t('common.error') || 'Error');
      setInfoDialogMessage(t('checkout.error_shipping_method_required') || 'Please select a shipping method');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    nextStep();
  };

  const applyCoupon = async () => {
      setCouponError(null);
      if (!couponCode) return;
      
      try {
          const coupon = await getCouponByCode(couponCode);
          
          if (coupon && coupon.isActive) {
              const now = new Date();
              if (now < coupon.validFrom.toDate() || now > coupon.validUntil.toDate()) {
                  setCouponError(t('checkout.coupon_expired') || "Coupon is expired or not yet valid.");
                  return;
              }

              // Check total usage limit
              if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
                  setCouponError(t('checkout.coupon_usage_limit') || "This coupon has reached its usage limit.");
                  return;
              }

              // Check per-user usage limit if user is logged in
              if (user?.uid && coupon.perUserLimit) {
                  const userUsage = await getUserCouponUsage(user.uid, coupon.code);
                  if (userUsage >= coupon.perUserLimit) {
                      setCouponError(t('checkout.coupon_user_limit', { limit: coupon.perUserLimit }) || `You have already used this coupon ${coupon.perUserLimit} time${coupon.perUserLimit > 1 ? 's' : ''}.`);
                      return;
                  }
              }

              setAppliedCoupon({
                  code: coupon.code,
                  discount: coupon.discountValue,
                  type: coupon.discountType
              });
              setCouponCode('');
          } else {
              setCouponError(t('checkout.coupon_invalid') || "Invalid or inactive coupon code.");
          }
      } catch (err: unknown) {
          // Failed to apply coupon
          // Check if it's a permissions error
          const errorObj = err as { message?: string; code?: string };
          if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
              setCouponError(t('checkout.coupon_permission_error') || "Unable to verify coupon due to permissions. Please try again later or contact support.");
          } else if (errorObj?.message?.includes('not found') || errorObj?.code === 'not-found') {
              setCouponError(t('checkout.coupon_not_found') || "Invalid coupon code. Please check and try again.");
          } else {
              setCouponError(t('checkout.coupon_failed') || "Failed to apply coupon. Please check the code and try again.");
          }
      }
  };

  // Memoize cart total calculation (recalculate prices based on current product data)
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        // Calculate variant extraPrice
        // If variant value contains " - " (color - size format), calculate both variants' extraPrice
        let variantExtraPrice = 0;
        if (item.variant) {
          // Check if this is a combined variant (color - size)
          if (item.variant.value?.includes(' - ')) {
            const [colorValue, sizeValue] = item.variant.value.split(' - ');
            const colorVariant = product.variants?.find(v => 
              v.name?.toLowerCase() === 'color' && 
              v.value?.toLowerCase() === colorValue?.toLowerCase()
            );
            const sizeVariant = product.variants?.find(v => 
              v.name?.toLowerCase() === 'size' && 
              v.value?.toLowerCase() === sizeValue?.toLowerCase()
            );
            const colorExtraPrice = (colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0);
            const sizeExtraPrice = (sizeVariant?.extraPrice ?? sizeVariant?.priceAdjustment ?? 0);
            variantExtraPrice = colorExtraPrice + sizeExtraPrice;
          } else {
            // Single variant
            const variant = product.variants?.find(v => 
              v.id === item.variant?.id || 
              (v.name?.toLowerCase() === item.variant?.name?.toLowerCase() && 
               v.value?.toLowerCase() === item.variant?.value?.toLowerCase())
            );
            if (variant) {
              // Use nullish coalescing (??) instead of || because extraPrice can be 0 (which is falsy)
              variantExtraPrice = (variant.extraPrice ?? variant.priceAdjustment ?? 0);
            }
          }
        }
        
        const standardPricing = getProductPriceWithVariant(
          product,
          item.variant,
          settings?.goldPricing,
          settings?.goldPricing?.cache
        );
        const basePrice = standardPricing.currentPrice - variantExtraPrice;
        const itemOriginalPrice = standardPricing.currentPrice;
        
        // Apply flash sale discount if applicable
        if (item.flashSaleId) {
          const flashSale = flashSales.find(s => s.id === item.flashSaleId);
          if (flashSale && flashSale.productIds.includes(item.productId)) {
            // Discount applies to base price only, variant extraPrice NOT included in discount calculation
            let discountedBasePrice = basePrice;
            if (flashSale.discountType === 'percentage') {
              discountedBasePrice = Math.max(basePrice * (1 - flashSale.discountValue / 100), 0);
            } else if (flashSale.discountType === 'fixed') {
              discountedBasePrice = Math.max(basePrice - flashSale.discountValue, 0);
            }
            // Final price = discounted base price only (variant extraPrice NOT included for flash sale)
            return total + discountedBasePrice * item.quantity;
          }
        }
        
        // For regular items: use full price
        const finalPrice = itemOriginalPrice;
        return total + finalPrice * item.quantity;
      } else {
        // Fallback to stored price if product not found
        return total + item.price * item.quantity;
      }
    }, 0);
  }, [cart, products, flashSales]);

  // Memoize discount amount calculation
  const discountAmount = useMemo(() => {
      if (!appliedCoupon) return 0;
      if (appliedCoupon.type === 'percentage') {
      return (cartTotal * appliedCoupon.discount) / 100;
      } else {
          return appliedCoupon.discount;
      }
  }, [appliedCoupon, cartTotal]);

  // Helper function for discount calculations (currently unused but kept for future use)
  // const getDiscountAmount = () => {
  //   return discountAmount;
  // };

  const getFinalTotal = () => {
    const subtotal = cartTotal - discountAmount;
    const total = subtotal + taxAmount + shippingCost;
    const finalTotal = useWallet ? Math.max(0, total - walletAmount) : total;
    return finalTotal > 0 ? finalTotal : 0;
  };

  // Update wallet amount when useWallet changes
  useEffect(() => {
    if (useWallet && settings?.payment?.enableWallet) {
      const subtotal = cartTotal - discountAmount;
      const total = subtotal + taxAmount + shippingCost;
      const maxWalletAmount = Math.min(walletBalance, total);
      setWalletAmount(maxWalletAmount);
    } else {
      setWalletAmount(0);
    }
  }, [useWallet, walletBalance, cartTotal, discountAmount, taxAmount, shippingCost, settings]);
  
  // Calculate taxes when shipping info or cart changes
  useEffect(() => {
    const calculateTax = async () => {
      if (cart.length === 0) {
        setTaxAmount(0);
        setTaxBreakdown([]);
        return;
      }
      
      try {
      // Use state as region (default to PK if not set) for backward compatibility
      const region = shippingInfo.state || 'PK';
      // Prepare location data for tax calculation
      const location = {
        countryId: selectedCountryId || '',
        countryName: shippingInfo.country || '',
        stateId: selectedStateId || '',
        stateName: shippingInfo.state || '',
        cityId: selectedCityId || '',
        cityName: shippingInfo.city || '',
      };
      
      const taxableCartItems = cart
        .filter((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          return product ? !isGoldPricedProduct(product) : true;
        })
        .map(item => ({
          productId: item.productId,
          categoryId: item.categoryId,
          price: item.price,
          quantity: item.quantity
        }));

      const taxableSubtotal = taxableCartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const taxCalculation = await calculateTaxes(
        taxableSubtotal,
        shippingCost, // Shipping cost
        region, // For backward compatibility
        taxableCartItems,
        location // Pass location for country/state/city matching
      );
      
        setTaxAmount(taxCalculation.taxAmount);
      setTaxBreakdown(taxCalculation.taxBreakdown);
      } catch (error: unknown) {
        // Failed to calculate taxes
        // Set zero tax on error to prevent UI issues
        setTaxAmount(0);
        setTaxBreakdown([]);
        // Log permission errors specifically
        const errorObj = error as { message?: string; code?: string };
        if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
          // Tax calculation failed due to permissions. Continuing with zero tax.
        }
      }
    };
    
    calculateTax();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, shippingInfo.state, shippingInfo.country, shippingInfo.city, shippingCost, cartTotal, discountAmount, selectedCountryId, selectedStateId]);

  const createOrder = async () => {
    const orderItems = cart.map(item => {
      const orderItem: OrderItem = {
      productId: item.productId,
      productName: item.productName,
      productImage: item.productImage,
      price: item.price,
      quantity: item.quantity,
      };
      // Only add variant if it exists
      if (item.variant) {
        orderItem.variant = {
        id: item.variant.id,
        name: item.variant.name,
        value: item.variant.value,
        };
      }
      return orderItem;
    });

    const userId = user?.uid || (authSettings?.demoMode && demoUser ? demoUser.uid : null);
    const newOrder: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: userId || 'anonymous',
      items: orderItems,
      shippingAddress: shippingInfo,
      totalAmount: getFinalTotal(),
      subtotal: cartTotal,
      discount: discountAmount,
      tax: taxAmount,
      shippingCost: shippingCost,
      taxBreakdown: taxBreakdown.map(tb => ({
        taxRateId: (tb.taxRate as { id?: string }).id || '',
        taxRateName: tb.taxRate.name,
        amount: tb.amount,
      })),
      couponCode: appliedCoupon?.code || null,
      paymentMethod: 'whatsapp',
      status: OrderStatus.Pending,
      paymentIntentId: null,
    };

    // Add shipping rate info if selected
    if (selectedShippingRate?.id) {
      newOrder.shippingRateId = selectedShippingRate.id;
      newOrder.shippingMethod = selectedShippingRate.name;
      if (selectedShippingRate.carrierId) {
        newOrder.carrierId = selectedShippingRate.carrierId;
      }
      if (selectedShippingRate.carrierName) {
        newOrder.carrierName = selectedShippingRate.carrierName;
      }
    }

    try {
      if (settings?.payment?.enableLoyaltyPoint && userId) {
        const products = await getAllProducts();
        let totalLoyaltyPoints = 0;

        cart.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product?.loyaltyPoints) {
            totalLoyaltyPoints += product.loyaltyPoints * item.quantity;
          }
        });

        if (totalLoyaltyPoints > 0) {
          newOrder.loyaltyPointsEarned = totalLoyaltyPoints;
        }
      }

      const currentAuthUser = getCurrentAuthUser();
      const idToken = currentAuthUser ? await currentAuthUser.getIdToken().catch(() => null) : null;
      const response = await fetch('/api/orders/whatsapp-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(newOrder),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.orderId) {
        throw new Error(data?.error || 'Failed to create order');
      }

      return data.orderId as string;
    } catch (error: unknown) {
        // Failed to place order
      setIsProcessing(false);
      // Check if it's a permissions error
      const errorObj = error as { message?: string; code?: string };
      let errorMsg = '';
      if (errorObj?.message?.includes('permissions') || errorObj?.message?.includes('insufficient') || errorObj?.code === 'permission-denied') {
        errorMsg = t('checkout.error_permissions') || 'Unable to place order due to permissions issue. Please contact support with your order details.';
      } else if (errorObj?.message?.includes('network') || errorObj?.code === 'unavailable') {
        errorMsg = t('checkout.error_network') || 'Network error. Please check your connection and try again.';
      } else {
        errorMsg = t('checkout.error_generic') || 'There was an error placing your order. Please try again or contact support.';
      }
      setPaymentError(errorMsg);
      setInfoDialogTitle(t('common.error') || 'Error');
      setInfoDialogMessage(errorMsg);
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return null;
    }
  };

  const handleWhatsAppOrder = async () => {
    setPaymentError(null);
    setIsProcessing(true);
    const createdOrderId = await createOrder();
    if (createdOrderId) {
      setOrderId(createdOrderId);
      setConfirmedLocalPaymentMethod(null);
      setOrderPlaced(true);
      clearCart();
    }
    setIsProcessing(false);
  };




  // Provider-based payment handler
  const handleProviderPayment = async (gatewayType: string, linkFunction: string, customerEmail?: string, customerName?: string, customerPhone?: string) => {
    setPaymentError(null);
    setIsProcessing(true);

    try {
      const tempOrderId = await createOrder();
      
      if (!tempOrderId) {
        throw new Error('Failed to create order');
      }

      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const functionsUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
        `https://us-central1-${projectId}.cloudfunctions.net`;

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${functionsUrl}/${linkFunction}`;
      form.style.display = 'none';

      const orderIdInput = document.createElement('input');
      orderIdInput.type = 'hidden';
      orderIdInput.name = 'order_id';
      orderIdInput.value = tempOrderId;
      form.appendChild(orderIdInput);

      const amountInput = document.createElement('input');
      amountInput.type = 'hidden';
      amountInput.name = 'amount';
      amountInput.value = getFinalTotal().toString();
      form.appendChild(amountInput);

      const currencyInput = document.createElement('input');
      currencyInput.type = 'hidden';
      currencyInput.name = 'currency';
      currencyInput.value = defaultCurrency?.code || 'usd';
      form.appendChild(currencyInput);

      if (customerEmail) {
        const emailInput = document.createElement('input');
        emailInput.type = 'hidden';
        emailInput.name = 'email';
        emailInput.value = customerEmail;
        form.appendChild(emailInput);
      }
      if (customerName) {
        const nameInput = document.createElement('input');
        nameInput.type = 'hidden';
        nameInput.name = 'name';
        nameInput.value = customerName;
        form.appendChild(nameInput);
      }
      if (customerPhone) {
        const phoneInput = document.createElement('input');
        phoneInput.type = 'hidden';
        phoneInput.name = 'phone';
        phoneInput.value = customerPhone;
        form.appendChild(phoneInput);
      }

      document.body.appendChild(form);
      form.submit();

    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : `Failed to process ${gatewayType} payment`);
      setIsProcessing(false);
    }
  };

  // Stripe provider payment handler
  const handleStripeProviderPayment = async () => {
    await handleProviderPayment(
      'stripe',
      'stripeLink',
      shippingInfo.email,
      shippingInfo.fullName,
      shippingInfo.phone
    );
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </div>
            <h1 className="text-3xl font-heading font-bold mb-2 text-gray-900">
              {t('checkout.order_sent_success') || 'Order Sent Successfully'}
            </h1>
            <p className="text-gray-500 mb-6">
              {t('checkout.order_sent_desc') || 'Your order has been saved and sent automatically to the store on WhatsApp.'}
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-8 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">
                    {t('checkout.order_id_label') || 'Order ID'}
                  </p>
                  <p className="text-lg font-mono font-bold text-gray-900 tracking-wider">{orderId}</p>
                </div>
                
                <div className="border-t border-gray-200 pt-4 mt-4 text-sm text-gray-600">
                  {t('checkout.order_received_whatsapp') || 'The store has received your order details on WhatsApp. You can continue shopping now.'}
                </div>
            </div>
            <Link href="/shop" className="block w-full bg-black text-white px-6 py-4 rounded-xl font-bold hover:bg-gray-800 transition-all transform hover:-translate-y-1 shadow-lg">
                {t('checkout.continue_shopping') || 'Continue Shopping'}
            </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">
          {t('checkout.empty_cart_title') || 'Your Cart is Empty'}
        </h1>
        <Link href="/shop" className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-black rounded-full hover:bg-gray-900 transition-colors">
          {t('checkout.empty_cart_cta') || 'Start Shopping'}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
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
              {t('checkout.demo_mode_title') || 'Demo Mode'}
            </h3>
            <p className="text-gray-600 text-center mb-6">
              {t('checkout.demo_mode_desc') || 'Phone verification is disabled in demo mode. Use any 6-digit code to verify.'}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 text-center font-medium">
                {t('checkout.demo_mode_example') || 'Example:'} <span className="font-mono bg-white px-2 py-1 rounded border">123456</span>
              </p>
            </div>
            <button
              onClick={() => setShowDemoModal(false)}
              className="w-full bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              {t('checkout.demo_mode_ok') || 'Got it'}
            </button>
          </div>
        </div>
      )}

      <div className="page-container py-10">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-8 text-center">
          {t('checkout.title') || 'Secure Checkout'}
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Column: Steps */}
          <div className="w-full lg:w-2/3 space-y-6">
            
            {/* Step 1: Phone Verification */}
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border ${currentStep === 1 ? 'border-black ring-1 ring-black' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 1 ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('checkout.step1_title') || 'Phone Verification'}
                  </h2>
              </div>
              
              {currentStep === 1 && (
                <div className="space-y-4">
                  {/* Invisible reCAPTCHA container - hidden but required for Firebase */}
                  <div id="recaptcha-container" className="absolute -left-[9999px] opacity-0 pointer-events-none"></div>
                  
                  {isPhoneVerified && user?.phoneNumber ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-600">
                          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-green-900">{t('checkout.phone_already_verified') || 'Phone Already Verified'}</p>
                          <p className="text-sm text-green-700">{user.phoneNumber}</p>
                        </div>
                      </div>
                      <button 
                        onClick={nextStep} 
                        className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                      >
                        {t('checkout.continue') || 'Continue'}
                      </button>
                    </div>
                  ) : !otpSent ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.phone_label') || 'Phone Number'}
                        </label>
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
                      {otpError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                          {otpError}
                        </div>
                      )}
                      <button 
                        onClick={handleSendOtp} 
                        disabled={sendingOtp || !phoneNumber}
                        className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {sendingOtp ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            {t('checkout.sending_otp') || 'Sending...'}
                          </>
                        ) : (
                          t('checkout.send_otp') || 'Send Verification Code'
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 text-blue-900">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm font-medium">
                            {t('checkout.otp_sent_message', { phone: String(phoneNumber || '') }) || `Verification code sent to ${phoneNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-sm font-medium text-gray-700">
                          {t('checkout.otp_label') || 'Enter 6-digit verification code'}
                         </label>
                         <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setOtp(value);
                              setOtpError(null);
                            }}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all tracking-widest text-center text-lg font-mono"
                            placeholder="000000"
                         />
                      </div>
                      {otpError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                          {otpError}
                        </div>
                      )}
                      <button 
                        onClick={handleVerifyOtp} 
                        disabled={verifyingOtp || otp.length !== 6}
                        className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {verifyingOtp ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            {t('checkout.verifying') || 'Verifying...'}
                          </>
                        ) : (
                          t('checkout.verify_continue') || 'Verify & Continue'
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          setOtpSent(false);
                          setOtp('');
                          setOtpError(null);
                          setVerificationId(null);
                        }} 
                        className="w-full text-gray-500 text-sm mt-2 hover:text-black transition-colors"
                      >
                        {t('checkout.change_phone') || 'Change Phone Number'}
                      </button>
                    </>
                  )}
                </div>
              )}
              {currentStep > 1 && (
                  <div className="flex justify-between items-center">
                      <p className="font-medium text-gray-900">{shippingInfo.phone || phoneNumber}</p>
                      <span className="text-green-600 text-sm font-bold flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                        </svg>
                        {t('checkout.verified') || 'Verified'}
                      </span>
                  </div>
              )}
            </div>

            {/* Step 2: Personal Details */}
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border ${currentStep === 2 ? 'border-black ring-1 ring-black' : 'border-gray-100 opacity-60'}`}>
               <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 2 ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('checkout.step2_title') || 'Personal Details'}
                  </h2>
              </div>

              {currentStep === 2 && (
                  <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.full_name_label') || 'Full Name'}
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          value={shippingInfo.fullName}
                          onChange={handleInputChange}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.email_label') || 'Email Address'}{' '}
                          <span className="text-gray-400 font-normal">
                            {t('checkout.optional') || '(Optional)'}
                          </span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={shippingInfo.email}
                          onChange={handleInputChange}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          placeholder={t('checkout.email_placeholder') || 'you@example.com'}
                        />
                      </div>
                      <div className="flex gap-4 pt-2">
                          <button onClick={prevStep} className="px-6 py-3 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                            {t('checkout.back') || 'Back'}
                          </button>
                          <button onClick={validateStep2} className="flex-1 bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
                            {t('checkout.continue') || 'Continue'}
                          </button>
                      </div>
                  </div>
              )}
              {currentStep > 2 && (
                  <div>
                      <p className="font-medium text-gray-900">{shippingInfo.fullName}</p>
                      <p className="text-sm text-gray-500">{shippingInfo.email}</p>
                  </div>
              )}
            </div>

            {/* Step 3: Address */}
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border ${currentStep === 3 ? 'border-black ring-1 ring-black' : 'border-gray-100 opacity-60'}`}>
               <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 3 ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>3</div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('checkout.step3_title') || 'Shipping Address'}
                  </h2>
              </div>

              {currentStep === 3 && (
                  <div className="space-y-4">
                      {/* Saved Addresses Selection */}
                      {savedAddresses.length > 0 && (
                        <div className="space-y-2 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <label className="text-sm font-medium text-gray-700">
                            {t('checkout.select_saved_address') || 'Select Saved Address'}
                          </label>
                          <select
                            value={selectedAddressId}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddressSelect(e.target.value);
                              } else {
                                setSelectedAddressId('');
                              }
                            }}
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          >
                            <option value="">
                              {t('checkout.saved_address_placeholder') || 'Select a saved address or enter new'}
                            </option>
                            {savedAddresses.map((addr) => (
                              <option key={addr.id} value={addr.id}>
                                {addr.label} {addr.isDefault && '(Default)'} - {addr.address}
                                {addr.city && `, ${addr.city}`}
                                {addr.state && `, ${addr.state}`}
                                {addr.zipCode && ` ${addr.zipCode}`}
                                {addr.country && `, ${addr.country}`}
                              </option>
                            ))}
                          </select>
                          {selectedAddressId && (
                            <p className="text-xs text-gray-500 mt-1">
                              {t('checkout.selected_address_hint') || 'Selected address will be used for shipping'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Address */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.address_label') || 'Address'}
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={shippingInfo.address}
                          onChange={(e) => {
                            handleInputChange(e);
                            setSelectedAddressId(''); // Clear selection when manually editing
                          }}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                        />
                      </div>

                      {/* Country (Address ke baad) */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.country_label') || 'Country'}
                        </label>
                        <select
                          name="country"
                          value={shippingInfo.country}
                          onChange={(e) => {
                            const selectedCountry = countries.find(c => c.name === e.target.value);
                            setSelectedCountryId(selectedCountry?.id || '');
                            setShippingInfo(prev => ({ ...prev, country: e.target.value, state: '', city: '' }));
                            setSelectedStateId('');
                            setCities([]);
                          }}
                          disabled
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {t('checkout.country_placeholder') || 'Select Country'}
                          </option>
                          {countries.length > 0 && countries.map((country) => (
                            <option key={country.id} value={country.name}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">{t('checkout.country_sa_only_note') || 'Shipping is available for Saudi Arabia only.'}</p>
                      </div>

                      {/* State */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.state_label') || 'State/Province'}
                        </label>
                        {states.length > 0 ? (
                          <select
                            name="state"
                            value={shippingInfo.state}
                            onChange={(e) => {
                              const selectedState = states.find(s => s.name === e.target.value);
                              setSelectedStateId(selectedState?.id || '');
                              setShippingInfo(prev => ({ ...prev, state: e.target.value }));
                            }}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          >
                            <option value="">
                              {t('checkout.state_placeholder') || 'Select State'}
                            </option>
                            {states.map((state) => (
                              <option key={state.id} value={state.name}>
                                {state.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            name="state"
                            value={shippingInfo.state}
                            onChange={handleInputChange}
                            placeholder={t('checkout.state_input_placeholder') || 'Enter state/province'}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          />
                        )}
                      </div>

                      {/* City */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.city_label') || 'City'}
                        </label>
                        {cities.length > 0 ? (
                          <select
                            name="city"
                            value={shippingInfo.city}
                            onChange={(e) => {
                              const selectedCity = cities.find(c => c.name === e.target.value);
                              setSelectedCityId(selectedCity?.id || '');
                              setShippingInfo(prev => ({ ...prev, city: e.target.value }));
                            }}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          >
                            <option value="">
                              {t('checkout.city_placeholder') || 'Select City'}
                            </option>
                            {cities.map((city) => (
                              <option key={city.id} value={city.name}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            name="city"
                            value={shippingInfo.city}
                            onChange={handleInputChange}
                            placeholder={t('checkout.city_input_placeholder') || 'Enter city'}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                          />
                        )}
                      </div>

                      {/* Zip Code */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {t('checkout.zip_label') || 'Zip Code'}
                        </label>
                        <input
                          type="text"
                          name="zipCode"
                          value={shippingInfo.zipCode}
                          onChange={handleInputChange}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div className="flex gap-4 pt-2">
                          <button onClick={prevStep} className="px-6 py-3 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                            {t('checkout.back') || 'Back'}
                          </button>
                          <button onClick={validateStep3} className="flex-1 bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
                            {t('checkout.continue_to_payment') || 'Continue to Payment'}
                          </button>
                      </div>
                  </div>
              )}
              {currentStep > 3 && (
                  <div>
                      <p className="font-medium text-gray-900">{shippingInfo.address}</p>
                      <p className="text-sm text-gray-500">{shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}, {shippingInfo.country}</p>
                  </div>
              )}
            </div>

            {/* Step 4: Shipping Method */}
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border ${currentStep === 4 ? 'border-black ring-1 ring-black' : 'border-gray-100 opacity-60'}`}>
               <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 4 ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>4</div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('checkout.step4_title') || 'Shipping Method'}
                  </h2>
              </div>

              {currentStep === 4 && (
                <div className="space-y-4">
                  {shippingRates.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-900 font-medium mb-3">
                        {t('checkout.shipping_confirmed_whatsapp') || 'Shipping will be confirmed on WhatsApp.'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('checkout.shipping_confirmed_whatsapp_desc') || 'You can continue now and complete the order. Shipping cost and delivery method will be confirmed manually on WhatsApp until admin shipping is configured.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {shippingRates.map((rate) => {
                        const isSelected = selectedShippingRate?.id === rate.id;
                        
                        // Calculate cost for this specific rate
                        const calculateRateCost = (r: ShippingRate): number => {
                          const cartTotal = getCartTotal();
                          const cartWeight = cart.reduce((sum, item) => sum + 0.5 * item.quantity, 0);
                          
                          // Check free shipping threshold
                          if (r.rateType === 'free' && r.freeShippingThreshold && cartTotal >= r.freeShippingThreshold) {
                            return 0;
                          }
                          
                          // Flat rate
                          if (r.rateType === 'flat' && r.flatRate !== undefined) {
                            return r.flatRate;
                          }
                          
                          // Weight-based
                          if (r.rateType === 'weight_based' && r.weightRanges) {
                            for (const range of r.weightRanges) {
                              if (cartWeight >= range.minWeight && cartWeight <= range.maxWeight) {
                                return range.rate;
                              }
                            }
                          }
                          
                          // Price-based
                          if (r.rateType === 'price_based' && r.priceRanges) {
                            for (const range of r.priceRanges) {
                              if (cartTotal >= range.minPrice && cartTotal <= range.maxPrice) {
                                return range.rate;
                              }
                            }
                          }
                          
                          // Fallback to flat rate or 0
                          return r.flatRate || 0;
                        };
                        
                        const rateCost = calculateRateCost(rate);
                        
                        return (
                          <label
                            key={rate.id}
                            className={`cursor-pointer border-2 rounded-xl p-4 flex items-start gap-4 transition-all hover:border-gray-300 ${
                              isSelected ? 'border-black bg-gray-50' : 'border-gray-100'
                            }`}
                            onClick={async () => {
                              setSelectedShippingRate(rate);
                              // Set the calculated cost for this specific rate
                              setShippingCost(rateCost);
                            }}
                          >
                            <input
                              type="radio"
                              name="shippingMethod"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 text-black focus:ring-black mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="block font-bold text-gray-900">{rate.name}</span>
                                <span className="block font-bold text-gray-900">
                                  {rateCost === 0 ? t('checkout.free') || 'Free' : formatPrice(rateCost)}
                                </span>
                              </div>
                              {rate.description && (
                                <p className="text-sm text-gray-600 mb-1">{rate.description}</p>
                              )}
                              <p className="text-xs text-gray-500">
                                {t('checkout.estimated_delivery', { days: rate.estimatedDays }) ||
                                  `Estimated delivery: ${rate.estimatedDays} day${
                                    rate.estimatedDays !== 1 ? 's' : ''
                                  }`}
                                {rate.carrierName &&
                                  ` ${t('checkout.via_carrier', { carrier: rate.carrierName }) || `via ${rate.carrierName}`}`}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-4 pt-2">
                    <button onClick={prevStep} className="px-6 py-3 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                      {t('checkout.back') || 'Back'}
                    </button>
                    <button onClick={validateStep4} className="flex-1 bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
                      {t('checkout.continue_to_payment') || 'Continue to Payment'}
                    </button>
                  </div>
                </div>
              )}
              {currentStep > 4 && (selectedShippingRate || shippingRates.length === 0) && (
                <div>
                  {selectedShippingRate ? (
                    <>
                      <p className="font-medium text-gray-900">
                        {selectedShippingRate.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {`${shippingCost === 0 ? (t('checkout.free_shipping') || 'Free Shipping') : formatPrice(shippingCost)} - ${selectedShippingRate.estimatedDays} ${t('checkout.estimated_delivery', { days: selectedShippingRate.estimatedDays }) || `day${selectedShippingRate.estimatedDays !== 1 ? 's' : ''}`}`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900">
                        {t('checkout.shipping_tbc_whatsapp_summary') || 'Shipping to be confirmed on WhatsApp'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('checkout.shipping_tbc_whatsapp_summary_desc') || 'Shipping cost and delivery method will be confirmed manually after the order is received.'}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Step 5: Payment */}
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border ${currentStep === 5 ? 'border-black ring-1 ring-black' : 'border-gray-100 opacity-60'}`}>
               <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 5 ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>5</div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('checkout.step5_title') || 'Payment'}
                  </h2>
              </div>

              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t('checkout.order_via_whatsapp') || 'Order via WhatsApp'}</h3>
                    <p className="text-sm text-gray-700 leading-6">
                      {t('checkout.order_via_whatsapp_desc') || 'All checkout details, discounts, shipping, and totals remain active. When you confirm, the order will be saved and a WhatsApp message with the full order summary will open automatically.'}
                    </p>
                    <p className="text-sm text-gray-700 mt-3">
                      {t('checkout.whatsapp_number') || 'WhatsApp number'}: <span className="font-bold">+{getWhatsAppOrderNumber()}</span>
                    </p>
                  </div>

                  {paymentError && (
                      <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                          {paymentError}
                      </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={prevStep}
                      className="px-6 py-3 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('checkout.back') || 'Back'}
                    </button>

                    <button
                      onClick={handleWhatsAppOrder}
                      disabled={isProcessing}
                      className="flex-1 bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 flex items-center justify-center"
                    >
                      {isProcessing
                        ? t('checkout.processing') || 'Processing...'
                        : t('checkout.send_order_whatsapp') || 'Send Order via WhatsApp'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="w-full lg:w-1/3 sticky top-24">
            <div className="bg-white p-6 rounded-2xl shadow-xl shadow-gray-100/50 border border-gray-100">
              <h2 className="text-xl font-bold mb-6 pb-4 border-b border-gray-100 text-gray-900">{t('checkout.order_summary') || 'Order Summary'}</h2>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {cart.map((item) => {
                  
                  // Check if this is a flash sale product
                  const flashSale = item.flashSaleId ? flashSales.find(s => s.id === item.flashSaleId) : null;
                  
                  // Recalculate price for display based on current product data
                  const product = products.find(p => p.id === item.productId);
                  let displayPrice = item.price;
                  
                  if (product) {
                    // Calculate variant extraPrice
                    // If variant value contains " - " (color - size format), calculate both variants' extraPrice
                    let variantExtraPrice = 0;
                    if (item.variant) {
                      // Check if this is a combined variant (color - size)
                      if (item.variant.value?.includes(' - ')) {
                        const [colorValue, sizeValue] = item.variant.value.split(' - ');
                        const colorVariant = product.variants?.find(v => 
                          v.name?.toLowerCase() === 'color' && 
                          v.value?.toLowerCase() === colorValue?.toLowerCase()
                        );
                        const sizeVariant = product.variants?.find(v => 
                          v.name?.toLowerCase() === 'size' && 
                          v.value?.toLowerCase() === sizeValue?.toLowerCase()
                        );
                        const colorExtraPrice = (colorVariant?.extraPrice ?? colorVariant?.priceAdjustment ?? 0);
                        const sizeExtraPrice = (sizeVariant?.extraPrice ?? sizeVariant?.priceAdjustment ?? 0);
                        variantExtraPrice = colorExtraPrice + sizeExtraPrice;
                      } else {
                        // Single variant
                        const variant = product.variants?.find(v => 
                          v.id === item.variant?.id || 
                          (v.name?.toLowerCase() === item.variant?.name?.toLowerCase() && 
                           v.value?.toLowerCase() === item.variant?.value?.toLowerCase())
                        );
                        if (variant) {
                          // Use nullish coalescing (??) instead of || because extraPrice can be 0 (which is falsy)
                          variantExtraPrice = (variant.extraPrice ?? variant.priceAdjustment ?? 0);
                        }
                      }
                    }
                    
                    const standardPricing = getProductPriceWithVariant(
                      product,
                      item.variant,
                      settings?.goldPricing,
                      settings?.goldPricing?.cache
                    );
                    const basePrice = standardPricing.currentPrice - variantExtraPrice;
                    
                    // Apply flash sale discount if applicable
                    if (item.flashSaleId) {
                      const flashSale = flashSales.find(s => s.id === item.flashSaleId);
                      if (flashSale && flashSale.productIds.includes(item.productId)) {
                        // Discount applies to base price only, variant extraPrice NOT included in discount calculation
                        let discountedBasePrice = basePrice;
                        if (flashSale.discountType === 'percentage') {
                          discountedBasePrice = Math.max(basePrice * (1 - flashSale.discountValue / 100), 0);
                        } else if (flashSale.discountType === 'fixed') {
                          discountedBasePrice = Math.max(basePrice - flashSale.discountValue, 0);
                        }
                        // Final price = discounted base price only (variant extraPrice NOT included for flash sale)
                        displayPrice = discountedBasePrice;
                      } else {
                        displayPrice = standardPricing.currentPrice;
                      }
                    } else {
                      displayPrice = standardPricing.currentPrice;
                    }
                  }
                  
                  return (
                    <div key={`${item.productId}-${item.variant?.id || 'no-variant'}`} className="flex gap-4">
                      <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                          <Image src={item.productImage} alt={item.productName} fill className="object-cover" unoptimized />
                          <span className="absolute top-0 right-0 bg-black text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-bl-lg font-bold">
                              {item.quantity}
                          </span>
                      </div>
                      <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{item.productName}</h4>
                            {flashSale && (
                              <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded whitespace-nowrap">
                                {t('checkout.flash_sale') || 'Flash Sale'}
                              </span>
                            )}
                          </div>
                          {item.variant && <p className="text-xs text-gray-500 mt-0.5">{item.variant.name}: {item.variant.value}</p>}
                      </div>
                      <div className="text-sm font-bold text-gray-900">
                          {formatPrice(displayPrice * item.quantity)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Section */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {t('checkout.discount_code_label') || 'Discount Code'}
                </label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder={t('checkout.discount_code_placeholder') || 'Enter code'}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <button 
                        type="button" 
                        onClick={applyCoupon} 
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors"
                    >
                        {t('checkout.apply') || 'Apply'}
                    </button>
                </div>
                {couponError && <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                    {couponError}
                </p>}
                {appliedCoupon && <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                    {t('checkout.coupon_applied', { code: appliedCoupon.code }) || `Code "${appliedCoupon.code}" applied!`}
                </p>}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>{t('checkout.subtotal') || 'Subtotal'}</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                {appliedCoupon && (
                    <div className="flex justify-between text-green-600 font-medium">
                        <span>{t('checkout.discount') || 'Discount'}</span>
                        <span>-{formatPrice(discountAmount)}</span>
                    </div>
                )}
                {useWallet && walletAmount > 0 && (
                    <div className="flex justify-between text-blue-600 font-medium">
                        <span>{t('checkout.wallet_summary_label') || 'Wallet Balance'}</span>
                        <span>-{formatPrice(walletAmount)}</span>
                    </div>
                )}
                {(freeShippingRule && (cartTotal - discountAmount) >= freeShippingRule.threshold) || (selectedShippingRate && shippingCost === 0) ? (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>{t('checkout.shipping') || 'Shipping'}</span>
                    <span>{t('checkout.free') || 'Free'}</span>
                  </div>
                ) : selectedShippingRate ? (
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {t('checkout.shipping_with_method', { method: selectedShippingRate.name }) ||
                        `Shipping (${selectedShippingRate.name})`}
                    </span>
                    <span>{formatPrice(shippingCost)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-600">
                    <span>{t('checkout.shipping') || 'Shipping'}</span>
                    <span className="text-sm text-gray-500 italic">
                      {shippingRates.length === 0
                         ? (t('checkout.shipping_tbc_whatsapp') || 'To be confirmed on WhatsApp')
                        : t('checkout.select_shipping_hint') || 'Select shipping method'}
                    </span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <>
                    {taxBreakdown.length > 0 ? (
                      taxBreakdown.map((tax, index) => (
                        <div key={index} className="flex justify-between text-gray-600">
                          <span>{tax.taxRate.name}</span>
                          <span className="font-medium text-gray-900">{formatPrice(tax.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-gray-600">
                        <span>{t('checkout.tax') || 'Tax'}</span>
                        <span className="font-medium text-gray-900">{formatPrice(taxAmount)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-100">
                  <span>{t('checkout.total') || 'Total'}</span>
                  <span>{formatPrice(getFinalTotal())}</span>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-center gap-3 opacity-60 grayscale">
                  <div className="text-[10px] font-bold border border-gray-300 rounded px-2 py-1">{t('checkout.ssl_secure') || 'SSL SECURE'}</div>
                  <div className="text-[10px] font-bold border border-gray-300 rounded px-2 py-1">{t('checkout.money_back') || 'MONEY BACK'}</div>
              </div>
            </div>
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

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={infoDialogTitle}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};


export default CheckoutPage;

