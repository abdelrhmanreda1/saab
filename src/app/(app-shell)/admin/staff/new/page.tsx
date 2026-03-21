'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User, createUserWithEmailAndPassword } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { addStaffMember } from '@/lib/firestore/user_management_db';
import { AdminRole } from '@/lib/firestore/user_management';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';
import 'react-phone-number-input/style.css';
import { Value } from 'react-phone-number-input';
import type { Country as PhoneCountry } from 'react-phone-number-input';
import dynamic from 'next/dynamic';

const PhoneInput = dynamic(() => import('react-phone-number-input'), { ssr: false });

const NewStaffPage = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const [appSettings, setAppSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  const [staff, setStaff] = useState({
    email: '',
    displayName: '',
    phoneNumber: '' as Value | undefined,
    role: AdminRole.Admin, // Filhal sirf Admin role - future mein aur roles add honge
    isActive: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const data = await getSettings();
        if (data) {
          setAppSettings({ ...defaultSettings, ...data });
        }
      } catch {
        // Failed to fetch settings
      }
    };
    fetchSettingsData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setStaff(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handlePhoneChange = (value: Value | undefined) => {
    setStaff(prev => ({
      ...prev,
      phoneNumber: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (appSettings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setSaving(true);
    try {
      // Generate a secure random password (user never sees this)
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!@#';
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, staff.email, tempPassword);
      const newUser = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        displayName: staff.displayName,
        isAdmin: true, // Sab staff members admin hain filhal
        role: 'admin', // Filhal sirf Admin role
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create staff member record
      await addStaffMember({
        uid: newUser.uid,
        email: staff.email,
        displayName: staff.displayName,
        phoneNumber: staff.phoneNumber ? String(staff.phoneNumber) : undefined,
        role: AdminRole.Admin, // Filhal sirf Admin role
        isActive: staff.isActive,
        createdBy: user.uid,
      });

      setInfoDialogMessage(t('admin.staff_create_success') || 'Staff member created successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        router.push('/admin/staff');
      }, 1500);
    } catch (error: unknown) {
      // Failed to create staff
      const errorMessage = error instanceof Error ? error.message : 'Failed to create staff member.';
      setInfoDialogMessage(errorMessage);
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setSaving(false);
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
          href="/admin/staff"
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.staff_back') || 'Back to Staff'}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t('admin.add_staff_member') || 'Add Staff Member'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('admin.staff_add_subtitle') || 'Create a new staff member account'}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_email') || 'Email'} *</label>
          <input
            type="email"
            name="email"
            value={staff.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_display_name') || 'Display Name'} *</label>
          <input
            type="text"
            name="displayName"
            value={staff.displayName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_phone_number') || 'Phone Number'}</label>
          <div className="phone-input-container">
            <PhoneInput
              international
              defaultCountry={(settings?.site?.defaultCountry as PhoneCountry) || ("PK" as PhoneCountry)}
              value={staff.phoneNumber}
              onChange={handlePhoneChange}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_role') || 'Role'} *</label>
          <select
            name="role"
            value={staff.role}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-gray-50"
            disabled
          >
            <option value={AdminRole.Admin}>{t('admin.staff_role_admin') || 'Admin'}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('admin.staff_role_note') || 'Currently only Admin role is available. More roles will be added in future updates.'}</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="isActive"
            checked={staff.isActive}
            onChange={handleChange}
            className="w-5 h-5"
          />
          <label className="text-sm text-gray-700">{t('admin.staff_form_active') || 'Active'}</label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.push('/admin/staff')}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('admin.common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-70"
          >
            {saving ? (t('admin.staff_creating') || 'Creating...') : (t('admin.staff_create_button') || 'Create Staff Member')}
          </button>
        </div>
      </form>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => {
          setShowInfoDialog(false);
          if (infoDialogType === 'success') {
            router.push('/admin/staff');
          }
        }}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />

      {/* Custom styles for PhoneInput */}
      <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .PhoneInputCountry {
          position: relative;
          align-self: stretch;
          display: flex;
          align-items: center;
          padding-right: 0.5rem;
          margin-right: 0.5rem;
          border-right: 1px solid #e5e7eb;
        }
        .PhoneInputCountryIcon {
          width: 1.5rem;
          height: 1rem;
          box-shadow: 0 0 1px rgba(0,0,0,0.5);
        }
        .PhoneInputCountrySelect {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          z-index: 1;
          border: 0;
          opacity: 0;
          cursor: pointer;
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
          border-radius: 0.5rem;
          padding: 0.625rem 1rem;
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

export default NewStaffPage;

