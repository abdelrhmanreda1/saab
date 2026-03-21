'use client';

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getUserPreferences, setUserPreferences } from '@/lib/firestore/user_account_db';
import { UserPreferences } from '@/lib/firestore/user_account';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LanguageContext } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/components/Toast';
import AccountMobileNav from '@/components/AccountMobileNav';

const PreferencesPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences['emailPreferences'] & UserPreferences['notificationPreferences'] & UserPreferences['privacySettings']>({
    orderUpdates: true,
    promotions: true,
    newsletters: true,
    productRecommendations: true,
    orderStatus: true,
    stockAlerts: false,
    priceDrops: false,
    profileVisibility: 'public',
    showEmail: false,
    showPhone: false,
  });
  const router = useRouter();
  const auth = getAuth(app);
  const { demoUser } = useAuth();
  const { settings } = useSettings();
  const { showSuccess, showError } = useToast();
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const fetchPreferences = useCallback(async (uid: string) => {
    try {
      const userPrefs = await getUserPreferences(uid);
      if (userPrefs) {
        setPreferences({
          ...userPrefs.emailPreferences,
          ...userPrefs.notificationPreferences,
          ...userPrefs.privacySettings,
        });
      }
    } catch {
      // Error fetching preferences
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      fetchPreferences(demoUser.uid);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchPreferences(currentUser.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [auth, router, fetchPreferences, settings?.demoMode, demoUser]);

  const handleChange = (field: string, value: boolean | string) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!userId) return;

    setSaving(true);
    try {
      await setUserPreferences(userId, {
        userId: userId,
        emailPreferences: {
          orderUpdates: preferences.orderUpdates,
          promotions: preferences.promotions,
          newsletters: preferences.newsletters,
          productRecommendations: preferences.productRecommendations,
        },
        notificationPreferences: {
          orderStatus: preferences.orderStatus,
          promotions: preferences.promotions,
          stockAlerts: preferences.stockAlerts,
          priceDrops: preferences.priceDrops,
        },
        privacySettings: {
          profileVisibility: preferences.profileVisibility as 'public' | 'private',
          showEmail: preferences.showEmail,
          showPhone: preferences.showPhone,
        },
      });
      showSuccess(t('account.preferences.save_success') || 'Preferences saved successfully!');
    } catch {
      // Error saving preferences
      showError(t('account.preferences.save_failed') || 'Failed to save preferences.');
    } finally {
      setSaving(false);
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
            <div className="md:col-span-2">
              <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
              <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
                    <div className="space-y-3">
                      {[1, 2].map((j) => (
                        <div key={j} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                      ))}
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
            {t('account.preferences.subtitle') || 'Manage your account preferences.'}
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
                <Link href="/account/addresses" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_addresses')}
                </Link>
                <Link href="/account/returns" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_returns')}
                </Link>
                <Link href="/account/refunds" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_refunds')}
                </Link>
                <Link href="/account/preferences" className="block px-4 py-2 bg-black text-white rounded-lg font-medium">
                  {t('account.nav_preferences')}
                </Link>
                <Link href="/wishlist" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_wishlist')}
                </Link>
              </nav>
            </div>
          </div>

          {/* Right Column: Preferences Content */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-heading font-bold mb-6 text-gray-900">
              {t('account.preferences.title') || 'Preferences'}
            </h2>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              {/* Email Preferences */}
              <div>
                <h3 className="text-base font-bold mb-3 text-gray-900">
                  {t('account.preferences.email_section') || 'Email Preferences'}
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.orderUpdates}
                      onChange={(e) => handleChange('orderUpdates', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.email_order_updates') || 'Order Updates'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.email_order_updates_desc') || 'Receive updates about your orders'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.promotions}
                      onChange={(e) => handleChange('promotions', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.email_promotions') || 'Promotions'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.email_promotions_desc') || 'Receive promotional offers'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.newsletters}
                      onChange={(e) => handleChange('newsletters', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.email_newsletters') || 'Newsletters'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.email_newsletters_desc') || 'Receive our newsletter'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.productRecommendations}
                      onChange={(e) => handleChange('productRecommendations', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.email_recommendations') || 'Product Recommendations'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.email_recommendations_desc') || 'Receive personalized product recommendations'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notification Preferences */}
              <div>
                <h3 className="text-base font-bold mb-3 text-gray-900">
                  {t('account.preferences.notifications_section') || 'Notification Preferences'}
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.orderStatus}
                      onChange={(e) => handleChange('orderStatus', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.notifications_order_status') || 'Order Status'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.notifications_order_status_desc') || 'Get notified about order status changes'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.stockAlerts}
                      onChange={(e) => handleChange('stockAlerts', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.notifications_stock_alerts') || 'Stock Alerts'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.notifications_stock_alerts_desc') || 'Get notified when items are back in stock'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.priceDrops}
                      onChange={(e) => handleChange('priceDrops', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-sm">
                        {t('account.preferences.notifications_price_drops') || 'Price Drops'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('account.preferences.notifications_price_drops_desc') || 'Get notified when prices drop'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Privacy Settings */}
              <div>
                <h3 className="text-base font-bold mb-3 text-gray-900">
                  {t('account.preferences.privacy_section') || 'Privacy Settings'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      {t('account.preferences.privacy_profile_visibility') || 'Profile Visibility'}
                    </label>
                    <select
                      value={preferences.profileVisibility}
                      onChange={(e) => handleChange('profileVisibility', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
                    >
                      <option value="public">
                        {t('account.preferences.privacy_public') || 'Public'}
                      </option>
                      <option value="private">
                        {t('account.preferences.privacy_private') || 'Private'}
                      </option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.showEmail}
                      onChange={(e) => handleChange('showEmail', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-sm">
                      {t('account.preferences.privacy_show_email') || 'Show Email'}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.showPhone}
                      onChange={(e) => handleChange('showPhone', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-sm">
                      {t('account.preferences.privacy_show_phone') || 'Show Phone'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white font-medium bg-black rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
                  {saving ? t('account.preferences.saving') || 'Saving...' : t('account.preferences.save') || 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesPage;

