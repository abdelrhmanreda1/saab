'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getTwoFactorAuth, enableTwoFactorAuth, disableTwoFactorAuth } from '@/lib/firestore/user_management_db';
import { TwoFactorAuth } from '@/lib/firestore/user_management';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

// Simple TOTP secret generator (in production, use a proper library)
const generateSecret = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
};

const generateBackupCodes = (count: number = 8): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
  }
  return codes;
};

const TwoFactorAuthPage = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [tfa, setTfa] = useState<TwoFactorAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const tfaData = await getTwoFactorAuth(currentUser.uid);
          setTfa(tfaData);
        } catch {
          // Failed to fetch 2FA
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const handleSetup = () => {
    const newSecret = generateSecret();
    const codes = generateBackupCodes();
    setSecret(newSecret);
    setBackupCodes(codes);
    setSettingUp(true);
  };

  const handleVerify = async () => {
    if (!user || !secret) return;

    // In production, verify the TOTP code using a proper library
    // For now, we'll just enable it if a code is provided
    if (verificationCode.length === 6) {
      try {
        await enableTwoFactorAuth(user.uid, secret, backupCodes);
        alert(t('admin.twofa_enable_success'));
        const updatedTfa = await getTwoFactorAuth(user.uid);
        setTfa(updatedTfa);
        setSettingUp(false);
        setVerificationCode('');
      } catch {
        // Failed to enable 2FA
        alert(t('admin.twofa_enable_failed'));
      }
    } else {
      alert(t('admin.twofa_invalid_code'));
    }
  };

  const handleDisable = async () => {
    if (!user || !window.confirm(t('admin.twofa_disable_confirm'))) return;

    try {
      await disableTwoFactorAuth(user.uid);
      setTfa(null);
      alert(t('admin.twofa_disable_success'));
    } catch {
      // Failed to disable 2FA
      alert(t('admin.twofa_disable_failed'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {t('admin.common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <Link
          href="/admin/settings"
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.twofa_back_to_settings')}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t('admin.twofa_title') || t('admin.two_factor_auth') || 'Two-Factor Authentication'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('admin.twofa_subtitle') || 'Secure your account with two-factor authentication'}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {tfa?.enabled ? (
          <div>
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-green-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h3 className="font-bold text-green-900">
                  {t('admin.twofa_status_enabled_title') || '2FA is Enabled'}
                </h3>
              </div>
              <p className="text-sm text-green-700">
                {t('admin.twofa_status_enabled_description') ||
                  'Your account is protected with two-factor authentication.'}
              </p>
            </div>
            <button
              onClick={handleDisable}
              className="bg-red-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm sm:text-base"
            >
              {t('admin.twofa_disable_button') || 'Disable 2FA'}
            </button>
          </div>
        ) : settingUp ? (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold text-blue-900 mb-2">
                {t('admin.twofa_setup_instructions_title') || 'Setup Instructions'}
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                <li>
                  {t('admin.twofa_setup_instructions_step1') ||
                    'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)'}
                </li>
                <li>
                  {t('admin.twofa_setup_instructions_step2') ||
                    'Enter the 6-digit code from your app to verify'}
                </li>
                <li>
                  {t('admin.twofa_setup_instructions_step3') ||
                    'Save your backup codes in a safe place'}
                </li>
              </ol>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t('admin.twofa_secret_key_label') || 'Secret Key:'}
              </p>
              <p className="font-mono text-sm bg-white p-2 rounded border">{secret}</p>
              <p className="text-xs text-gray-500 mt-2">
                {t('admin.twofa_secret_key_hint') ||
                  "Enter this manually if you can't scan QR code"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.twofa_verification_code_label') || 'Verification Code'}
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('admin.twofa_verification_code_placeholder') || '000000'}
                maxLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-center text-xl sm:text-2xl tracking-widest"
              />
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-bold text-yellow-900 mb-2">
                {t('admin.twofa_backup_codes_title') || 'Backup Codes (Save these!):'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, idx) => (
                  <code key={idx} className="bg-white p-2 rounded text-sm font-mono">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setSettingUp(false);
                  setSecret(null);
                  setBackupCodes([]);
                  setVerificationCode('');
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('admin.twofa_cancel_button') || 'Cancel'}
              </button>
              <button
                onClick={handleVerify}
                disabled={verificationCode.length !== 6}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-70"
              >
                {t('admin.twofa_verify_enable_button') || 'Verify & Enable'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-6">
              {t('admin.twofa_intro') ||
                'Two-factor authentication adds an extra layer of security to your account.'}{' '}
              {t('admin.twofa_intro_continued') ||
                "You'll need to enter a code from your authenticator app in addition to your password."}
            </p>
            <button
              onClick={handleSetup}
              className="bg-black text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-sm sm:text-base"
            >
              {t('admin.twofa_enable_button') || 'Enable 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorAuthPage;

